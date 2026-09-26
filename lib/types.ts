export type DeviceRole = "booth" | "camera";

export type PhotoStatus = "uploading" | "ready" | "failed";

export type ControlAction =
  | "start-countdown"
  | "capture"
  | "photo-ready"
  | "hello"
  | "renegotiate";

export type FrameStyle = "none" | "booth" | "gold" | "minimal" | "classic";
export type LayoutStyle = "strip" | "grid";

export interface BoothSettings {
  name: string;
  eventCaption: string;
  jpegQuality: number;
  maxEdge: number;
  soundsEnabled: boolean;
  flashEnabled: boolean;
  ringLightAlwaysOn: boolean;
  countdownSeconds: number;
  photosPerRound: number;
  frameStyle: FrameStyle;
  layoutStyle: LayoutStyle;
  hasLogo: boolean;
  logoPublicPath?: string;
}

export interface RoomRecord {
  code: string;
  createdAt: string;
  cameraLastSeen: number;
  boothLastSeen: number;
  iceRestartNonce: number;
}

export interface PhotoRecord {
  id: string;
  roomCode: string;
  createdAt: string;
  status: PhotoStatus;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  token: string;
  blobUrl?: string;
  localPath?: string;
  dataBase64?: string;
  captureId?: string;
}

export interface SignalMessage {
  id: string;
  roomCode: string;
  from: DeviceRole;
  kind: "sdp" | "ice" | "control";
  ts: number;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  control?: {
    action: ControlAction;
    captureId?: string;
    photoId?: string;
    photoToken?: string;
    value?: number;
    endsAt?: number;
  };
}

export interface LogoRecord {
  mimeType: string;
  blobUrl?: string;
  localPath?: string;
  dataBase64?: string;
}

export interface AppState {
  version: number;
  rooms: Record<string, RoomRecord>;
  photos: Record<string, PhotoRecord>;
  settings: Record<string, BoothSettings>;
  signals: Record<string, SignalMessage[]>;
  logos: Record<string, LogoRecord>;
}

export const DEFAULT_SETTINGS: BoothSettings = {
  name: "PHOTO BOOTH",
  eventCaption: "",
  jpegQuality: 0.92,
  maxEdge: 2560,
  soundsEnabled: true,
  flashEnabled: true,
  ringLightAlwaysOn: true,
  countdownSeconds: 3,
  photosPerRound: 3,
  frameStyle: "booth",
  layoutStyle: "strip",
  hasLogo: false,
  logoPublicPath: "",
};

export const FUTURE_MODULES = [
  "session-burst",
  "collage",
  "gif",
  "boomerang",
  "frames",
  "watermark",
  "event-branding",
  "background-replace",
  "social-crop",
  "qr-gallery",
] as const;
