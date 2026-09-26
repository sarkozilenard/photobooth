import { readdir } from "fs/promises";
import path from "path";

const EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const SKIP = new Set([
  "next.svg",
  "vercel.svg",
  "globe.svg",
  "file.svg",
  "window.svg",
  "icon.svg",
  "sw.js",
]);

export interface PackagedLogo {
  name: string;
  file: string;
  url: string;
}

function label(file: string) {
  return file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

async function imagesIn(absDir: string, urlDir: string) {
  try {
    const names = await readdir(absDir);
    return names
      .filter((file) => {
        if (file.startsWith(".")) return false;
        if (SKIP.has(file.toLowerCase())) return false;
        return EXT.has(path.extname(file).toLowerCase());
      })
      .sort((a, b) => a.localeCompare(b, "hu"))
      .map((file) => ({
        name: label(file),
        file,
        url: urlDir ? `${urlDir}/${encodeURIComponent(file)}` : `/${encodeURIComponent(file)}`,
      }));
  } catch {
    return [] as PackagedLogo[];
  }
}

export async function listPackagedLogos() {
  const root = process.cwd();
  const fromLogos = await imagesIn(path.join(root, "public", "logos"), "/logos");
  const fromPublic = await imagesIn(path.join(root, "public"), "");
  const seen = new Set(fromLogos.map((item) => item.file.toLowerCase()));
  const extra = fromPublic.filter((item) => !seen.has(item.file.toLowerCase()));
  return [...fromLogos, ...extra];
}
