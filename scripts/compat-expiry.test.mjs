// Every COMPAT shim must carry a removal date or a version-floor condition, and no shim may
// outlive its date silently. See docs/protocol-compatibility.md. Shims that predate this rule
// live in compat-expiry.baseline.json keyed by `path::name`; that list can only shrink.
// Regenerate it with COMPAT_EXPIRY_WRITE_BASELINE=1 after dating or deleting entries; the
// writer keeps only entries already present, so the env var cannot admit a new undated shim.
// A missing baseline is an error, not an empty one; seeding needs COMPAT_EXPIRY_SEED_BASELINE=1.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selfPath = path.relative(repoRoot, fileURLToPath(import.meta.url));
const baselinePath = path.join(repoRoot, "scripts", "compat-expiry.baseline.json");
const SOURCE_EXTENSIONS = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/u;
const EXCLUDED_PATH = /(^|\/)(dist|node_modules|generated)\//u;
// Built from parts so this file never contains a literal tag that its own scan would pick up.
const TAG_WORD = ["COM", "PAT"].join("");
const TAG = new RegExp(`${TAG_WORD}\\(([^)]*)\\)`, "u");
const DATE = /\b(20\d{2}-\d{2}-\d{2})\b/gu;
// A date counts as a removal date only when a removal word precedes it; "added 2026-06-11"
// is provenance, not a deadline. The latest removal date wins, so a comment that records a
// lapsed deadline next to the new one is read as the new one.
const REMOVAL_CONTEXT =
  /\b(remove|removed|drop|dropped|delete|deleted|retire|retired|after|until|through|keep|expires?|sunset|target)\b/iu;
const FLOOR = /floor\s+(is\s+)?>=/iu;
const COMMENT_CONTINUATION = /^\s*(\/\/|\*|#)/u;
const EXPIRY_GRACE_DAYS = 14;
const EXPIRING_SOON_DAYS = 30;

export function removalDate(block) {
  let latest = null;
  for (const match of block.matchAll(DATE)) {
    const context = block.slice(Math.max(0, match.index - 60), match.index);
    if (!REMOVAL_CONTEXT.test(context)) continue;
    if (latest === null || match[1] > latest) latest = match[1];
  }
  return latest;
}

export function scanLines(lines, file) {
  const tags = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(TAG);
    if (!match) continue;
    let block = lines[index];
    let next = index + 1;
    while (
      next < lines.length &&
      COMMENT_CONTINUATION.test(lines[next]) &&
      !TAG.test(lines[next])
    ) {
      block += `\n${lines[next]}`;
      next += 1;
    }
    const name = match[1].trim();
    const date = removalDate(block);
    tags.push({
      name,
      file,
      key: `${file}::${name}`,
      location: `${file}:${index + 1}`,
      date,
      dated: date !== null || FLOOR.test(block),
    });
  }
  return tags;
}

