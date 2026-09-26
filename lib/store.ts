import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { putBoothBlob, fetchBoothJson, fetchBoothFile, blobPublicUrl } from "./blob-store";
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

function normalizeState(state: AppState | undefined | null): AppState {
  const next = state ?? emptyState();
  next.rooms = next.rooms ?? {};
  next.photos = next.photos ?? {};
  next.settings = next.settings ?? {};
  next.signals = next.signals ?? {};
  next.logos = next.logos ?? {};
  next.version = next.version ?? 1;
  return next;
}

async function readState(): Promise<AppState> {
  if (useFile()) {
    try {
      const raw = await readFile(DB_FILE, "utf8");
      const parsed = normalizeState(JSON.parse(raw) as AppState);
      globalStore.__boothState = parsed;
      return parsed;
    } catch {
      const state = normalizeState(globalStore.__boothState);
      globalStore.__boothState = state;
      return state;
    }
  }

  return normalizeState(globalStore.__boothState);
}

async function writeState(state: AppState) {
  state.version += 1;
  globalStore.__boothState = state;

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

function normalizeSettings(
  stored: Partial<BoothSettings> | undefined,
  hasLogo: boolean,
): BoothSettings {
  const rawFrame = stored?.frameStyle as string | undefined;
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
    hasLogo,
  };
}

export async function getSettings(code: string): Promise<BoothSettings> {
  const fromBlob = useBlob()
    ? await readJsonBlob<BoothSettings>(settingsMetaPath(code))
    : null;
  const state = await getState();
  const stored = fromBlob ?? state.settings[code] ?? {};
  const logoMeta = useBlob()
    ? await readJsonBlob<LogoRecord>(logoMetaPath(code))
    : null;
  const hasLogo = Boolean(
    state.logos?.[code] || logoMeta?.blobUrl || logoMeta?.mimeType,
  );
  return normalizeSettings(stored, hasLogo);
}

export async function updateSettings(
  code: string,
  patch: Partial<BoothSettings>,
) {
  const current = await getSettings(code);
  const next = normalizeSettings(
    {
      ...current,
      ...patch,
      countdownSeconds: Math.min(
        20,
        Math.max(1, Math.round(patch.countdownSeconds ?? current.countdownSeconds)),
      ),
      photosPerRound: Math.min(
        6,
        Math.max(1, Math.round(patch.photosPerRound ?? current.photosPerRound)),
      ),
    },
    current.hasLogo,
  );
  if (useBlob()) {
    await putBoothBlob(settingsMetaPath(code), JSON.stringify(next), "application/json");
  }
  try {
    return await mutateState((state) => {
      state.settings[code] = next;
      return next;
    });
  } catch {
    return next;
  }
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

function photoMetaPath(id: string) {
  return `meta/photos/${id}.json`;
}

function settingsMetaPath(code: string) {
  return `meta/settings/${code}.json`;
}

function logoMetaPath(code: string) {
  return `meta/logos/${code}.json`;
}

function galleryPath() {
  return "meta/gallery.json";
}

async function readJsonBlob<T>(pathname: string): Promise<T | null> {
  return fetchBoothJson<T>(pathname);
}

async function readGallery(): Promise<PhotoRecord[]> {
  const listed = await fetchBoothJson<PhotoRecord[]>(galleryPath());
  return Array.isArray(listed) ? listed.filter((item) => item?.id) : [];
}

async function writeGallery(photos: PhotoRecord[]) {
  await putBoothBlob(
    galleryPath(),
    JSON.stringify(photos.slice(0, 400)),
    "application/json",
  );
}

export async function savePhoto(record: PhotoRecord) {
  if (useBlob()) {
    await putBoothBlob(photoMetaPath(record.id), JSON.stringify(record), "application/json");
    const gallery = await readGallery();
    await writeGallery([record, ...gallery.filter((item) => item.id !== record.id)]);
  }
  try {
    return await mutateState((state) => {
      state.photos[record.id] = record;
      return record;
    });
  } catch {
    return record;
  }
}

export async function getPhoto(id: string) {
  if (useBlob()) {
    const meta = await readJsonBlob<PhotoRecord>(photoMetaPath(id));
    if (meta?.id) return meta;
  }
  const state = await getState();
  return state.photos[id] ?? (await readGallery()).find((item) => item.id === id) ?? null;
}

export async function listPhotos(roomCode?: string) {
  let photos: PhotoRecord[] = [];
  if (useBlob()) {
    photos = await readGallery();
  }
  if (photos.length === 0) {
    const state = await getState();
    photos = Object.values(state.photos);
  }
  photos.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return roomCode ? photos.filter((photo) => photo.roomCode === roomCode) : photos;
}

export async function deletePhoto(id: string) {
  const existing = await getPhoto(id);
  if (useBlob()) {
    const gallery = await readGallery();
    await writeGallery(gallery.filter((item) => item.id !== id));
  }
  return mutateState(async (state) => {
    const photo = state.photos[id] ?? existing;
    if (!photo) return null;
    delete state.photos[id];
    if (photo.localPath) {
      try {
        await unlink(photo.localPath);
      } catch {
        /* already gone */
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
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await putBoothBlob(`photos/${id}.jpg`, bytes, mimeType);
      return { blobUrl: blob.url };
    } catch (error) {
      if (process.env.VERCEL === "1") {
        const err = new Error("BLOB_REQUIRED");
        (err as Error & { cause?: unknown }).cause = error;
        throw err;
      }
    }
  } else if (process.env.VERCEL === "1") {
    throw new Error("BLOB_REQUIRED");
  }
  return { localPath: await writeLocalPhoto(id, bytes) };
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
  const record: LogoRecord = { mimeType };
  try {
    const blob = await putBoothBlob(
      `logos/${code}.${logoExt(mimeType)}`,
      bytes,
      mimeType,
    );
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
  if (useBlob()) {
    await putBoothBlob(logoMetaPath(code), JSON.stringify(record), "application/json");
  }
  try {
    await mutateState(async (state) => {
      state.logos = state.logos ?? {};
      state.logos[code] = record;
      return record;
    });
  } catch {
    /* meta blob is enough */
  }
  return record;
}

async function getLogoRecord(code: string) {
  if (useBlob()) {
    const meta = await readJsonBlob<LogoRecord>(logoMetaPath(code));
    if (meta?.mimeType) return meta;
    for (const ext of ["png", "jpg", "webp", "gif"]) {
      const file = await fetchBoothFile(`logos/${code}.${ext}`);
      if (file?.stream) {
        const mimeType =
          ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : ext === "gif"
                ? "image/gif"
                : "image/jpeg";
        const url = blobPublicUrl(`logos/${code}.${ext}`);
        return { mimeType, blobUrl: url ?? undefined } satisfies LogoRecord;
      }
    }
  }
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
    const blob = await fetchBoothFile(record.blobUrl);
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
  const existing = await getLogoRecord(code);
  return mutateState(async (state) => {
    const record = state.logos[code] ?? existing;
    if (!record) return null;
    delete state.logos[code];
    if (record.localPath) {
      try {
        await unlink(record.localPath);
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
