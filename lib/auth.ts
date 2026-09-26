import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "booth_admin";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  return (
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "dev-only-change-me"
  );
}

export function adminPassword() {
  return (process.env.ADMIN_PASSWORD || "photobooth").trim();
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export async function setAdminSession() {
  const issued = String(Date.now());
  const value = `${issued}.${sign(issued)}`;
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdmin() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const [issued, hmac] = raw.split(".");
  if (!issued || !hmac) return false;
  const expected = sign(issued);
  try {
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    throw new Error("UNAUTHORIZED");
  }
}
