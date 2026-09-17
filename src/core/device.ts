export type DeviceSignal = {
  title: string;
  detail: string;
};

export const DEVICE_SIGNALS: DeviceSignal[] = [
  {
    title: "Telemetry integrity",
    detail: "Device-originated payloads should be attested before entering marketplace or AI workflows.",
  },
  {
    title: "Permissioned access",
    detail: "Every downstream consumer should inherit the original device access policy and proof context.",
  },
];
