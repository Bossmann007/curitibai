#!/usr/bin/env node
// Monthly check of the Receita Federal "calculadora de tributos do consumo" version, run by
// .github/workflows/receita-version.yml through scripts/publish-receita-version.sh (never by the MCP server).
// One GET to the Receita open-data "versao" endpoint, one GET per ReceitaFederal calculator repository (latest
// release, GitHub API), then: no previous CURITIBAI_DATA_DIR/receita/version.json -> write it (baseline, no issue);
// same versions -> write nothing; changed -> open one issue in GITHUB_REPOSITORY (unless an open issue has the same
// title), then write the file. Fails closed: any Receita error or unexpected answer exits 1 and changes nothing.
// A failed release lookup keeps the previous tag. The token (GH_TOKEN) goes to api.github.com only.
// Node built-ins only. Prints fixed status lines and version labels, never response bodies. See docs/sources.md.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const RECEITA_URL =
  "https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api/calculadora/dados-abertos/versao";
export const GITHUB_API = "https://api.github.com";
/** The only hosts this script contacts (exact match). */
export const ALLOWED_HOSTS = Object.freeze(["piloto-cbs.tributos.gov.br", "api.github.com"]);
export const RELEASE_REPOS = Object.freeze(["calculadora-rtc-regime-regular", "calculadora-rtc-simples-nacional"]);
export const USER_AGENT = "curitibai-mcp/0.20 (+https://github.com/Bossmann007/curitibai)";
export const VERSION_FILE = "receita/version.json";
export const TIMEOUT_MS = 15_000;
/** Body caps: the Receita version answer is under 1 KB; a page of 100 GitHub issues (bodies included) is far larger. */
export const MAX_BYTES = 64 * 1024;
export const GITHUB_MAX_BYTES = 4 * 1024 * 1024;
export const DESCRIPTION_MAX = 300;
/** Open issues read for the duplicate check: 10 pages of 100. */
export const ISSUE_PAGES_MAX = 10;
const TITLE_PREFIX = "Receita: calculadora mudou";

const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class CheckError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** The body as text, read as a stream and stopped past `cap` bytes (a larger body is an error). */
async function readCapped(res, cap) {
  if (Number(res.headers.get("content-length") ?? 0) > cap) throw new Error("response too large");
  if (!res.body) return "";
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.byteLength;
    if (size > cap) throw new Error("response too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** GET or POST with the project User-Agent, a timeout, no redirect and a size cap; returns { status, data }. */
async function request(fetch, url, { token, method = "GET", body } = {}) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.includes(u.host)) throw new Error(`host not allowed: ${u.host}`);
  const headers = { "user-agent": USER_AGENT, accept: "application/json" };
  if (u.host === "api.github.com") {
    headers.accept = "application/vnd.github+json";
    headers["x-github-api-version"] = "2022-11-28";
    if (token) headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await readCapped(res, u.host === "api.github.com" ? GITHUB_MAX_BYTES : MAX_BYTES);
  if (!(res.headers.get("content-type") ?? "").includes("json")) return { status: res.status, data: undefined };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = undefined;
  }
  return { status: res.status, data };
}

/** Validates the Receita answer; throws CheckError("invalid_response") on any unexpected shape. */
export function parseReceita(data) {
  const ok =
    data &&
    typeof data === "object" &&
    typeof data.versaoApp === "string" &&
    VERSION_RE.test(data.versaoApp) &&
    typeof data.versaoDb === "string" &&
    VERSION_RE.test(data.versaoDb) &&
    typeof data.dataVersaoDb === "string" &&
    DATE_RE.test(data.dataVersaoDb) &&
    !Number.isNaN(Date.parse(`${data.dataVersaoDb}T00:00:00Z`));
  if (!ok) throw new CheckError("invalid_response", "the Receita answer is not the expected version object");
  const desc = typeof data.descricaoVersaoDb === "string" ? data.descricaoVersaoDb : "";
  return {
    versaoApp: data.versaoApp,
    versaoDb: data.versaoDb,
    dataVersaoDb: data.dataVersaoDb,
    descricaoVersaoDb: desc.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, DESCRIPTION_MAX),
  };
}

/** Latest release of one ReceitaFederal repository: { tag, url, published_at }, null when it has none (404). */
async function latestRelease(fetch, repo, token) {
  const { status, data } = await request(fetch, `${GITHUB_API}/repos/ReceitaFederal/${repo}/releases/latest`, { token });
  if (status === 404) return null;
  const prefix = `https://github.com/ReceitaFederal/${repo}/releases/`;
  if (
    status !== 200 ||
    typeof data?.tag_name !== "string" ||
    !VERSION_RE.test(data.tag_name) ||
    typeof data.html_url !== "string" ||
    !data.html_url.startsWith(prefix) ||
    /[\s<>()[\]`]/.test(data.html_url)
  ) {
    throw new Error(`unexpected release answer (HTTP ${status})`);
  }
  return { tag: data.tag_name, url: data.html_url, published_at: typeof data.published_at === "string" ? data.published_at.slice(0, 32) : null };
}

const tagOf = (rec, repo) => rec.releases?.[repo]?.tag ?? "none";

/** Short label used in the issue title: every compared field (app, base, base date, both release tags). */
export function versionLabel(rec) {
  return `app ${rec.versaoApp}, base ${rec.versaoDb} (${rec.dataVersaoDb}), regular ${tagOf(rec, RELEASE_REPOS[0])}, simples ${tagOf(rec, RELEASE_REPOS[1])}`;
}

export function issueTitle(before, after) {
  return `${TITLE_PREFIX} (${versionLabel(before)} → ${versionLabel(after)})`;
}

/** Compared fields: a change in any of them opens an issue. */
function differences(before, after) {
  const rows = [];
  for (const k of ["versaoApp", "versaoDb", "dataVersaoDb"]) {
    if (before[k] !== after[k]) rows.push(`- \`${k}\`: ${before[k]} → ${after[k]}`);
  }
  for (const repo of RELEASE_REPOS) {
    if (tagOf(before, repo) !== tagOf(after, repo)) {
      rows.push(`- \`${repo}\` release: ${tagOf(before, repo)} → ${tagOf(after, repo)}`);
    }
  }
  return rows;
}

