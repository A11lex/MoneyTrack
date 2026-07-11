export function buildLineAuthorizationHeaders(idToken: string | null | undefined): Record<string, string> {
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

export function currentLineAuthorizationHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return buildLineAuthorizationHeaders(window.liff?.getIDToken?.());
}
