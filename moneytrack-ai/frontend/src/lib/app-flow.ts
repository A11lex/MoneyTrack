export type AppErrorKind = "not_found" | "authentication" | "unavailable";


export function classifyAppError(error: unknown): AppErrorKind {
  const status = readStatus(error);
  if (status === 404) return "not_found";
  if (status === 401 || status === 403) return "authentication";
  return "unavailable";
}


function readStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}
