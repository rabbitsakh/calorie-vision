/**
 * Legacy admin path — same handlers as /api/assistant (session already admin-checked on UI).
 * Prefer /api/assistant for new clients.
 */
export { GET, POST } from "@/app/api/assistant/route";
