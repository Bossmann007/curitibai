// Types for scripts/check-release.mjs, so the tests can import it (the script itself is plain JavaScript).

export function releasedVersions(changelog: string): string[];
export function checkRelease(input: { version: string; changelog: string; tags: string[]; branch: string; clone?: boolean }): {
  errors: string[];
  notes: string[];
};
