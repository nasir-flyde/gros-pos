export type PosPageState = "loading" | "error" | "empty" | "ready";

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "message" in error) {
    const message = String(error.message || "").trim();
    if (message) return message;
  }

  if (typeof error === "string" && error.trim()) return error.trim();

  return fallback;
}

export function resolvePosPageState({
  isLoading,
  isError,
  hasData,
}: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
}): PosPageState {
  if (isLoading) return "loading";
  if (isError) return "error";
  return hasData ? "ready" : "empty";
}
