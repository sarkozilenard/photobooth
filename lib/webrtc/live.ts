"use client";

import Peer, { DataConnection, MediaConnection } from "peerjs";
import { iceServers } from "@/lib/webrtc/config";
import { ControlAction, SignalMessage } from "@/lib/types";

export type ControlPayload = NonNullable<SignalMessage["control"]>;

export interface LiveLink {
  sendControl: (payload: ControlPayload) => Promise<void>;
  sendPhotoFile: (blob: Blob, meta: ControlPayload) => Promise<void>;
  replaceTrack: (track: MediaStreamTrack) => Promise<void>;
  close: () => void;
}

function peerName(code: string, role: "booth" | "camera") {
  const host = window.location.hostname.replace(/[^a-z0-9]/gi, "").slice(0, 24);
  return `pb2-${host}-${code}-${role === "booth" ? "b" : "c"}`.toLowerCase();
}

function attemptPeer(id: string) {
  return new Promise<Peer>((resolve, reject) => {
    const peer = new Peer(id, {
      debug: 0,
      config: { iceServers: iceServers() },
    });
    const timer = window.setTimeout(() => {
      peer.destroy();
      reject(new Error("A jelzőszerver nem válaszol."));
    }, 12000);
    peer.on("open", () => {
      window.clearTimeout(timer);
      resolve(peer);
    });
    peer.on("error", (error) => {
      window.clearTimeout(timer);
      peer.destroy();
      reject(error);
    });
  });
}

async function openPeer(id: string) {
  let last: unknown;
  for (let i = 0; i < 4; i += 1) {
    try {
      return await attemptPeer(id);
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("Peer kapcsolat sikertelen");
}

function bindData(
  conn: DataConnection,
  onControl: (msg: ControlPayload) => void,
  onPhoto?: (blob: Blob, meta: ControlPayload) => void,
) {
  conn.on("data", (data) => {
    if (data instanceof ArrayBuffer) return;
    if (typeof data !== "object" || data === null) return;
    const msg = data as {
      kind?: string;
      control?: ControlPayload;
      photo?: string;
      mime?: string;
    };
    if (msg.kind === "photo" && msg.photo && msg.control && onPhoto) {
      const bytes = Uint8Array.from(atob(msg.photo), (c) => c.charCodeAt(0));
      onPhoto(new Blob([bytes], { type: msg.mime || "image/jpeg" }), msg.control);
      return;
    }
    if (msg.kind === "control" && msg.control) onControl(msg.control);
  });
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
  const boothId = peerName(options.code, "booth");
  const peer = await openPeer(peerName(options.code, "camera"));
  let conn: DataConnection | null = null;
  let call: MediaConnection | null = null;
  let closed = false;

  const sendControl: LiveLink["sendControl"] = async (payload) => {
    conn?.send({ kind: "control", control: payload });
  };

  const connect = () => {
    if (closed) return;
    options.onStatus("iPad keresése…");
    try {
      conn = peer.connect(boothId, { reliable: true });
      conn.on("open", () => options.onStatus("vezérlés kész"));
      bindData(conn, options.onControl);
      conn.on("error", () => {
        if (!closed) window.setTimeout(connect, 2000);
      });
      call = peer.call(boothId, options.stream);
      call?.on("error", () => {
        if (!closed) window.setTimeout(connect, 2000);
      });
    } catch {
      window.setTimeout(connect, 2000);
    }
  };

  peer.on("error", (error) => {
    const type = (error as { type?: string }).type;
    if (type === "peer-unavailable" || type === "network" || type === "disconnected") {
      options.onStatus("újracsatlakozás…");
      if (!closed) window.setTimeout(connect, 2000);
    } else {
      options.onStatus(error.message || "kapcsolati hiba");
    }
  });

  connect();
  const retry = window.setInterval(() => {
    if (closed) return;
    if (conn?.open && call) return;
    connect();
  }, 4000);

  return {
    sendControl,
    sendPhotoFile: async (blob, meta) => {
      if (!conn?.open) return;
      const photo = await blobToBase64(blob);
      conn.send({ kind: "photo", photo, mime: blob.type, control: meta });
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
  const peer = await openPeer(peerName(options.code, "booth"));
  const conns = new Set<DataConnection>();
  let media: MediaConnection | null = null;
  let closed = false;

  peer.on("connection", (incoming) => {
    conns.add(incoming);
    incoming.on("open", () => options.onStatus("iPhone csatlakozott"));
    bindData(
      incoming,
      options.onControl,
      options.onPhoto,
    );
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

  peer.on("open", () => options.onStatus("várja az iPhone-t"));

  return {
    sendControl: async (payload) => {
      conns.forEach((item) => {
        if (item.open) item.send({ kind: "control", control: payload });
      });
    },
    sendPhotoFile: async () => undefined,
    replaceTrack: async () => undefined,
    close: () => {
      closed = true;
      void closed;
      media?.close();
      conns.forEach((item) => item.close());
      peer.destroy();
    },
  };
}
