import { http as axios } from "../utils/http.js";
import { config } from "../config.js";
import { logger, logError } from "../utils/logger.js";

export interface SonarrRequest {
  mediaId: number;
  title: string;
}

const log = logger.child({ ctx: "services.sonarr" });

export async function deleteFromSonarr(
  request: SonarrRequest
): Promise<boolean> {
  if (!config.sonarr) {
    log.warn("Sonarr not configured");
    return false;
  }
  if (!request.mediaId) {
    log.warn({ title: request.title }, "Invalid mediaId");
    return false;
  }
  try {
    const { apiUrl, apiKey } = config.sonarr;
    const { data: list } = await axios.get(`${apiUrl}/api/v3/series`, {
      params: { apiKey, tvdbId: request.mediaId }
    });

    if (!Array.isArray(list) || list.length === 0) {
      log.warn(
        { mediaId: request.mediaId, title: request.title },
        "Couldn't find series"
      );
      return false;
    }

    const series = list[0];
    await axios.delete(`${apiUrl}/api/v3/series/${series.id}`, {
      params: { apiKey },
      data: { deleteFiles: true, addImportListExclusion: false }
    });

    log.info({ id: series.id, title: series.title }, "Deleted from Sonarr");
    return true;
  } catch (err: unknown) {
    logError("Sonarr delete failed", err, {
      mediaId: request.mediaId,
      title: request.title
    });
    return false;
  }
}
