"use client";

import Peer, { DataConnection, MediaConnection } from "peerjs";
import { iceServers } from "@/lib/webrtc/config";
import { SignalMessage } from "@/lib/types";

export type ControlPayload = NonNullable<SignalMessage["control"]>;

export interface LiveLink {
  sendControl: (payload: ControlPayload) => Promise<void>;
  sendPhotoFile: (blob: Blob, meta: ControlPayload) => Promise<void>;
  replaceTrack: (track: MediaStreamTrack) => Promise<void>;
  setShareFile?: (blob: Blob | null) => void;
  close: () => void;
}

const peerOptions = () => ({
  debug: 0 as const,
  config: { iceServers: iceServers() },
});

export function boothPeerId(code: string) {
  const host = window.location.hostname.replace(/[^a-z0-9]/gi, "").slice(0, 20);
  return `pb3-${host}-${code.toLowerCase()}-b`;
}

function isTaken(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const type = (error as { type?: string }).type;
  return type === "unavailable-id" || /is taken/i.test(message);
}

function attemptPeer(id?: string) {
  return new Promise<Peer>((resolve, reject) => {
    const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    const timer = window.setTimeout(() => {
      peer.destroy();
      reject(new Error("A jelzőszerver nem válaszol."));
    }, 15000);
    peer.on("open", () => {
      window.clearTimeout(timer);
      resolve(peer);
    });
    peer.on("error", (error) => {
      window.clearTimeout(timer);
      try {
        peer.destroy();
      } catch {
        /* ignore */
      }
      reject(error);
    });
  });
}

