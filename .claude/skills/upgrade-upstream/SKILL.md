---
name: upgrade-upstream
description: Integrate a newer upstream getpaseo/paseo stable release into this downstream fork. Use when the user says "upgrade upstream", "update to the new Paseo version", "merge upstream", "lên version mới", "update lên 0.9", "cập nhật upstream", names an upstream tag such as v0.9.0, asks whether the fork can take a newer upstream release, or invokes "/upgrade-upstream".
user-invocable: true
---

# Upgrade upstream

Follow `docs/upstream-integration.md` end-to-end. It owns the procedure, the fixed resolution rules,
and the list of false-red tests. Read the newest `docs/research/upstream-v*-stable-integration-*.md`
first: it records what the previous integration decided and which gates it could not run.

## Before touching anything

1. Pick the target. Only stable tags. If the user named none, list upstream tags
   (`git ls-remote --tags https://github.com/getpaseo/paseo.git`) and take the newest stable one above
   the current base. Never merge upstream `main` or a beta tag.
2. Run `./scripts/upstream-integration.sh survey <tag>`. Report the commit counts, conflict map per
   package, upstream version, and license to the user before merging.
3. The live daemon on this kind of setup may execute straight from this checkout's
   `packages/server/dist`. Check `paseo daemon status --json` and where `~/.local/bin/paseo` points.
   If it does, say so before the first build: every `npm run build:server` rewrites the code that
   daemon spawns workers from.

## While resolving

- Work on `integrate-upstream-<tag>`, never on `main`.
- Resolve in dependency order: manifests and docs, then `protocol`, `client`, `server`, `cli`, `app`.
- Apply the resolution rules table in the doc. For a conflict it does not cover, extract the three
  stages (`git show :1:<path>`, `:2:`, `:3:`), diff each side against the base to see what each side
  intended, keep both intents, and add the new rule to the doc.
- When upstream rewrote a module the fork had patched, start from upstream's version and graft the
  fork's delta onto it. Do not keep the fork's old structure.
- When upstream moved code out of a conflicted file, find where it went and port the fork's change
  there. Deleting the fork's side of the conflict loses behavior silently.
- Test files where both sides inserted a test at the same spot: keep both tests.
- After the last marker is gone, run the two audits in the doc (unauthorized run entrypoints, widened
  permissions) and report what changed in authority, even when you keep upstream's behavior.

## Verification

Run the doc's build, typecheck, lint, and `./scripts/upstream-integration.sh run-tests <base>`. Never
run a whole workspace suite locally. A red test is real only after the false-red causes in the doc
are excluded. A test that fails against an upstream-only implementation too is an environment or
provider-set problem, not a merge regression: fix the test for the downstream provider set.

Get an independent review of the hand-resolved hunks (`git show <merge> --cc -- <path>`) before
merging to `main`.

## Stop and ask the Human

- Before restarting the live daemon.
- Before pushing or fast-forwarding `main`.
- When upstream changes license, removes a downstream contract, or widens a permission in a way the
  doc has no rule for.

## Done means

Merge commit with two parents, separate release commit `X.Y.Z-paseo.N` on the new stable core,
`foundation/sources.lock.json` pointing at the tag's peeled commit, the integration record written and
indexed, `npm run build:daemon-web-ui` rebuilt, and a report listing every gate that did not run.
