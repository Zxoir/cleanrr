export function handleHelp(): string {
  return [
    "🤖 Available commands:",
    "• !verify <email> — link your Overseerr account",
    "• !list — see tracked items & days remaining",
    "• !cancel <id> — stop reminders for that item",
    "• !delete <title> — delete from Radarr/Sonarr (with confirmation)"
  ].join("\n");
}
