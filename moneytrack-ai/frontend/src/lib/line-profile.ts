export type LineProfileData = {
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
};

type DecodedLineIdToken = {
  sub?: string;
  name?: string;
  picture?: string;
} | null;

type LiffProfileData = {
  userId?: string;
  displayName?: string;
  pictureUrl?: string;
} | null;

export class LineProfileError extends Error {
  readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = "LineProfileError";
  }
}

export function canonicalLineUserId(token: DecodedLineIdToken): string {
  const lineUserId = token?.sub?.trim() ?? "";
  if (!lineUserId) {
    throw new LineProfileError("LINE ID token does not contain a user id");
  }
  return lineUserId;
}

export function buildCanonicalLineProfile({
  token,
  profile,
  cachedProfile,
}: {
  token: DecodedLineIdToken;
  profile: LiffProfileData;
  cachedProfile?: LineProfileData | null;
}): LineProfileData {
  const lineUserId = canonicalLineUserId(token);
  const matchingProfile = profile?.userId === lineUserId ? profile : null;
  const matchingCache = cachedProfile?.line_user_id === lineUserId ? cachedProfile : null;

  return {
    line_user_id: lineUserId,
    display_name:
      firstSpecificLineName(token?.name, matchingProfile?.displayName, matchingCache?.display_name) ??
      "LINE User",
    picture_url: token?.picture ?? matchingProfile?.pictureUrl ?? matchingCache?.picture_url ?? null,
  };
}

function firstSpecificLineName(...values: Array<string | undefined>): string | undefined {
  return values
    .map((value) => value?.trim())
    .find((value) => value && !["ผู้ใช้งาน", "LINE User"].includes(value));
}
