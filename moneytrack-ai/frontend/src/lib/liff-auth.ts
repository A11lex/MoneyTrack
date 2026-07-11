export type LiffAuthenticationStatus = "authenticated" | "redirecting";

export type LiffAuthenticationClient = {
  init: (options: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (options?: { redirectUri?: string }) => void;
  getIDToken?: () => string | null;
};

export class LiffAuthenticationError extends Error {
  readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = "LiffAuthenticationError";
  }
}

export async function ensureLiffAuthenticated(
  client: LiffAuthenticationClient,
  liffId: string,
  redirectUri: string,
): Promise<LiffAuthenticationStatus> {
  await client.init({ liffId });
  if (client.isLoggedIn()) {
    if (client.getIDToken && !client.getIDToken()) {
      throw new LiffAuthenticationError("LINE openid scope did not provide an ID token");
    }
    return "authenticated";
  }

  client.login({ redirectUri });
  return "redirecting";
}