async function openBoothPeer(id: string) {
  let last: unknown;
  for (let i = 0; i < 6; i += 1) {
    try {
      return await attemptPeer(id);
    } catch (error) {
      last = error;
      const wait = isTaken(error) ? 2500 * (i + 1) : 800 * (i + 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last instanceof Error ? last : new Error("Az iPad peer ID foglalt. Frissítsd az iPad booth oldalt, várj 10 másodpercet, majd próbáld újra.");
}

async function openCameraPeer() {
  return attemptPeer();
}

function bindData(
  conn: DataConnection,
  onControl: (msg: ControlPayload) => void,
  onPhoto?: (blob: Blob, meta: ControlPayload) => void,
  getShare?: () => Blob | null,
) {
  conn.on("data", (data) => {
    let payload: unknown = data;
    if (typeof data === "string") {
      try {
        payload = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (payload instanceof ArrayBuffer) return;
    if (typeof payload !== "object" || payload === null) return;
    const msg = payload as {
      kind?: string;
      control?: ControlPayload;
      photo?: string;
      mime?: string;
    };
    if (msg.kind === "want-share") {
      const blob = getShare?.() ?? null;
      void (async () => {
        if (!blob) {
          emit(conn, { kind: "share-empty" });
          return;
        }
        const photo = await blobToBase64(blob);
        const slice = 8000;
        const total = Math.ceil(photo.length / slice);
        emit(conn, { kind: "share-begin", mime: blob.type || "image/jpeg", total });
        for (let i = 0; i < total; i += 1) {
          emit(conn, {
            kind: "share-part",
            i,
            data: photo.slice(i * slice, (i + 1) * slice),
          });
        }
        emit(conn, { kind: "share-end" });
      })();
      return;
    }
    if (msg.kind === "photo" && msg.photo && msg.control && onPhoto) {
      const bytes = Uint8Array.from(atob(msg.photo), (c) => c.charCodeAt(0));
      onPhoto(new Blob([bytes], { type: msg.mime || "image/jpeg" }), msg.control);
      return;
    }
    if (msg.kind === "control" && msg.control) onControl(msg.control);
  });
}

function emit(conn: DataConnection, body: unknown) {
  if (!conn.open) return;
  conn.send(JSON.stringify(body));
}

async function postControl(
  code: string,
  from: "booth" | "camera",
  control: ControlPayload,
) {
  try {
    await fetch(`/api/rooms/${code}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, kind: "control", control }),
    });
  } catch {
    /* offline retry happens via PeerJS */
  }
}

async function pollControls(
  code: string,
  role: "booth" | "camera",
  isClosed: () => boolean,
  onControl: (msg: ControlPayload) => void,
) {
  let after = Date.now();
  while (!isClosed()) {
    try {
      const res = await fetch(`/api/rooms/${code}/signal?role=${role}&after=${after}`);
      const data = (await res.json()) as {
        messages?: { ts: number; from?: string; kind?: string; control?: ControlPayload }[];
      };
      for (const message of data.messages ?? []) {
        after = Math.max(after, message.ts);
        if (message.from === role) continue;
        if (message.kind === "control" && message.control) onControl(message.control);
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function startCameraLive(options: {
  code: string;
  stream: MediaStream;
  onControl: (msg: ControlPayload) => void;
  onStatus: (text: string) => void;
}): Promise<LiveLink> {
  const boothId = boothPeerId(options.code);
  const peer = await openCameraPeer();
  let conn: DataConnection | null = null;
  let call: MediaConnection | null = null;
  let closed = false;
  let linking = false;

  const sendControl: LiveLink["sendControl"] = async (payload) => {
    if (conn) emit(conn, { kind: "control", control: payload });
    void postControl(options.code, "camera", payload);
  };

  const connect = () => {
    if (closed || linking) return;
    if (conn?.open) return;
    linking = true;
    options.onStatus("iPad keresése…");
    try {
      conn?.close();
      call?.close();
      conn = peer.connect(boothId, { reliable: true });
      conn.on("open", () => {
        linking = false;
        options.onStatus("vezérlés kész");
      });
      bindData(conn, options.onControl);
      conn.on("error", () => {
        linking = false;
      });
      conn.on("close", () => {
        linking = false;
      });
      call = peer.call(boothId, options.stream);
      call?.on("stream", () => options.onStatus("élő kép az iPadnek"));
      call?.on("error", () => {
        linking = false;
      });
      call?.on("close", () => {
        linking = false;
      });
      window.setTimeout(() => {
        linking = false;
      }, 3000);
    } catch {
      linking = false;
    }
  };

  peer.on("error", (error) => {
    const type = error.type;
    if (type === "peer-unavailable") {
      options.onStatus("az iPad booth még nem elérhető, újrapróbálás…");
    } else if (type === "network" || type === "disconnected" || type === "socket-closed") {
      options.onStatus("újracsatlakozás…");
    } else {
      options.onStatus(error.message || "kapcsolati hiba");
    }
  });

  connect();
  const retry = window.setInterval(connect, 5000);
  void pollControls(options.code, "camera", () => closed, options.onControl);

  return {
    sendControl,
    sendPhotoFile: async (blob, meta) => {
      if (conn?.open) {
        const photo = await blobToBase64(blob);
        emit(conn, { kind: "photo", photo, mime: blob.type, control: meta });
      }
    },
    replaceTrack: async (track) => {
      const pc = call?.peerConnection;
      const sender = pc?.getSenders().find((item) => item.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
    },
    close: () => {
      closed = true;
      window.clearInterval(retry);
      conn?.close();
      call?.close();
      peer.destroy();
    },
  };
}

export async function startBoothLive(options: {
  code: string;
  onStream: (stream: MediaStream) => void;
  onControl: (msg: ControlPayload) => void;
  onPhoto: (blob: Blob, meta: ControlPayload) => void;
  onStatus: (text: string) => void;
}): Promise<LiveLink> {
  const peer = await openBoothPeer(boothPeerId(options.code));
  const conns = new Set<DataConnection>();
  let media: MediaConnection | null = null;
  let shareBlob: Blob | null = null;

  peer.on("connection", (incoming) => {
    conns.add(incoming);
    incoming.on("open", () => options.onStatus("készülék csatlakozott"));
    bindData(incoming, options.onControl, options.onPhoto, () => shareBlob);
    incoming.on("close", () => conns.delete(incoming));
  });

  peer.on("call", (incoming) => {
    media = incoming;
    incoming.answer();
    incoming.on("stream", (stream) => {
      options.onStream(stream);
      options.onStatus("élő kép");
    });
  });

  options.onStatus("várja az iPhone-t");
  let closed = false;
  void pollControls(options.code, "booth", () => closed, options.onControl);

  return {
    sendControl: async (payload) => {
      conns.forEach((item) => emit(item, { kind: "control", control: payload }));
      void postControl(options.code, "booth", payload);
    },
    sendPhotoFile: async () => undefined,
    replaceTrack: async () => undefined,
    setShareFile: (blob) => {
      shareBlob = blob;
    },
    close: () => {
      closed = true;
      media?.close();
      conns.forEach((item) => item.close());
      peer.destroy();
    },
  };
}

export async function pullShareFromBooth(
  code: string,
  onStatus: (text: string) => void,
) {
  const boothId = boothPeerId(code);
  const peer = await openCameraPeer();
  return new Promise<Blob>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      peer.destroy();
      reject(new Error("Az iPad nem válaszol. Hagyd nyitva a QR-t a boothon."));
    }, 28000);
    const parts: string[] = [];
    let total = 0;
    const conn = peer.connect(boothId, { reliable: true });
    conn.on("open", () => {
      onStatus("Kapcsolódva, fotó kérése…");
      emit(conn, { kind: "want-share" });
    });
    conn.on("error", () => {
      window.clearTimeout(timer);
      peer.destroy();
      reject(new Error("Nem sikerült kapcsolódni az iPadhez."));
    });
    conn.on("data", (data) => {
      let payload: unknown = data;
      if (typeof data === "string") {
        try {
          payload = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (typeof payload !== "object" || payload === null) return;
      const msg = payload as {
        kind?: string;
        total?: number;
        i?: number;
        data?: string;
        mime?: string;
      };
      if (msg.kind === "share-empty") {
        window.clearTimeout(timer);
        peer.destroy();
        reject(new Error("Nincs kész fotó. A boothon nyisd meg a QR-t a fotó után."));
        return;
      }
      if (msg.kind === "share-begin") {
        total = Number(msg.total) || 0;
        onStatus("Fotó érkezik…");
        return;
      }
      if (msg.kind === "share-part" && typeof msg.i === "number" && msg.data) {
        parts[msg.i] = msg.data;
        return;
      }
      if (msg.kind === "share-end") {
        window.clearTimeout(timer);
        if (total && parts.filter(Boolean).length < total) {
          peer.destroy();
          reject(new Error("A fotó hiányosan jött át. Próbáld újra."));
          return;
        }
        const bytes = Uint8Array.from(atob(parts.join("")), (c) => c.charCodeAt(0));
        peer.destroy();
        resolve(new Blob([bytes], { type: "image/jpeg" }));
      }
    });
  });
}
