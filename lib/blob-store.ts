import { put as blobPut } from "@vercel/blob";

function storeIdFromToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  const [, , , id = ""] = token.split("_");
  return id;
}

export function blobPublicUrl(pathname: string) {
  const envBase = process.env.BLOB_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (envBase) return `${envBase}/${pathname}`;
  const storeId = storeIdFromToken();
  if (!storeId) return null;
  const access = process.env.BLOB_ACCESS === "private" ? "private" : "public";
  return `https://${storeId}.${access}.blob.vercel-storage.com/${pathname}`;
}

export async function putBoothBlob(
  pathname: string,
  body: Buffer | string,
  contentType: string,
) {
  const order: Array<"public" | "private"> =
    process.env.BLOB_ACCESS === "private" ? ["private", "public"] : ["public", "private"];
  let last: unknown;
  for (const access of order) {
    try {
      return await blobPut(pathname, body, {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
      });
    } catch (error) {
      last = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (
        /private access on a public store|public access on a private store/i.test(
          msg,
        )
      ) {
        continue;
      }
      throw error;
    }
  }
  throw last instanceof Error ? last : new Error("Blob feltöltés sikertelen");
}

export async function fetchBoothJson<T>(pathname: string): Promise<T | null> {
  const url = blobPublicUrl(pathname);
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchBoothFile(urlOrPath: string) {
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : blobPublicUrl(urlOrPath);
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok || !res.body) return null;
    return { stream: res.body, contentType: res.headers.get("content-type") };
  } catch {
    return null;
  }
}
