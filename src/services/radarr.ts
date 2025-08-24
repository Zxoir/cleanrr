import { http as axios } from "../utils/http.js";
import { config } from "../config.js";
import { logger, logError } from "../utils/logger.js";

export interface RadarrRequest {
  mediaId: number;
  title: string;
}

const log = logger.child({ ctx: "services.radarr" });

export async function deleteFromRadarr(
  request: RadarrRequest
): Promise<boolean> {
  if (!config.radarr) {
    log.warn("Radarr not configured");
    return false;
  }
  if (!request.mediaId) {
    log.warn({ title: request.title }, "Invalid mediaId");
    return false;
  }
  try {
    const { apiUrl, apiKey } = config.radarr;
    const { data: list } = await axios.get(`${apiUrl}/api/v3/movie`, {
      params: { apiKey, tmdbId: request.mediaId }
    });

    if (!Array.isArray(list) || list.length === 0) {
      log.warn(
        { mediaId: request.mediaId, title: request.title },
        "Couldn't find movie"
      );
      return false;
    }

    const movie = list[0];
    await axios.delete(`${apiUrl}/api/v3/movie/${movie.id}`, {
      params: { apiKey },
      data: { deleteFiles: true, addImportExclusion: false }
    });

    log.info({ id: movie.id, title: movie.title }, "Deleted from Radarr");
    return true;
  } catch (err: unknown) {
    logError("Radarr delete failed", err, {
      mediaId: request.mediaId,
      title: request.title
    });
    return false;
  }
}
