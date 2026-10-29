/** Composer → AI: text rides in ?q=, `send=1` makes the chat send it once. */
export function assistantHandoffHref(text: string, date?: string): string {
  const params = new URLSearchParams({ q: text.trim().slice(0, 600), send: "1" });
  if (date) params.set("date", date);
  return `/assistant?${params.toString()}`;
}
