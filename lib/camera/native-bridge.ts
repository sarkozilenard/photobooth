import { CameraAdapter } from "./types";

/** Placeholder for a later native iPhone camera app / WebRTC SFU module. */
export class NativeCameraBridge implements CameraAdapter {
  id = "native-bridge" as const;

  async start(): Promise<MediaStream> {
    throw new Error("A natív kamera-híd még nincs bekötve.");
  }

  stop() {}

  async captureStill(): Promise<Blob> {
    throw new Error("A natív kamera-híd még nincs bekötve.");
  }
}
