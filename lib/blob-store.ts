import { get as blobGet, put as blobPut } from "@vercel/blob";

const PRIVATE_ON_PUBLIC = /private access on a public store|public store/i;
const PUBLIC_ON_PRIVATE = /public access on a private store|private store/i;

let cachedAccess: "public" | "private" | null = null;

function accessOrder(): Array<"public" | "private"> {
  if (cachedAccess) return [cachedAccess];
  if (process.env.BLOB_ACCESS === "private") return ["private", "public"];
  return ["public", "private"];
}

function mismatch(access: "public" | "private", message: string) {
  return (
    (access === "private" && PRIVATE_ON_PUBLIC.test(message)) ||
    (access === "public" && PUBLIC_ON_PRIVATE.test(message))
  );
}

export async function putBoothBlob(
  pathname: string,
  body: Buffer | string,
  contentType: string,
) {
  let last: unknown;
  for (const access of accessOrder()) {
    try {
      const result = await blobPut(pathname, body, {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
      });
      cachedAccess = access;
      return result;
    } catch (error) {
      last = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (mismatch(access, msg)) {
        cachedAccess = access === "private" ? "public" : "private";
        continue;
      }
      throw error;
    }
  }
  throw last instanceof Error ? last : new Error("Blob feltöltés sikertelen");
}

export async function getBoothBlob(urlOrPath: string, useCache = true) {
  let last: unknown;
  for (const access of accessOrder()) {
    try {
      const result = await blobGet(urlOrPath, { access, useCache });
      cachedAccess = access;
      return result;
    } catch (error) {
      last = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (mismatch(access, msg)) {
        cachedAccess = access === "private" ? "public" : "private";
        continue;
      }
    }
  }

  if (urlOrPath.startsWith("http")) {
    const res = await fetch(urlOrPath);
    if (res.ok) {
      return { stream: res.body, contentType: res.headers.get("content-type") };
    }
  }

  throw last instanceof Error ? last : new Error("Blob olvasás sikertelen");
}
