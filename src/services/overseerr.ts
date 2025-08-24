import { http as axios } from "../utils/http.js";
import { config } from "../config.js";
import { logger, logError } from "../utils/logger.js";

export interface OverseerrUser {
  id: number;
  username: string;
  email: string;
  plexId?: string;
}

const log = logger.child({ ctx: "services.overseerr" });

const serializeParams = (params: Record<string, unknown>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    )
    .join("&");

export const overseerr = axios.create({
  baseURL: `${config.overseerr.apiUrl}/api/v1`,
  headers: { "X-Api-Key": config.overseerr.apiKey },
  timeout: 10_000,
  paramsSerializer: serializeParams
});

export async function fetchOverseerrUserByEmail(
  email: string
): Promise<OverseerrUser | null> {
  try {
    const url = `${config.overseerr.apiUrl}/user?${serializeParams({ take: 100, page: 0 })}`;
    const { data } = await axios.get(url, {
      headers: { "X-Api-Key": config.overseerr.apiKey }
    });

    const users: OverseerrUser[] = data.results || data?.results || [];
    const matched = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (!matched) {
      log.info({ email }, "No user found");
      return null;
    }
    logger.info({ user: matched }, "Found User");
    return matched;
  } catch (err: unknown) {
    logError("Error fetching Overseerr user by email", err, { email });
    return null;
  }
}
