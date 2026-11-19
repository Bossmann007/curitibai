// The only module that touches the local filesystem. Read-only: realpath, stat, open for reading, fstat, positional
// reads from that descriptor, and close. test/no-writes.test.ts enforces that these are the only `node:fs` APIs here.
import { closeSync, constants, fstatSync, openSync, read, realpathSync, statSync } from "node:fs";
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

/** True when `p` is strictly below `dir` (both absolute). */
function isInside(dir: string, p: string): boolean {
  const rel = relative(dir, p);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

// O_NONBLOCK: opening a FIFO for reading would otherwise block (synchronously) until a writer appears; it is then
// rejected by the regular-file check below. It has no effect on reads from regular files.
const OPEN_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);

/**
 * Opens `real` read-only, without following a final symbolic link (O_NOFOLLOW) or blocking (O_NONBLOCK), then checks the open descriptor itself: a regular file,
 * and the same file (device and inode) that `real` still names, with `real` unchanged and inside `dir`. A swap made
 * after the path checks therefore fails instead of reading another file. Exported for tests.
 */
export function openVerified(real: string, dir: string): number {
  let fd: number;
  try {
    fd = openSync(real, OPEN_FLAGS);
  } catch (err) {
    const code = (err as { code?: string }).code;
    throw new LocalFileError(code === "ENOENT" ? "file_not_found" : "file_not_allowed");
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new LocalFileError("file_not_allowed");
    const again = realpathOrNull(real);
    if (again !== real || !isInside(dir, again)) throw new LocalFileError("file_not_allowed");
    const now = statSync(again);
    if (now.dev !== st.dev || now.ino !== st.ino) throw new LocalFileError("file_not_allowed");
    return fd;
  } catch (err) {
    closeFile(fd);
    throw err instanceof LocalFileError ? err : new LocalFileError("file_not_allowed");
  }
}

/**
 * Opens `name` inside the folder named by CURITIBAI_DATA_DIR (read on every call). Anything that points outside the
 * folder, lexically or after resolving symlinks, is `file_not_allowed` whether or not it exists. The target must be a
 * regular `.csv` file. Returns an open read-only descriptor; the caller closes it with `closeFile`.
 */
export function openDataFile(name: string): { fd: number; relative: string } {
  const raw = process.env[DATA_DIR_ENV];
  if (raw === undefined || raw.trim() === "") throw new LocalFileError("data_dir_not_set");
  const dir = realpathOrNull(raw);
  if (dir === null || !statSync(dir).isDirectory()) throw new LocalFileError("data_dir_not_set");
  if (name.includes("\0")) throw new LocalFileError("file_not_allowed");
  const candidate = resolve(dir, name);
  if (!isInside(dir, candidate)) throw new LocalFileError("file_not_allowed"); // before touching the path
  const real = realpathOrNull(candidate);
  if (real === null) throw new LocalFileError("file_not_found");
  if (!isInside(dir, real)) throw new LocalFileError("file_not_allowed");
  if (extname(real).toLowerCase() !== ".csv") throw new LocalFileError("file_not_allowed");
  return { fd: openVerified(real, dir), relative: relative(dir, real) };
}

const CHUNK_BYTES = 256 * 1024;

/**
 * Reads the open file from its start in chunks (positional reads, so it can be read again from 0); never loads it
 * whole. Each chunk is only valid until the next one is requested. Leaves the descriptor open.
 */
export async function* readChunks(fd: number): AsyncGenerator<Buffer> {
  const buf = Buffer.allocUnsafe(CHUNK_BYTES);
  let pos = 0;
  for (;;) {
    const n = await new Promise<number>((done, fail) =>
      read(fd, buf, 0, CHUNK_BYTES, pos, (err, bytes) => (err ? fail(err) : done(bytes))),
    );
    if (n === 0) return;
    pos += n;
    yield buf.subarray(0, n);
  }
}

/** Closes the descriptor. A failed close is ignored so it never replaces the error that led here. */
export function closeFile(fd: number): void {
  try {
    closeSync(fd);
  } catch {
    // nothing useful to do; the descriptor is gone either way
  }
}
