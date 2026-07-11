export type LiffAuthenticationStatus = "authenticated" | "redirecting";

export type LiffAuthenticationClient = {
  init: (options: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (options?: { redirectUri?: string }) => void;
};

export async function ensureLiffAuthenticated(
  client: LiffAuthenticationClient,
  liffId: string,
  redirectUri: string,
): Promise<LiffAuthenticationStatus> {
  await client.init({ liffId });
  if (client.isLoggedIn()) {
    return "authenticated";
  }

  client.login({ redirectUri });
  return "redirecting";
}
