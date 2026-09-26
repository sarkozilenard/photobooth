import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export function r2Enabled() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

function r2Bucket() {
  return process.env.R2_BUCKET_NAME || "";
}

function r2Endpoint() {
  const custom = process.env.R2_ENDPOINT?.replace(/\/$/, "");
  if (custom) return custom;
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) return "";
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

let client: S3Client | null = null;

function s3() {
  if (!r2Enabled()) {
    throw new Error("Cloudflare R2 nincs beállítva (R2_ACCOUNT_ID, kulcsok, R2_BUCKET_NAME).");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint(),
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

export function blobPublicUrl(pathname: string) {
  const key = pathname.replace(/^\//, "");
  const envBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (envBase) return `${envBase}/${key}`;
  return null;
}

export async function putBoothBlob(
  pathname: string,
  body: Buffer | string,
  contentType: string,
) {
  const key = pathname.replace(/^\//, "");
  const bytes = typeof body === "string" ? Buffer.from(body) : body;
  await s3().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: contentType.startsWith("image/")
        ? "public, max-age=31536000"
        : "no-cache",
    }),
  );
  const url = blobPublicUrl(key);
  return { url: url || `r2://${r2Bucket()}/${key}` };
}

export async function fetchBoothJson<T>(pathname: string): Promise<T | null> {
  const file = await fetchBoothFile(pathname);
  if (!file?.stream) return null;
  try {
    return (await new Response(file.stream).json()) as T;
  } catch {
    return null;
  }
}

async function getFromR2(key: string) {
  try {
    const out = await s3().send(
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
      }),
    );
    if (!out.Body) return null;
    const bytes = await out.Body.transformToByteArray();
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      contentType: out.ContentType || null,
    };
  } catch {
    return null;
  }
}

export async function fetchBoothFile(urlOrPath: string) {
  if (urlOrPath.startsWith("http")) {
    try {
      const res = await fetch(urlOrPath, { cache: "no-store" });
      if (res.ok && res.body) {
        return { stream: res.body, contentType: res.headers.get("content-type") };
      }
    } catch {
      /* GetObject fallback */
    }
    const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
    if (base && urlOrPath.startsWith(base)) {
      const key = urlOrPath.slice(base.length).replace(/^\//, "");
      if (r2Enabled()) return getFromR2(key);
    }
    return null;
  }
  const key = urlOrPath.replace(/^\//, "");
  const publicUrl = blobPublicUrl(key);
  if (publicUrl) {
    try {
      const res = await fetch(publicUrl, { cache: "no-store" });
      if (res.ok && res.body) {
        return { stream: res.body, contentType: res.headers.get("content-type") };
      }
    } catch {
      /* GetObject fallback */
    }
  }
  if (!r2Enabled()) return null;
  return getFromR2(key);
}
