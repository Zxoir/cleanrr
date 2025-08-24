import { getUserByPhone } from "../db/users.js";
import { overseerr } from "../services/overseerr.js";
import { logger, logError } from "../utils/logger.js";

const log = logger.child({ ctx: "commands.delete" });

export type DeleteReply =
  | { text: string }
  | {
      text: string;
      confirm: {
        userId: number;
        movie: { id: number; title: string; mediaType: "movie" | "tv" };
      };
    };

export async function handleDeleteCommand(
  jid: string,
  text: string
): Promise<DeleteReply> {
  try {
    const user = await getUserByPhone(jid);
    if (!user) {
      return { text: "❌ Please verify first with: !verify <email>" };
    }

    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) {
      return { text: "❌ Usage: !delete <Movie Name>" };
    }

    const movieName = parts.slice(1).join(" ");
    const movie = await searchMovieInOverseerr(movieName);
    if (!movie) return { text: "❌ No results found." };

    const title = movie.title || movie.name || "Unknown title";
    const mediaType: "movie" | "tv" = movie.mediaType === "tv" ? "tv" : "movie";

    return {
      text: [
        `❓ Are you sure you want to delete *${title}*?`,
        `Reply to this message with:`,
        `✅ yes — delete it`,
        `❌ no — keep it`
      ].join("\n"),
      confirm: {
        userId: user.id,
        movie: { id: movie.id, title, mediaType }
      }
    };
  } catch (err: unknown) {
    logError("Deletion command failed", err, { jid });
    return {
      text: "❌ Deletion failed due to a server error. Please try again later."
    };
  }
}

async function searchMovieInOverseerr(movieName: string) {
  try {
    const response = await overseerr.get("/search", {
      params: { query: movieName.trim() }
    });
    const movie = response.data?.results?.[0];

    if (movie) {
      return movie;
    } else {
      log.warn({ movieName }, "No movie found in Overseerr");
      return null;
    }
  } catch (error) {
    logError("Error while searching for movie in Overseerr", error, {
      movieName
    });
    return null;
  }
}
