import { deleteFromRadarr } from "./radarr.js";
import { deleteFromSonarr } from "./sonarr.js";
import { logError } from "../utils/logger.js";

export interface MediaDeletionRequest {
  type: "movie" | "tv";
  mediaId: number;
  title: string;
}

export async function deleteMedia(
  request: MediaDeletionRequest
): Promise<boolean> {
  try {
    if (request.type === "movie") {
      return await deleteFromRadarr(request);
    }
    return await deleteFromSonarr(request);
  } catch (err: unknown) {
    logError("deleteMedia failed", err, {
      type: request.type,
      mediaId: request.mediaId,
      title: request.title
    });
    return false;
  }
}
