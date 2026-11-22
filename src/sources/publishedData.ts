import { TtlCache } from "../cache.js";
import { createHostGate } from "../hostGate.js";
import { fetchText, ResponseTooLargeError, SourceUnavailableError } from "../http.js";
import { LocalFileError } from "../localfs.js";

/**
 * The copy that .github/workflows/collect.yml publishes every night on the repository's `data` branch (facts and links
 * only, the same files scripts/fetch-events.mjs writes). Fixed URLs: nothing from the user's input is ever added.
 */
export const PUBLISHED_ORIGIN = "https://raw.githubusercontent.com";
export const PUBLISHED_PATH_PREFIX = "/Bossmann007/curitibai/data";
export const PUBLISHED_FILES = ["events/events.json", "phones/phones.json"] as const;
export type PublishedFile = (typeof PUBLISHED_FILES)[number];

export function publishedUrl(file: PublishedFile): string {
  return `${PUBLISHED_ORIGIN}${PUBLISHED_PATH_PREFIX}/${file}`;
}

/** `CURITIBAI_REMOTE_DATA=0` (or `off`) turns the published copy off: the tools then read only the local file. */
export const REMOTE_DATA_ENV = "CURITIBAI_REMOTE_DATA";
export const PUBLISHED_CACHE_TTL_MS = 60 * 60 * 1000;
export const PUBLISHED_TIMEOUT_MS = 10_000;

export function remoteDataEnabled(): boolean {
  const v = process.env[REMOTE_DATA_ENV]?.trim().toLowerCase();
  return v !== "0" && v !== "off";
}

/** Where the answer came from. */
export type DataOrigin = "local" | "published";

/** The published file is not there (HTTP 404): the nightly collection has not published it yet. */
export class NotPublishedError extends Error {
  constructor() {
    super("not_published");
    this.name = "NotPublishedError";
  }
}

/** The published file is not JSON; the schema check of the caller throws its own error. */
export class InvalidPublishedError extends Error {
  constructor() {
    super("invalid_published");
    this.name = "InvalidPublishedError";
  }
}

// Validated files only. Two failure memories, 60 s each, no request meanwhile:
// - the host gate: requests at least 1 s apart; after a failure of the host (network error, timeout, an HTTP error
//   other than 404, a 429 with its Retry-After) no request to it for either file;
// - per file: a 404, a body over the cap, a redirect, a body that is not JSON or fails the schema is about that file
//   only, so it never blocks the other file.
export const FILE_FAILURE_WAIT_MS = 60_000;
const newCache = () => new TtlCache(PUBLISHED_CACHE_TTL_MS, () => Date.now());
let cache = newCache();
const gate = createHostGate({ minIntervalMs: 1000, maxQueueWaitMs: 5000 });
const fileFailures = new Map<PublishedFile, { until: number; error: unknown }>();

/** Tests only. */
export function clearPublishedState(): void {
  cache = newCache();
  gate.reset();
  fileFailures.clear();
}

/** Errors of one file, not of the host (decided inside the gate, remembered per file outside it). */
function isFileError(err: unknown): boolean {
  return (
    err instanceof ResponseTooLargeError ||
    (err instanceof SourceUnavailableError && (err.reason === "HTTP 404" || err.reason.includes("redirect")))
  );
}

/**
 * Reads the published `file` (capped at `maxBytes`, same host and path only, no retry), parses it as JSON and passes
 * it to `build`, the same strict validation the local file gets: anything else throws and nothing is returned.
 */
export async function loadPublished<T>(file: PublishedFile, maxBytes: number, build: (json: unknown) => T): Promise<T> {
  const url = publishedUrl(file);
  const { value } = await cache.getOrLoad(url, async () => {
    const remembered = fileFailures.get(file);
    if (remembered !== undefined && Date.now() < remembered.until) throw remembered.error;
    // Host failures are thrown here and remembered by the gate; file failures come back as values.
    const fetched = await gate.run(async (): Promise<{ body: string } | { fileError: unknown }> => {
      try {
        const res = await fetchText(url, {
          maxBytes,
          timeoutMs: PUBLISHED_TIMEOUT_MS,
          sameHostOnly: true,
          redirectPathPrefix: PUBLISHED_PATH_PREFIX,
        });
        return { body: res.body };
      } catch (err) {
        if (isFileError(err)) return { fileError: err };
        throw err;
      }
    });
    try {
      if ("fileError" in fetched) {
        const err = fetched.fileError;
        throw err instanceof SourceUnavailableError && err.reason === "HTTP 404" ? new NotPublishedError() : err;
      }
      let json: unknown;
      try {
        json = JSON.parse(fetched.body);
      } catch {
        throw new InvalidPublishedError();
      }
      return build(json);
    } catch (err) {
      fileFailures.set(file, { until: Date.now() + FILE_FAILURE_WAIT_MS, error: err });
      throw err;
    }
  });
  return value;
}

/**
 * The local file in CURITIBAI_DATA_DIR when there is one (today's behaviour, errors included); otherwise, when the data
 * folder is not set or has no such file and remote reading is on, the published copy. Any other local error (a file
 * that is invalid, too large or not allowed) is thrown as it is: the published copy never hides a broken local file.
 */
export async function loadLocalOrPublished<T>(
  readLocal: () => Promise<T>,
  file: PublishedFile,
  maxBytes: number,
  build: (json: unknown) => T,
): Promise<{ data: T; origin: DataOrigin }> {
  try {
    return { data: await readLocal(), origin: "local" };
  } catch (err) {
    const absent = err instanceof LocalFileError && (err.code === "data_dir_not_set" || err.code === "file_not_found");
    if (!absent || !remoteDataEnabled()) throw err;
  }
  return { data: await loadPublished(file, maxBytes, build), origin: "published" };
}
