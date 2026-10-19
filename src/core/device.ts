import { fail, isIsoTimestamp, ok, type Result } from './errors';

export const DEVICE_SURFACES = [
  {
    title: 'Telemetry binding',
    description: 'Use attested device identifiers before granting marketplace or automation permissions.',
  },
  {
    title: 'Execution provenance',
    description: 'Record where a proof or AI action originated before monetization or settlement.',
  },
  {
    title: 'Operational controls',
    description: 'Gate higher-risk actions behind user-owned wallets and verified hardware context.',
  },
] as const;

export const DEVICE_KINDS = ['smart-meter', 'inverter', 'battery', 'sensor', 'gateway', 'other'] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/** Self-reported device description. Not evidence of device identity. */
export type DeviceMetadata = {
  id: string;
  kind: DeviceKind;
  manufacturer: string | null;
  model: string | null;
  registeredAt: string;
};

export function validateDeviceMetadata(value: unknown): Result<DeviceMetadata> {
  const d = value as Partial<DeviceMetadata> | null;
  if (!d || typeof d !== 'object') return fail('INVALID_INPUT', 'Device metadata must be an object.');
  if (typeof d.id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(d.id)) {
    return fail('INVALID_INPUT', 'Device id must be 1-128 characters of letters, digits and . _ : -.');
  }
  if (!DEVICE_KINDS.includes(d.kind as DeviceKind)) return fail('UNSUPPORTED', `Unsupported device kind: ${String(d.kind)}`);
  for (const key of ['manufacturer', 'model'] as const) {
    const v = d[key];
    if (v !== null && v !== undefined && (typeof v !== 'string' || !v.trim() || v.length > 120)) {
      return fail('INVALID_INPUT', `Device ${key} must be null or a non-empty string up to 120 characters.`);
    }
  }
  if (!isIsoTimestamp(d.registeredAt)) return fail('INVALID_INPUT', 'Device registration time must be ISO-8601.');
  return ok({
    id: d.id,
    kind: d.kind as DeviceKind,
    manufacturer: d.manufacturer ?? null,
    model: d.model ?? null,
    registeredAt: d.registeredAt,
  });
}

/** Provider boundary for real hardware attestation (secure element, TPM, signed telemetry...). */
export interface DeviceAttestationProvider {
  verify(device: DeviceMetadata, evidence: Uint8Array): Promise<Result<{ deviceId: string; attestedAt: string }>>;
}

/**
 * Without a provider no attestation is possible. This never returns success on its own.
 */
export async function verifyDeviceAttestation(
  device: DeviceMetadata,
  evidence: Uint8Array,
  provider?: DeviceAttestationProvider
) {
  if (!provider) return fail<{ deviceId: string; attestedAt: string }>('UNAVAILABLE', 'No device attestation provider is configured; the device is unattested.');
  const valid = validateDeviceMetadata(device);
  if (!valid.ok) return valid;
  return provider.verify(valid.value, evidence);
}