function issueBody(before, after) {
  const links = RELEASE_REPOS.map((repo) => {
    const r = after.releases?.[repo];
    return r ? `- ${repo} ${r.tag}: ${r.url}` : `- ${repo}: no release found`;
  });
  return [
    "The monthly check (`.github/workflows/receita-version.yml`) found a new version of the Receita Federal pilot calculator.",
    "",
    "What changed:",
    ...differences(before, after),
    "",
    "Latest releases:",
    ...links,
    "",
    `Source: ${RECEITA_URL}`,
    "",
    "Reminder: review curitibai (`tax_reform_curitiba`, docs/sources.md). The Receita marks the 2027+ rates as",
    "simulated (`simulated: true`, not final rates); check whether this version changed them, the codes or the answer shape.",
  ].join("\n");
}

/** Open issue with the same title, or creates it. Returns "existing" or "created"; throws on failure. */
async function openIssue(fetch, repo, token, title, body) {
  for (let page = 1; page <= ISSUE_PAGES_MAX; page++) {
    const url = `${GITHUB_API}/repos/${repo}/issues?state=open&per_page=100&page=${page}`;
    const list = await request(fetch, url, { token });
    if (list.status !== 200 || !Array.isArray(list.data)) throw new Error(`issue list failed (HTTP ${list.status})`);
    if (list.data.some((i) => i && !i.pull_request && i.title === title)) return "existing";
    if (list.data.length < 100) break;
    if (page === ISSUE_PAGES_MAX) throw new Error("more open issues than the duplicate check reads");
  }
  const made = await request(fetch, `${GITHUB_API}/repos/${repo}/issues`, { token, method: "POST", body: { title, body } });
  if (made.status !== 201) throw new Error(`issue creation failed (HTTP ${made.status})`);
  return "created";
}

function readPrevious(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
  const rec = JSON.parse(text);
  parseReceita(rec);
  const releasesOk =
    rec.releases &&
    typeof rec.releases === "object" &&
    RELEASE_REPOS.every((r) => rec.releases[r] === null || typeof rec.releases[r]?.tag === "string");
  if (!releasesOk) throw new Error("bad shape");
  return rec;
}

function writeRecord(path, rec) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(rec, null, 2)}\n`);
  renameSync(tmp, path);
}

/** One check. Returns { code, exit, issue? }; never throws. */
export async function run({ fetch, now, env, log }) {
  const finish = (code, exit, extra = {}) => {
    log(`check-receita-version: code=${code} exit=${exit}`);
    return { code, exit, ...extra };
  };
  const dataDir = env.CURITIBAI_DATA_DIR;
  const repo = env.GITHUB_REPOSITORY;
  const token = env.GH_TOKEN;
  if (!dataDir || !token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return finish("missing_env", 1);
  }
  const path = join(dataDir, VERSION_FILE);

  let previous;
  try {
    previous = readPrevious(path);
  } catch {
    return finish("previous_unreadable", 1);
  }

  let receita;
  try {
    const { status, data } = await request(fetch, RECEITA_URL);
    if (status !== 200) return finish("receita_unavailable", 1, { status });
    receita = parseReceita(data);
  } catch (e) {
    return finish(e instanceof CheckError ? e.code : "receita_unavailable", 1);
  }

  const releases = {};
  for (const name of RELEASE_REPOS) {
    try {
      releases[name] = await latestRelease(fetch, name, token);
    } catch (e) {
      // With no previous tag there is nothing to keep: a null here would read as "none -> tag" next month.
      if (!previous) {
        log(`check-receita-version: release lookup failed for ${name} (${e.message}); no baseline written`);
        return finish("release_unavailable", 1);
      }
      log(`check-receita-version: release lookup failed for ${name} (${e.message}); keeping the previous tag`);
      releases[name] = previous.releases[name];
    }
  }
  const current = { ...receita, releases, recorded_at: now().toISOString() };

  if (!previous) {
    writeRecord(path, current);
    log(`check-receita-version: baseline ${versionLabel(current)}`);
    return finish("baseline", 0);
  }
  if (differences(previous, current).length === 0) {
    log(`check-receita-version: unchanged ${versionLabel(current)}`);
    return finish("unchanged", 0);
  }

  let issue;
  try {
    issue = await openIssue(fetch, repo, token, issueTitle(previous, current), issueBody(previous, current));
  } catch (e) {
    log(`check-receita-version: ${e.message}; version.json not updated, the next run tries again`);
    return finish("issue_failed", 1);
  }
  writeRecord(path, current);
  log(`check-receita-version: changed ${versionLabel(previous)} -> ${versionLabel(current)} (issue ${issue})`);
  return finish("changed", 0, { issue });
}

if (import.meta.main) {
  const result = await run({
    fetch: globalThis.fetch,
    now: () => new Date(),
    env: process.env,
    log: (line) => process.stdout.write(`${line}\n`),
  });
  process.exitCode = result.exit;
}
