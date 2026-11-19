// The only module that touches the local filesystem. Read-only: realpath, stat and a read stream, nothing else.
// test/no-writes.test.ts enforces that these are the only `node:fs` APIs imported here.
import { createReadStream, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

export const DATA_DIR_ENV = "CURITIBAI_DATA_DIR";

export type LocalFileErrorCode = "data_dir_not_set" | "file_not_allowed" | "file_not_found";

export class LocalFileError extends Error {
  constructor(readonly code: LocalFileErrorCode) {
    super(code);
    this.name = "LocalFileError";
  }
}

function realpathOrNull(p: string): string | null {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * Resolves `name` inside the folder named by CURITIBAI_DATA_DIR (read on every call). The real path (symlinks
 * resolved) must be a regular `.csv` file strictly inside the real data folder.
 */
export function resolveDataFile(name: string): { path: string; relative: string } {
  const raw = process.env[DATA_DIR_ENV];
  if (raw === undefined || raw.trim() === "") throw new LocalFileError("data_dir_not_set");
  const dir = realpathOrNull(raw);
  if (dir === null || !statSync(dir).isDirectory()) throw new LocalFileError("data_dir_not_set");
  if (name.includes("\0")) throw new LocalFileError("file_not_allowed");
  const real = realpathOrNull(resolve(dir, name));
  if (real === null) throw new LocalFileError("file_not_found");
  const rel = relative(dir, real);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new LocalFileError("file_not_allowed");
  if (extname(real).toLowerCase() !== ".csv") throw new LocalFileError("file_not_allowed");
  if (!statSync(real).isFile()) throw new LocalFileError("file_not_allowed");
  return { path: real, relative: rel };
}

/** Streams the file in chunks; never loads it whole. */
export function readChunks(path: string): AsyncIterable<Buffer> {
  return createReadStream(path, { highWaterMark: 256 * 1024 });
}
