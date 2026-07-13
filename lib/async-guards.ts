export function isAbortLikeError(error: unknown): boolean {
  if (!error) return false;

  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError" || error.message.toLowerCase().includes("aborted");
  }

  const message = String((error as { message?: unknown })?.message || error).toLowerCase();
  const name = String((error as { name?: unknown })?.name || "").toLowerCase();

  return (
    name.includes("abort") ||
    message.includes("abort") ||
    message.includes("took too long") ||
    message.includes("broken by another request") ||
    message.includes("lock")
  );
}
