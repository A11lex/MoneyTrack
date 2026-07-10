import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "สรุป",
};

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const liffState = firstParam(params?.["liff.state"]);
  const targetPath = resolveSafeLiffPath(liffState);

  if (targetPath) {
    const query = buildQuery(params);
    const separator = targetPath.includes("?") ? "&" : "?";
    redirect(query.size ? `${targetPath}${separator}${query.toString()}` : targetPath);
  }

  const query = buildQuery(params);
  redirect(query.size ? `/liff/summary?${query.toString()}` : "/liff/summary");
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveSafeLiffPath(value: string | undefined) {
  if (!value) return "";

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/liff/") || decoded.startsWith("//")) {
      return "";
    }
    return decoded;
  } catch {
    return "";
  }
}

function buildQuery(params: Record<string, string | string[] | undefined> | undefined) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value) {
      query.set(key, value);
    }
  });
  return query;
}
