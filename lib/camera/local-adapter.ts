import { CameraAdapter } from "./types";

export class LocalCameraAdapter implements CameraAdapter {
  id = "local" as const;
  private stream: MediaStream | null = null;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    return this.stream;
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  async captureStill(): Promise<Blob> {
    throw new Error("Használd a captureFromVideo helper-t.");
  }
}
