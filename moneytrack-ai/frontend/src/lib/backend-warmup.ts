const warmups = new Map<string, Promise<void>>();

export function warmBackend(apiBaseUrl: string): Promise<void> {
  const baseUrl = apiBaseUrl.replace(/\/$/, "");
  const existing = warmups.get(baseUrl);
  if (existing) return existing;

  const request = fetch(`${baseUrl}/health`, {
    cache: "no-store",
    credentials: "omit",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Backend warmup failed: ${response.status}`);
    })
    .catch((error) => {
      warmups.delete(baseUrl);
      throw error;
    });
  warmups.set(baseUrl, request);
  return request;
}
