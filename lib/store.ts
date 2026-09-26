import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { get as blobGet, put as blobPut } from "@vercel/blob";
import {
  AppState,
  BoothSettings,
  DEFAULT_SETTINGS,
  PhotoRecord,
  RoomRecord,
  SignalMessage,
  LogoRecord,
} from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PHOTOS_DIR = path.join(DATA_DIR, "photos");
const LOGOS_DIR = path.join(DATA_DIR, "logos");
const BLOB_STATE = "booth/state.json";

const emptyState = (): AppState => ({
  version: 1,
  rooms: {},
  photos: {},
  settings: {},
  signals: {},
  logos: {},
});

const globalStore = globalThis as typeof globalThis & {
  __boothState?: AppState;
  __boothLock?: Promise<unknown>;
};

if (!globalStore.__boothLock) {
  globalStore.__boothLock = Promise.resolve();
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = globalStore.__boothLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalStore.__boothLock = prev.then(() => next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function useFile() {
  return process.env.VERCEL !== "1";
}

async function readState(): Promise<AppState> {
  if (useBlob()) {
    try {
      const result = await blobGet(BLOB_STATE, {
        access: "private",
        useCache: false,
      });
      if (!result?.stream) return globalStore.__boothState ?? emptyState();
      const text = await new Response(result.stream).text();
      const parsed = JSON.parse(text) as AppState;
      parsed.logos = parsed.logos ?? {};
      globalStore.__boothState = parsed;
      return parsed;
    } catch {
      return globalStore.__boothState ?? emptyState();
    }
  }

  if (useFile()) {
    try {
      const raw = await readFile(DB_FILE, "utf8");
      const parsed = JSON.parse(raw) as AppState;
      parsed.logos = parsed.logos ?? {};
      globalStore.__boothState = parsed;
      return parsed;
    } catch {
      const state = globalStore.__boothState ?? emptyState();
      globalStore.__boothState = state;
      return state;
    }
  }

  return globalStore.__boothState ?? emptyState();
}

async function writeState(state: AppState) {
  state.version += 1;
  globalStore.__boothState = state;

  if (useBlob()) {
    await blobPut(BLOB_STATE, JSON.stringify(state), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }

  if (useFile()) {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DB_FILE, JSON.stringify(state), "utf8");
  }
}

export async function mutateState<T>(
  fn: (state: AppState) => T | Promise<T>,
): Promise<T> {
  return withLock(async () => {
    const state = await readState();
    const result = await fn(state);
    await writeState(state);
    return result;
  });
}

export async function getState() {
  return withLock(() => readState());
}

export async function upsertRoom(code: string): Promise<RoomRecord> {
  return mutateState((state) => {
    const existing = state.rooms[code];
    if (existing) return existing;
    const room: RoomRecord = {
      code,
      createdAt: new Date().toISOString(),
      cameraLastSeen: 0,
      boothLastSeen: 0,
      iceRestartNonce: 0,
    };
    state.rooms[code] = room;
    state.settings[code] = { ...DEFAULT_SETTINGS };
    state.signals[code] = [];
    return room;
  });
}

export async function touchPresence(code: string, role: "booth" | "camera") {
  return mutateState((state) => {
    const room = state.rooms[code];
    if (!room) return null;
    const now = Date.now();
    if (role === "booth") room.boothLastSeen = now;
    else room.cameraLastSeen = now;
    return room;
  });
}

export async function getRoom(code: string) {
  const state = await getState();
  return state.rooms[code] ?? null;
}

export async function getSettings(code: string): Promise<BoothSettings> {
  const state = await getState();
  const stored = state.settings[code] ?? {};
  const rawFrame = (stored as { frameStyle?: string }).frameStyle;
  const frameStyle =
    rawFrame === "classic" || rawFrame === "booth"
      ? "booth"
      : rawFrame === "gold" || rawFrame === "minimal" || rawFrame === "none"
        ? rawFrame
        : DEFAULT_SETTINGS.frameStyle;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    frameStyle,
    hasLogo: Boolean(state.logos[code]),
  };
}

export async function updateSettings(
  code: string,
  patch: Partial<BoothSettings>,
) {
  return mutateState((state) => {
    const current = { ...DEFAULT_SETTINGS, ...(state.settings[code] ?? {}) };
    const next = {
      ...current,
      ...patch,
      countdownSeconds: Math.min(
        10,
        Math.max(1, Math.round(patch.countdownSeconds ?? current.countdownSeconds)),
      ),
      photosPerRound: Math.min(
        4,
        Math.max(1, Math.round(patch.photosPerRound ?? current.photosPerRound)),
      ),
    };
    state.settings[code] = next;
    return next;
  });
}

export async function pushSignal(message: SignalMessage) {
  return mutateState((state) => {
    const list = state.signals[message.roomCode] ?? [];
    list.push(message);
    state.signals[message.roomCode] = list.slice(-120);
    return message;
  });
}

export async function readSignals(code: string, after: number) {
  const state = await getState();
  const list = state.signals[code] ?? [];
  return list.filter((item) => item.ts > after);
}

export async function savePhoto(record: PhotoRecord) {
  return mutateState((state) => {
    state.photos[record.id] = record;
    return record;
  });
}

export async function getPhoto(id: string) {
  const state = await getState();
  return state.photos[id] ?? null;
}

export async function listPhotos(roomCode?: string) {
  const state = await getState();
  const photos = Object.values(state.photos).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
  return roomCode ? photos.filter((photo) => photo.roomCode === roomCode) : photos;
}

export async function deletePhoto(id: string) {
  return mutateState(async (state) => {
    const photo = state.photos[id];
    if (!photo) return null;
    delete state.photos[id];
    if (photo.localPath) {
      try {
        await unlink(photo.localPath);
      } catch {
        /* already gone */
      }
    }
    if (photo.blobUrl) {
      try {
        const { del } = await import("@vercel/blob");
        await del(photo.blobUrl);
      } catch {
        /* ignore */
      }
    }
    return photo;
  });
}

export async function writeLocalPhoto(id: string, bytes: Buffer) {
  await mkdir(PHOTOS_DIR, { recursive: true });
  const filePath = path.join(PHOTOS_DIR, `${id}.jpg`);
  await writeFile(filePath, bytes);
  return filePath;
}

export async function storePhotoBytes(
  id: string,
  bytes: Buffer,
  mimeType: string,
): Promise<{ blobUrl?: string; localPath?: string }> {
  try {
    const blob = await blobPut(`photos/${id}.jpg`, bytes, {
      access: "private",
      addRandomSuffix: false,
      contentType: mimeType,
      allowOverwrite: true,
    });
    return { blobUrl: blob.url };
  } catch (error) {
    if (process.env.VERCEL === "1") {
      const err = new Error("BLOB_REQUIRED");
      (err as Error & { cause?: unknown }).cause = error;
      throw err;
    }
    return { localPath: await writeLocalPhoto(id, bytes) };
  }
}

export async function readLocalPhoto(filePath: string) {
  return readFile(filePath);
}

function logoExt(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export async function saveLogo(code: string, bytes: Buffer, mimeType: string) {
  await mutateState(async (state) => {
    const record: LogoRecord = { mimeType };
    try {
      const blob = await blobPut(`logos/${code}.${logoExt(mimeType)}`, bytes, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mimeType,
      });
      record.blobUrl = blob.url;
    } catch {
      if (process.env.VERCEL !== "1") {
        await mkdir(LOGOS_DIR, { recursive: true });
        const filePath = path.join(LOGOS_DIR, `${code}.${logoExt(mimeType)}`);
        await writeFile(filePath, bytes);
        record.localPath = filePath;
      } else {
        record.dataBase64 = bytes.toString("base64");
      }
    }
    state.logos = state.logos ?? {};
    state.logos[code] = record;
    return record;
  });
}

async function getLogoRecord(code: string) {
  const state = await getState();
  return state.logos[code] ?? null;
}

export async function readLogo(code: string) {
  const record = await getLogoRecord(code);
  if (!record) return null;
  if (record.localPath) {
    const bytes = await readFile(record.localPath);
    return { bytes, mimeType: record.mimeType };
  }
  if (record.blobUrl) {
    const blob = await blobGet(record.blobUrl, {
      access: "private",
      useCache: true,
    });
    if (!blob?.stream) return null;
    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
    return { bytes, mimeType: record.mimeType };
  }
  if (record.dataBase64) {
    return {
      bytes: Buffer.from(record.dataBase64, "base64"),
      mimeType: record.mimeType,
    };
  }
  return null;
}

export async function deleteLogo(code: string) {
  return mutateState(async (state) => {
    const record = state.logos[code];
    if (!record) return null;
    delete state.logos[code];
    if (record.localPath) {
      try {
        await unlink(record.localPath);
      } catch {
        /* ignore */
      }
    }
    if (record.blobUrl) {
      try {
        const { del } = await import("@vercel/blob");
        await del(record.blobUrl);
      } catch {
        /* ignore */
      }
    }
    return record;
  });
}

export function isOnline(lastSeen: number, windowMs = 8000) {
  return Date.now() - lastSeen < windowMs;
}
