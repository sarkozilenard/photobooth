import { iceServers } from "@/lib/webrtc/config";
import { ControlAction, DeviceRole, SignalMessage } from "@/lib/types";

type SdpInit = RTCSessionDescriptionInit;
type IceInit = RTCIceCandidateInit;

export interface PeerBridge {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  sendControl: (payload: {
    action: ControlAction;
    captureId?: string;
    photoId?: string;
    photoToken?: string;
    value?: number;
    endsAt?: number;
  }) => Promise<void>;
  close: () => void;
}

export async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function createPeerConnection() {
  return new RTCPeerConnection({
    iceServers: iceServers(),
    bundlePolicy: "max-bundle",
  });
}

export async function connectCameraPeer(options: {
  code: string;
  stream: MediaStream;
  onControl: (msg: NonNullable<SignalMessage["control"]>) => void;
  onConnection: (state: RTCPeerConnectionState) => void;
}): Promise<PeerBridge> {
  const pc = createPeerConnection();
  const channel = pc.createDataChannel("booth-control");
  const role: DeviceRole = "camera";
  let lastTs = 0;
  let closed = false;

  options.stream.getTracks().forEach((track) => {
    pc.addTrack(track, options.stream);
  });

  channel.onmessage = (event) => {
    const parsed = JSON.parse(event.data) as SignalMessage["control"];
    if (parsed) options.onControl(parsed);
  };

  pc.onconnectionstatechange = () => options.onConnection(pc.connectionState);

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    void postJson(`/api/rooms/${options.code}/signal`, {
      from: role,
      kind: "ice",
      candidate: event.candidate.toJSON(),
    });
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await postJson(`/api/rooms/${options.code}/signal`, {
    from: role,
    kind: "sdp",
    sdp: offer,
  });

  const sendControl: PeerBridge["sendControl"] = async (payload) => {
    if (channel.readyState === "open") {
      channel.send(JSON.stringify(payload));
    }
    await postJson(`/api/rooms/${options.code}/signal`, {
      from: role,
      kind: "control",
      control: payload,
    });
  };

  const poll = async () => {
    while (!closed) {
      try {
        const res = await fetch(
          `/api/rooms/${options.code}/signal?role=${role}&after=${lastTs}`,
        );
        const data = (await res.json()) as {
          messages: SignalMessage[];
        };
        for (const message of data.messages) {
          lastTs = Math.max(lastTs, message.ts);
          if (message.from === role) continue;
          if (message.kind === "sdp" && message.sdp) {
            await pc.setRemoteDescription(message.sdp as SdpInit);
          }
          if (message.kind === "ice" && message.candidate) {
            try {
              await pc.addIceCandidate(message.candidate as IceInit);
            } catch {
              /* ignore */
            }
          }
          if (message.kind === "control" && message.control) {
            options.onControl(message.control);
          }
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  void poll();
  void heartbeat(options.code, role, () => closed);

  return {
    pc,
    channel,
    sendControl,
    close: () => {
      closed = true;
      pc.close();
    },
  };
}

export async function connectBoothPeer(options: {
  code: string;
  onStream: (stream: MediaStream) => void;
  onControl: (msg: NonNullable<SignalMessage["control"]>) => void;
  onConnection: (state: RTCPeerConnectionState) => void;
}): Promise<PeerBridge> {
  const pc = createPeerConnection();
  const role: DeviceRole = "booth";
  let lastTs = 0;
  let closed = false;
  let channel: RTCDataChannel | null = null;

  pc.addTransceiver("video", { direction: "recvonly" });
  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) options.onStream(stream);
  };
  pc.ondatachannel = (event) => {
    channel = event.channel;
    channel.onmessage = (msg) => {
      const parsed = JSON.parse(msg.data) as SignalMessage["control"];
      if (parsed) options.onControl(parsed);
    };
  };
  pc.onconnectionstatechange = () => options.onConnection(pc.connectionState);
  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    void postJson(`/api/rooms/${options.code}/signal`, {
      from: role,
      kind: "ice",
      candidate: event.candidate.toJSON(),
    });
  };

  const sendControl: PeerBridge["sendControl"] = async (payload) => {
    if (channel?.readyState === "open") {
      channel.send(JSON.stringify(payload));
    }
    await postJson(`/api/rooms/${options.code}/signal`, {
      from: role,
      kind: "control",
      control: payload,
    });
  };

  const poll = async () => {
    while (!closed) {
      try {
        const res = await fetch(
          `/api/rooms/${options.code}/signal?role=${role}&after=${lastTs}`,
        );
        const data = (await res.json()) as { messages: SignalMessage[] };
        for (const message of data.messages) {
          lastTs = Math.max(lastTs, message.ts);
          if (message.from === role) continue;
          if (message.kind === "sdp" && message.sdp?.type === "offer") {
            await pc.setRemoteDescription(message.sdp as SdpInit);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await postJson(`/api/rooms/${options.code}/signal`, {
              from: role,
              kind: "sdp",
              sdp: answer,
            });
          }
          if (message.kind === "ice" && message.candidate) {
            try {
              await pc.addIceCandidate(message.candidate as IceInit);
            } catch {
              /* ignore */
            }
          }
          if (message.kind === "control" && message.control) {
            options.onControl(message.control);
          }
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  void poll();
  void heartbeat(options.code, role, () => closed);

  return {
    pc,
    channel,
    sendControl,
    close: () => {
      closed = true;
      pc.close();
    },
  };
}

async function heartbeat(code: string, role: DeviceRole, isClosed: () => boolean) {
  while (!isClosed()) {
    try {
      await postJson(`/api/rooms/${code}/presence`, { role });
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
}
