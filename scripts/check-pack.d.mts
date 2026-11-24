// Types for scripts/check-pack.mjs, so the tests can import it (the script itself is plain JavaScript).

export const MAX_PACKED_BYTES: number;
export function checkPack(pack: { files: { path: string }[]; size: number }, built?: string[]): string[];
export function scanSecrets(path: string, text: string): string[];
