export interface RingLightDriver {
  id: string;
  setPower(on: boolean): Promise<void>;
  pulse?(ms?: number): Promise<void>;
}

export class VisualRingLight implements RingLightDriver {
  id = "visual";
  async setPower() {}
  async pulse() {}
}

export class WebhookRingLight implements RingLightDriver {
  id = "webhook";
  constructor(private url: string) {}

  async setPower(on: boolean) {
    await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: "ring-light", power: on }),
    });
  }

  async pulse(ms = 180) {
    await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: "ring-light", pulseMs: ms }),
    });
  }
}

export function createRingLightDriver(): RingLightDriver {
  const url = process.env.NEXT_PUBLIC_RING_LIGHT_WEBHOOK;
  if (url) return new WebhookRingLight(url);
  return new VisualRingLight();
}