function trackedSourceFiles() {
  const output = execFileSync("git", ["ls-files", "-z", "--", "packages", "scripts"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return output
    .split("\0")
    .filter(
      (file) =>
        file && file !== selfPath && SOURCE_EXTENSIONS.test(file) && !EXCLUDED_PATH.test(file),
    );
}

export function collectCompatTags(files = trackedSourceFiles()) {
  return files.flatMap((file) =>
    scanLines(readFileSync(path.join(repoRoot, file), "utf8").split("\n"), file),
  );
}

function isoDaysFromNow(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function readBaseline() {
  if (!existsSync(baselinePath)) return new Set();
  const parsed = JSON.parse(readFileSync(baselinePath, "utf8"));
  assert.ok(Array.isArray(parsed.undated), "baseline must list undated shims as path::name");
  return new Set(parsed.undated);
}

function writeBaseline(currentUndatedKeys) {
  if (!existsSync(baselinePath)) {
    if (process.env.COMPAT_EXPIRY_SEED_BASELINE !== "1") {
      throw new Error(
        `${baselinePath} is missing; restore it from git, or seed it deliberately with COMPAT_EXPIRY_SEED_BASELINE=1 and review the diff.`,
      );
    }
    const undated = Array.from(new Set(currentUndatedKeys)).sort();
    writeFileSync(baselinePath, `${JSON.stringify({ undated }, null, 2)}\n`);
    return;
  }
  const committed = readBaseline();
  const undated = Array.from(
    new Set(currentUndatedKeys.filter((key) => committed.has(key))),
  ).sort();
  writeFileSync(baselinePath, `${JSON.stringify({ undated }, null, 2)}\n`);
}

const tags = collectCompatTags();
const undated = tags.filter((tag) => !tag.dated);

if (process.env.COMPAT_EXPIRY_WRITE_BASELINE === "1") {
  writeBaseline(undated.map((tag) => tag.key));
}

test(`every new ${TAG_WORD} tag names a removal date or version floor`, () => {
  const baseline = readBaseline();
  const unlisted = undated.filter((tag) => !baseline.has(tag.key));
  assert.deepEqual(
    unlisted.map((tag) => `${tag.location} ${TAG_WORD}(${tag.name})`),
    [],
    "Add `remove after YYYY-MM-DD` or `floor >= vX.Y.Z` to these tags; the baseline cannot grow.",
  );
});

test("the undated baseline only shrinks", () => {
  const baseline = readBaseline();
  const stillUndated = new Set(undated.map((tag) => tag.key));
  const stale = Array.from(baseline).filter((key) => !stillUndated.has(key));
  assert.deepEqual(
    stale,
    [],
    "These baseline entries are now dated or gone; prune them with COMPAT_EXPIRY_WRITE_BASELINE=1.",
  );
});

test(`no ${TAG_WORD} tag has outlived its removal date by more than ${EXPIRY_GRACE_DAYS} days`, () => {
  const cutoff = isoDaysFromNow(-EXPIRY_GRACE_DAYS);
  const soon = isoDaysFromNow(EXPIRING_SOON_DAYS);
  const dated = tags.filter((tag) => tag.date !== null);
  const expiringSoon = dated.filter((tag) => tag.date >= cutoff && tag.date <= soon);
  if (expiringSoon.length > 0) {
    console.log(
      `compat-expiry: ${expiringSoon.length} tag(s) reach their removal date within ${EXPIRING_SOON_DAYS} days or are inside the ${EXPIRY_GRACE_DAYS}-day grace window:\n${expiringSoon
        .map((tag) => `  ${tag.date} ${tag.location} ${TAG_WORD}(${tag.name})`)
        .sort()
        .join("\n")}`,
    );
  }
  const expired = dated.filter((tag) => tag.date < cutoff);
  assert.deepEqual(
    expired.map((tag) => `${tag.location} ${TAG_WORD}(${tag.name}) expired ${tag.date}`),
    [],
    "Delete the shim, or re-date it in the same comment with the readback that would close it.",
  );
});

test("the scanner reads multi-line blocks, ignores provenance dates, and keeps the latest deadline", () => {
  const sample = [
    `// ${TAG_WORD}(sampleA): added 2020-01-01,`,
    "// remove after 2099-01-01 once clients catch up.",
    "const a = 1;",
    `// ${TAG_WORD}(sampleB): drop when floor >= v0.2.0`,
    `// ${TAG_WORD}(sampleC): shipped alongside v0.1.0 (2020-01-01); no removal recorded`,
    `// ${TAG_WORD}(sampleD): keep through 2098-06-30 for old clients.`,
    `// ${TAG_WORD}(sampleE): remove after 2099-03-31; we did not delete it after the 2020-09-30 deadline.`,
  ];
  assert.deepEqual(
    scanLines(sample, "x.ts").map(({ name, date, dated }) => ({ name, date, dated })),
    [
      { name: "sampleA", date: "2099-01-01", dated: true },
      { name: "sampleB", date: null, dated: true },
      { name: "sampleC", date: null, dated: false },
      { name: "sampleD", date: "2098-06-30", dated: true },
      { name: "sampleE", date: "2099-03-31", dated: true },
    ],
  );
});
