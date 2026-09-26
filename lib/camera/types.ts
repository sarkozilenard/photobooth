export type CameraStatus = "idle" | "connecting" | "live" | "error";

export interface CameraAdapter {
  id: "local" | "webrtc-phone" | "native-bridge";
  start(): Promise<MediaStream>;
  stop(): void;
  captureStill(): Promise<Blob>;
}

export interface CaptureRequest {
  captureId: string;
  quality: number;
  maxEdge: number;
}
