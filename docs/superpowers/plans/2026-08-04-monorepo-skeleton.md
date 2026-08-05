# Monorepo Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the two LodgeFlow repositories into a single pnpm workspace with both apps building, testing, and deploying — without changing a single line of application code.

**Architecture:** The existing admin repository becomes the monorepo root. Its contents move to `apps/admin/`, and the customer repository is grafted in at `apps/customer/` via `git subtree add`, preserving both commit histories. Each app keeps its own `models/`, `lib/`, `tsconfig.json`, `jest.config.js`, `next.config.js`, and `@/*` → `./*` path alias, so every existing import continues to resolve unchanged. Genuinely shared tooling (Prettier, Husky, lint-staged, `.npmrc`, CI) consolidates at the root. No `packages/` directory is created — that is Step 2.

**Tech Stack:** pnpm 11.17.0 workspaces, Next.js 16, Node 22, Jest, GitHub Actions, Vercel.

## Global Constraints

- **This step changes no application code.** No file under `app/`, `components/`, `hooks/`, `lib/`, `models/`, `types/`, or `utils/` in either app has its *contents* modified. Files move; their bodies do not change. The one permitted exception is `next.config.js` in each app, which needs `outputFileTracingRoot` (Task 2, Step 7).
- **Both apps' existing test suites must pass unchanged at every task boundary.** This is the migration's only safety net. A task that leaves either suite red is not complete.
- **Both commit histories are preserved.** Use `git subtree add`, never a squashed copy. Target: 484 commits total (297 admin + 187 customer) plus the migration's own commits.
- **No schema, model, or validation changes.** Reconciling the diverged `Booking`, `Cabin`, and `Settings` schemas is Step 2 of the spec and is explicitly out of scope here. If you notice a divergence, leave it alone.
- **pnpm version is pinned to `11.17.0`** (from the customer app's `packageManager` field). CI and local dev must agree.
- **Node 22** in CI, matching both existing workflows and the admin Vercel project's `nodeVersion: 22.x`.
- **Package names:** root is `lodgeflow-monorepo` (private), apps are `@lodgeflow/admin` and `@lodgeflow/customer`. Both `package.json` files are currently named `lodgeflow`, which is a hard collision in a workspace and must be resolved in Task 1 and Task 2.
- **Spec reference:** `docs/superpowers/specs/2026-08-04-monorepo-and-admin-gap-closure-design.md`, "Build order" step 1.

---

## File Structure

**Created at root:**

| File | Responsibility |
| --- | --- |
| `package.json` | Private root manifest. `packageManager`, workspace-wide scripts, the npm-style `overrides` mirror, and shared devDependencies (`husky`, `lint-staged`, `prettier`). |
| `pnpm-workspace.yaml` | Workspace globs plus the **merged** `overrides`, `allowBuilds`, and `onlyBuiltDependencies` from both apps' current files. |
| `.npmrc` | Merged: the admin's `public-hoist-pattern` for HeroUI plus the customer's registry line. |
| `.prettierrc`, `.prettierignore`, `.editorconfig` | Shared formatting. Both apps' copies are identical today and are deleted in favor of these. |
| `.lintstagedrc.json` | Root lint-staged config, in the **correct** shape (see Task 3). |
| `.husky/pre-commit` | Single hook for the whole workspace. |
| `.github/workflows/ci.yml` | One workflow, matrixed over both apps. |
| `.gitignore` | Root ignore rules. |

**Moved, not modified:**

- Everything currently at the admin repo root → `apps/admin/`, **except** `docs/`, `.github/`, and `LICENSE`, which describe the repository rather than the app and stay at the root
- Everything currently at the customer repo root → `apps/customer/`

**Deleted after consolidation:** each app's `.prettierrc`, `.prettierignore`, `.editorconfig`, `.lintstagedrc.json`, `.husky/`, `.github/workflows/ci.yml`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`.

**Kept per-app (deliberately):** `tsconfig.json`, `jest.config.js`, `jest.setup.js`, `next.config.js`, `postcss.config.js`, `eslint.config.mjs`, `vercel.json` (admin only), `.vercelignore` (customer only), `tailwind.config.*`, `public/`, `styles/`, `scripts/`, `__tests__/`, `CLAUDE.md`.

ESLint configs stay per-app because the two files differ and merging them is a behavior change, not a move.

---

## Task 1: Workspace root and admin relocation

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.npmrc` (all at repo root)
- Move: every tracked path at repo root → `apps/admin/`
- Delete: `apps/admin/pnpm-workspace.yaml`, `apps/admin/.npmrc`, `apps/admin/pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working pnpm workspace where `pnpm --filter @lodgeflow/admin <script>` runs any of the admin's existing scripts. Task 2 relies on the root `pnpm-workspace.yaml` and `package.json` existing with the shapes defined here.

- [ ] **Step 1: Branch from a clean tree**

```bash
cd /home/yzel/github/lodgeFlow_admin
git checkout main
git pull
git status --porcelain   # must print nothing
git checkout -b feat/monorepo-skeleton
```

If `git status --porcelain` prints anything, stop and resolve it. A dirty tree turns the wholesale `git mv` in Step 2 into a mess that is painful to unwind.

- [ ] **Step 2: Move the admin app into `apps/admin/`**

Three top-level entries stay at the root because they describe the repository rather than the admin app:

- `docs/` — holds the design spec, this plan, and the issue/PR templates, all repo-wide
- `.github/` — only read from the repository root; Task 4 rewrites its contents
- `LICENSE` — applies to the whole repository

`local/` is gitignored (`.gitignore:50`) and untracked, so `git ls-tree` never sees it. `.git` must obviously stay put.

```bash
mkdir -p apps/admin
for entry in $(git ls-tree --name-only HEAD); do
  case "$entry" in
    docs|.github|LICENSE) continue ;;
  esac
  git mv "$entry" apps/admin/
done
git status --short | head -20
```

Expected: a long list of `R  <path> -> apps/admin/<path>` rename entries, with no entry for `docs/`, `.github/`, or `LICENSE`.

Verify the exclusions held:

```bash
ls -d docs .github LICENSE
ls -d apps/admin/docs 2>/dev/null && echo "ERROR: docs moved, undo with: git mv apps/admin/docs docs"
```

- [ ] **Step 3: Write the root `package.json`**

Note `private: true` — this manifest is never published, and the flag is what lets pnpm treat it as a workspace root. The `overrides` block mirrors `pnpm-workspace.yaml` for npm's benefit; the customer repo added it after Vercel installed with npm and silently resolved a different tree (see the comment in its `.vercelignore`). Keeping it at the root preserves that protection.

```json
{
  "name": "lodgeflow-monorepo",
  "private": true,
  "packageManager": "pnpm@11.17.0",
  "scripts": {
    "dev:admin": "pnpm --filter @lodgeflow/admin dev",
    "dev:customer": "pnpm --filter @lodgeflow/customer dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "ci:check": "pnpm format:check && pnpm -r exec eslint . && pnpm -r test",
    "pre-commit": "lint-staged",
    "prepare": "husky"
  },
  "overrides": {
    "@internationalized/date": "$@internationalized/date"
  },
  "devDependencies": {
    "husky": "^9.1.7",
    "lint-staged": "^16.1.2",
    "prettier": "^3.6.2"
  }
}
```

Before committing, replace the three `devDependencies` versions with the exact values already in `apps/admin/package.json` so the lockfile does not churn:

```bash
node -e "const d=require('./apps/admin/package.json').devDependencies; console.log(JSON.stringify({husky:d.husky,'lint-staged':d['lint-staged'],prettier:d.prettier},null,2))"
```

- [ ] **Step 4: Write the root `pnpm-workspace.yaml`**

This is a **union** of both apps' current files. The `@internationalized/date` pin comes from the customer's copy; the `postcss` override and the larger `allowBuilds` list come from the admin's. Dropping any entry causes a real regression — the date pin in particular is what keeps HeroUI's date pickers type-checking.

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

# @heroui/calendar, date-picker and date-input hard-pin 3.12.0, while the
# @react-aria/* packages they depend on require ^3.12.2. Two copies means two
# distinct DateValue classes, and their #private brand makes them nominally
# incompatible — every DateRangePicker/DatePicker value fails to type check.
#
# Mirrored as `overrides` in the root package.json so the dedup also holds if
# anything installs with npm, which does not read this file. That copy uses
# npm's "$@internationalized/date" reference syntax — a literal 3.12.2 there is
# rejected with EOVERRIDE for conflicting with the ^3.10.1 direct dependency.
overrides:
  '@internationalized/date': 3.12.2
  postcss: ^8.5.10

allowBuilds:
  '@clerk/shared': true
  '@heroui/shared-utils': true
  core-js: true
  esbuild: true
  mongodb-memory-server: true
  sharp: true
  unrs-resolver: true

onlyBuiltDependencies:
  - '@clerk/shared'
  - '@heroui/shared-utils'
  - core-js
  - esbuild
  - mongodb-memory-server
  - sharp
  - unrs-resolver
```

`packages/*` is listed now even though the directory does not exist yet. pnpm tolerates a glob that matches nothing, and it means Step 2 of the spec does not have to touch this file.

- [ ] **Step 5: Write the root `.npmrc`**

Merged from both apps. The hoist pattern is what makes HeroUI's granular packages resolvable.

```
registry=https://registry.npmjs.org/
public-hoist-pattern[]=*@heroui/*
```

- [ ] **Step 6: Rename the admin package and remove its workspace-level config**

```bash
node -e "
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('apps/admin/package.json','utf8'));
p.name='@lodgeflow/admin';
fs.writeFileSync('apps/admin/package.json', JSON.stringify(p,null,2)+'\n');
"
git rm -q apps/admin/pnpm-workspace.yaml apps/admin/.npmrc apps/admin/pnpm-lock.yaml
```

- [ ] **Step 7: Install and verify the workspace resolves**

```bash
pnpm install
```

Expected: a single `pnpm-lock.yaml` at the repo root, and `apps/admin/node_modules` populated. If pnpm reports `ERR_PNPM_DUPLICATE_PACKAGE_NAME`, the rename in Step 6 did not take.

- [ ] **Step 8: Verify the admin app still builds and tests**

This is the task's real test. `test:fast` skips the integration project, which downloads a mongod binary on first run and needs network.

```bash
pnpm --filter @lodgeflow/admin test:fast
pnpm --filter @lodgeflow/admin build
```

Expected: tests PASS with the same counts as before the move; build completes with no module-resolution errors.

If the build warns about inferring a workspace root, ignore it for now — Task 2 Step 7 fixes it for both apps at once.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: convert repo to a pnpm workspace, move admin to apps/admin

No application code changes — every file under apps/admin is a pure
rename. Root gains package.json, pnpm-workspace.yaml, and .npmrc, with
the workspace file a union of both apps' existing overrides and build
allowances so the @internationalized/date pin survives.

Admin package renamed to @lodgeflow/admin to free the 'lodgeflow' name,
which both apps currently claim."
```

---

## Task 2: Graft in the customer app

**Files:**
- Create: `apps/customer/` (entire tree, via subtree)
- Modify: `apps/customer/package.json` (name only), `apps/admin/next.config.js`, `apps/customer/next.config.js`
- Delete: `apps/customer/pnpm-workspace.yaml`, `apps/customer/.npmrc`, `apps/customer/pnpm-lock.yaml`

**Interfaces:**
- Consumes: the root `pnpm-workspace.yaml` and `package.json` from Task 1.
- Produces: `@lodgeflow/customer` as a resolvable workspace package. Tasks 3–5 assume both apps exist under `apps/`.

- [ ] **Step 1: Add the customer repo as a remote**

Using the local clone as the remote keeps this offline and avoids any dependence on GitHub state.

```bash
git remote add customer-origin /home/yzel/github/lodgeFlow
git fetch customer-origin main
```

- [ ] **Step 2: Confirm the customer working tree is clean before grafting**

`git subtree add` reads the *committed* branch, so uncommitted work in the customer clone would be silently dropped.

```bash
git -C /home/yzel/github/lodgeFlow status --porcelain   # must print nothing
```

- [ ] **Step 3: Graft the customer history in**

```bash
git subtree add --prefix=apps/customer customer-origin main
```

- [ ] **Step 4: Verify both histories survived**

```bash
git log --oneline --follow -- apps/customer/models/Booking.ts | tail -3
git rev-list --count HEAD
```

Expected: the `--follow` log reaches back into genuine customer-repo commits (not just the subtree commit), and the total count is ≥ 484. If `--follow` shows only one commit, the graft squashed history — undo with `git reset --hard HEAD~1` and re-run Step 3 **without** `--squash`.

- [ ] **Step 5: Rename the customer package and drop its workspace-level config**

```bash
node -e "
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('apps/customer/package.json','utf8'));
p.name='@lodgeflow/customer';
delete p.packageManager;
delete p.overrides;
fs.writeFileSync('apps/customer/package.json', JSON.stringify(p,null,2)+'\n');
"
git rm -q apps/customer/pnpm-workspace.yaml apps/customer/.npmrc apps/customer/pnpm-lock.yaml
```

`packageManager` and `overrides` move to the root manifest (Task 1, Step 3) — leaving duplicates in a workspace member is at best ignored and at worst conflicting.

- [ ] **Step 6: Install and confirm the `@internationalized/date` dedup held**

The whole reason that override exists is to keep a single copy of this package. A monorepo install is exactly where it could regress.

```bash
pnpm install
pnpm why @internationalized/date 2>&1 | grep -c "3.12.2"
pnpm list --depth=100 @internationalized/date 2>&1 | grep -oE "3\.[0-9]+\.[0-9]+" | sort -u
```

Expected: exactly one distinct version, `3.12.2`. More than one means the root `pnpm-workspace.yaml` override from Task 1 Step 4 is wrong — fix it there rather than patching around it.

- [ ] **Step 7: Pin the file-tracing root in both apps**

Next.js walks upward looking for a lockfile and warns (or mis-traces serverless bundles) when it finds one above the app directory. This is the one permitted application-adjacent edit in this plan.

In `apps/admin/next.config.js`, add `path` at the top and the key inside `nextConfig`:

```javascript
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
```

Apply the identical change to `apps/customer/next.config.js`.

- [ ] **Step 8: Verify both apps build and test**

```bash
pnpm --filter @lodgeflow/admin test:fast
pnpm --filter @lodgeflow/customer test
pnpm --filter @lodgeflow/admin build
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk pnpm --filter @lodgeflow/customer build
```

Expected: all four succeed, with test counts matching each app's pre-migration baseline.

The Clerk key is a structurally-valid throwaway, copied verbatim from the customer's existing CI workflow. `ClerkProvider` throws while prerendering static pages without one. Every other client (Stripe, Resend, Mongo) is constructed lazily, so no other env var is needed and no network calls happen during build.

If the admin build also fails on a missing Clerk key, prefix it with the same variable and note that Task 4's CI must do likewise.

- [ ] **Step 9: Run the full admin suite including integration**

Now that everything is in place, confirm the MongoDB Memory Server project still works from its new location. This needs network on first run to download a mongod binary.

```bash
pnpm --filter @lodgeflow/admin test
```

Expected: all three projects (`unit`, `integration`, `jsdom`) PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: graft the customer app into apps/customer

git subtree add preserves all 187 customer commits; combined history is
now 484+. Customer package renamed to @lodgeflow/customer, with its
packageManager and npm overrides mirror lifted to the root manifest.

Both next.config.js files pin outputFileTracingRoot to the workspace
root so Next stops inferring it from the nearest lockfile."
```

---

## Task 3: Consolidate shared tooling

**Files:**
- Create: `.prettierrc`, `.prettierignore`, `.editorconfig`, `.lintstagedrc.json`, `.gitignore`, `.husky/pre-commit` (all at root)
- Delete: both apps' copies of the above, and `apps/customer/.husky/`

**Interfaces:**
- Consumes: the workspace from Task 2.
- Produces: a single pre-commit hook and one Prettier configuration governing both apps. Task 4's CI invokes `prettier --check .` from the root and depends on the root `.prettierignore`.

- [ ] **Step 1: Confirm the two Prettier configs are identical before merging them**

Do not skip this. If they differ, merging silently reformats one app's entire codebase.

```bash
diff apps/admin/.prettierrc apps/customer/.prettierrc && echo "IDENTICAL"
diff apps/admin/.prettierignore apps/customer/.prettierignore && echo "IDENTICAL"
diff apps/admin/.editorconfig apps/customer/.editorconfig && echo "IDENTICAL"
```

Expected: `IDENTICAL` three times. If any differ, stop and ask which config wins — that is a formatting decision, not a migration step.

- [ ] **Step 2: Promote the configs to the root**

```bash
git mv apps/admin/.prettierrc .prettierrc
git mv apps/admin/.prettierignore .prettierignore
git mv apps/admin/.editorconfig .editorconfig
git rm -q apps/customer/.prettierrc apps/customer/.prettierignore apps/customer/.editorconfig
```

- [ ] **Step 3: Extend the root `.prettierignore` for the workspace**

Append these lines so Prettier does not walk build output or dependencies in either app:

```
apps/*/.next/
apps/*/node_modules/
apps/*/public/
pnpm-lock.yaml
```

- [ ] **Step 4: Promote and merge `.gitignore`**

```bash
git mv apps/admin/.gitignore .gitignore
```

Then append the workspace-aware entries, and confirm the customer's ignore rules are already covered:

```bash
cat >> .gitignore <<'EOF'

# Workspace
apps/*/.next/
apps/*/node_modules/
apps/*/tsconfig.tsbuildinfo
EOF

diff <(sort apps/customer/.gitignore) <(sort .gitignore) | grep '^<' || echo "customer rules fully covered"
```

If any customer-only rules print, append them by hand before continuing, then `git rm apps/customer/.gitignore`.

- [ ] **Step 5: Write the root `.lintstagedrc.json` — in the correct shape**

The admin's current `.lintstagedrc.json` wraps its config in a redundant `"lint-staged"` key. lint-staged expects the glob map at the **top level** of a `.lintstagedrc.json` file, so the admin's hook has been a no-op. The customer's file has the right shape. Use the customer's:

```json
{
  "**/*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "**/*.{json,css,scss,md}": ["prettier --write"]
}
```

```bash
git rm -q apps/admin/.lintstagedrc.json apps/customer/.lintstagedrc.json
```

- [ ] **Step 6: Install a single Husky hook at the root**

The admin repo has `husky` in `devDependencies` but no `.husky/` directory at all, so its pre-commit hook was never installed. The customer's hook works. One root hook now covers both apps.

```bash
git rm -rq apps/customer/.husky
pnpm exec husky init
printf 'pnpm run pre-commit\n' > .husky/pre-commit
chmod +x .husky/pre-commit
```

`husky init` overwrites `.husky/pre-commit` with a placeholder, which is why the `printf` follows it rather than precedes it. It may also add a `prepare` script to the root `package.json` — that is expected and matches Task 1 Step 3.

- [ ] **Step 7: Verify the hook actually fires**

An installed-but-inert hook is exactly the failure mode being fixed here, so test it rather than assuming.

```bash
printf '\n' >> apps/customer/app/about/page.tsx
git add apps/customer/app/about/page.tsx
git commit -m "test: verify pre-commit hook fires"
```

Expected: lint-staged output appears before the commit completes. Then undo the throwaway commit and restore the file:

```bash
git reset --hard HEAD~1
```

- [ ] **Step 8: Verify formatting is clean workspace-wide**

```bash
pnpm format:check
```

Expected: PASS. A failure here means Step 1's identity check was wrong, or the appended `.prettierignore` entries are insufficient — fix the config rather than reformatting files, since reformatting would violate the no-application-changes constraint.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: consolidate shared tooling at the workspace root

Prettier, editorconfig, gitignore, lint-staged, and Husky move to the
root; per-app copies are removed. ESLint configs deliberately stay
per-app because the two differ and merging them would be a behavior
change rather than a move.

Fixes two latent breakages found during the move: the admin's
.lintstagedrc.json nested its config under a redundant 'lint-staged'
key (lint-staged reads .lintstagedrc.json at top level, so the config
was ignored), and the admin repo had husky in devDependencies with no
.husky directory, so no hook was ever installed."
```

---

## Task 4: Unified CI

**Files:**
- Modify: `.github/workflows/ci.yml` (root — the admin's, rewritten in place)
- Move: `apps/customer/.github/workflows/claude.yml` and `claude-code-review.yml` → `.github/workflows/`
- Delete: `apps/customer/.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root scripts from Task 1, root Prettier config from Task 3.
- Produces: a green CI run gating the PR. No later task depends on its internals.

- [ ] **Step 1: Consolidate the workflow directory**

`.github/` already sits at the root — Task 1 Step 2 deliberately left it there — and still holds the admin's `ci.yml`, which Step 2 rewrites in place. Only the customer's workflows need relocating. Its two Claude workflows have no admin equivalent and are worth keeping.

```bash
git mv apps/customer/.github/workflows/claude.yml .github/workflows/claude.yml
git mv apps/customer/.github/workflows/claude-code-review.yml .github/workflows/claude-code-review.yml
git rm -q apps/customer/.github/workflows/ci.yml
git rm -rq --ignore-unmatch apps/customer/.github
ls .github/workflows
```

Expected: `ci.yml`, `claude-code-review.yml`, `claude.yml`.

- [ ] **Step 2: Write the root CI workflow**

This adopts the **customer's stricter** shape for both apps. Two details carried over deliberately, both of which the customer repo learned the hard way and the admin's workflow still lacks:

1. `eslint` runs **without** `--fix`. The `lint` script is `eslint --fix`, which rewrites files instead of failing, so it gates nothing in CI.
2. A build step runs, because `next build` performs the TypeScript check — that is what caught the duplicate `@internationalized/date` copies that lint and tests both missed.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        app: [admin, customer]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.17.0

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check formatting
        run: pnpm exec prettier --check .

      # `pnpm lint` is `eslint --fix`, which rewrites files instead of failing
      # on anything auto-fixable. CI runs eslint without --fix so it gates.
      - name: Lint
        run: pnpm --filter @lodgeflow/${{ matrix.app }} exec eslint .

      - name: Test
        run: pnpm --filter @lodgeflow/${{ matrix.app }} test

      # `next build` runs the TypeScript check, which is what caught the
      # duplicate @internationalized/date copies that lint and tests missed.
      #
      # This is a structurally-valid throwaway key, not a secret. ClerkProvider
      # wraps both apps and throws without a publishable key while prerendering
      # static pages. It is the only var the build needs — everything else
      # constructs its SDK client lazily. No network calls happen during build.
      - name: Type check and build
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk
        run: pnpm --filter @lodgeflow/${{ matrix.app }} build
```

The formatting check runs in both matrix legs. That is one redundant run rather than a separate job, and it keeps the workflow to a single job definition.

- [ ] **Step 3: Verify the matrix commands work locally before pushing**

Faster than discovering a typo through a CI round-trip.

```bash
pnpm exec prettier --check .
pnpm --filter @lodgeflow/admin exec eslint .
pnpm --filter @lodgeflow/customer exec eslint .
```

Expected: all three PASS.

If `eslint .` reports pre-existing errors that `eslint --fix` had been silently repairing, that is a real finding but **not** in this plan's scope. Record it, and add `--max-warnings=0` handling or fix the errors in a separate commit on this branch — do not weaken the CI step to accommodate them.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "ci: single matrixed workflow for both apps

Replaces the two per-repo workflows. Adopts the customer's stricter
shape for both apps: eslint runs without --fix (the lint script's --fix
rewrites files instead of failing, so it gated nothing), and a build
step runs because next build performs the TypeScript check.

Claude workflows move to the root, which is the only place .github is
read from."
git push -u origin feat/monorepo-skeleton
```

- [ ] **Step 5: Open the PR and confirm both matrix legs pass**

Per `CLAUDE.md`, read `docs/pull_requests_template.md` in full before writing the PR body. Fill the test-plan results with the **actual** output from Task 2 Step 8, Task 2 Step 9, and Step 3 above — the template requires inline results, not claims.

```bash
gh pr create --title "Convert LodgeFlow to a pnpm monorepo" --body "$(cat <<'EOF'
Implements step 1 of `docs/superpowers/specs/2026-08-04-monorepo-and-admin-gap-closure-design.md`.

## Summary

- Converts the repository to a pnpm workspace; admin moves to `apps/admin`
- Grafts the customer app into `apps/customer` via `git subtree add`, preserving all 187 of its commits
- Renames both packages to `@lodgeflow/admin` and `@lodgeflow/customer`, resolving a name collision — both were `lodgeflow`
- Merges both `pnpm-workspace.yaml` files, preserving the `@internationalized/date` 3.12.2 pin and the `postcss` override
- Consolidates Prettier, editorconfig, gitignore, lint-staged, and Husky at the root; ESLint configs stay per-app
- Replaces two workflows with one matrixed over both apps, adopting the customer's stricter shape (eslint without `--fix`, plus a build step for the TypeScript check)
- Pins `outputFileTracingRoot` in both `next.config.js` files

No application code changed. Every file under `apps/*` is a pure rename apart from the two `next.config.js` edits.

## Details

Fixes two latent tooling breakages found during the move:

- The admin's `.lintstagedrc.json` nested its config under a redundant `"lint-staged"` key; lint-staged reads that file at top level, so the config was ignored
- The admin repo had `husky` in `devDependencies` but no `.husky/` directory, so no hook was ever installed

## Test plan

- [ ] `pnpm --filter @lodgeflow/admin test` — <paste result>
- [ ] `pnpm --filter @lodgeflow/customer test` — <paste result>
- [ ] `pnpm --filter @lodgeflow/admin build` — <paste result>
- [ ] `pnpm --filter @lodgeflow/customer build` — <paste result>
- [ ] `pnpm exec prettier --check .` — <paste result>
- [ ] `pnpm list --depth=100 @internationalized/date` — single version 3.12.2
- [ ] `git rev-list --count HEAD` — <paste count, expect >= 484>
- [ ] Both Vercel preview deployments render

## Out of scope

Reconciling the diverged `Booking`, `Cabin`, and `Settings` schemas, and extracting `packages/database`. That is step 2 of the spec.
EOF
)"
gh pr checks --watch
```

Replace each `<paste result>` with real output before opening the PR.

Expected: `ci (admin)` and `ci (customer)` both green. **Do not merge yet** — Task 5 needs the branch's preview deployments.

---

## Task 5: Repoint Vercel

**Files:** none in the repository. This task is Vercel dashboard configuration plus verification.

**Interfaces:**
- Consumes: the pushed branch and open PR from Task 4.
- Produces: both production sites serving from the monorepo. Task 6 documents what changed here.

**Manual steps required.** These need dashboard access and cannot be scripted from this session. If a step needs the Vercel CLI interactively, run it yourself with the `!` prefix so its output lands in the conversation.

- [ ] **Step 1: Record the current state before changing anything**

You need these to roll back.

```bash
cat apps/admin/.vercel/project.json
cat apps/customer/.vercel/project.json
```

Note that the admin's `project.json` contains only a `settings` block with no `projectId` or `orgId` — that local link is incomplete, so the admin project must be identified through the dashboard rather than from this file. The customer's is fully linked (`projectId: prj_o6GMRde6Gvu5pdASOFX6ioyGF5QK`, `orgId: team_R7lu5ZeXoXAi6ItSOXUO31q4`).

- [ ] **Step 2: Repoint the admin project**

In the Vercel dashboard, for the project serving `admin.lodgeflow.app`:

- **Settings → Git**: confirm it points at the merged repository (unchanged if the admin repo is the monorepo base, which it is).
- **Settings → General → Root Directory**: set to `apps/admin`.
- **Settings → General → Node.js Version**: confirm `22.x` (matches its existing `project.json`).
- Leave Build and Install commands empty. Vercel detects pnpm from the root lockfile and runs the workspace install correctly.

Confirm `apps/admin/vercel.json` is still picked up — it declares the `/api/cron/seed` daily cron, and with a root directory of `apps/admin` Vercel reads it from there.

- [ ] **Step 3: Repoint the customer project**

For the project serving `lodgeflow.app`:

- **Settings → Git**: **disconnect** from the old `lodgeFlow` repository and connect to the merged repository. Until this is done the old repo keeps deploying production, which is the single most likely way to end up with two live versions.
- **Settings → General → Root Directory**: set to `apps/customer`.
- Confirm every environment variable carried over. The customer needs vars the admin does not: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, plus the shared `MONGODB_URI`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `RESEND_API_KEY`.

- [ ] **Step 4: Verify both preview deployments succeed**

```bash
gh pr checks --watch
```

Expected: both Vercel preview deployments report success alongside the two CI legs. Open each preview URL and confirm the app renders — a green build with a blank page usually means a missing runtime env var.

- [ ] **Step 5: Verify the Stripe webhook endpoint still resolves**

The customer app's `/api/payments/webhook` is registered with Stripe against the production domain. The domain is unchanged, so this should hold — but a broken payment webhook is a silent, expensive failure, so confirm rather than assume.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://lodgeflow.app/api/payments/webhook -X POST
```

Expected: `400` (Stripe signature verification rejecting an unsigned request), **not** `404`. A `404` means routing broke.

- [ ] **Step 6: Merge, then verify production**

```bash
gh pr merge --squash --delete-branch=false
```

Do **not** delete the branch — `--delete-branch=false` is deliberate, since the subtree graft is easier to re-examine with the branch intact.

Then confirm both production sites:

```bash
curl -s -o /dev/null -w "admin  %{http_code}\n" https://admin.lodgeflow.app
curl -s -o /dev/null -w "site   %{http_code}\n" https://lodgeflow.app
```

Expected: admin returns `200` or a `3xx` redirect to sign-in (it is auth-gated); the customer site returns `200`.

- [ ] **Step 7: Archive the old customer repository**

Only after production is confirmed green. Archiving makes it read-only, preserving its issues and PRs as a record while removing any chance of a stray push deploying from it.

First migrate the open issues, which are still live work (`#67`, `#68`, `#74`, `#77`, and the rest):

```bash
gh issue list --repo Amadou-dot/lodgeFlow --state open --json number \
  --jq '.[].number' \
  | xargs -I{} gh issue transfer {} Amadou-dot/lodgeFlow_admin --repo Amadou-dot/lodgeFlow
gh repo archive Amadou-dot/lodgeFlow --yes
```

Verify the transfer landed before archiving — `gh issue transfer` fails silently on issues it cannot move.

---

## Task 6: Documentation

**Files:**
- Modify: `apps/admin/CLAUDE.md`, `apps/customer/CLAUDE.md`, `apps/admin/README.md`
- Create: `README.md` (root)

**Interfaces:**
- Consumes: the merged monorepo from Task 5.
- Produces: documentation matching reality. Step 2 of the spec starts from these files.

- [ ] **Step 1: Write the root README**

````markdown
# LodgeFlow

Hotel management platform: an admin dashboard and a customer-facing booking site
sharing one MongoDB database and one Clerk tenant.

| App | Path | Production |
| --- | --- | --- |
| Admin dashboard | `apps/admin` | https://admin.lodgeflow.app |
| Customer site | `apps/customer` | https://lodgeflow.app |

## Getting started

```bash
pnpm install
pnpm dev:admin      # or: pnpm dev:customer
```

Each app needs its own `.env.local`; see `CLAUDE.md` in each app directory for
the required variables.

## Workspace scripts

| Command | Effect |
| --- | --- |
| `pnpm build` | Build both apps |
| `pnpm test` | Test both apps |
| `pnpm ci:check` | Format check, lint, and test everything |
| `pnpm --filter @lodgeflow/admin <script>` | Run a script in one app |

## Structure

- `apps/*` — the two Next.js applications, each self-contained
- `packages/*` — shared code (currently empty; see the design spec in `docs/superpowers/specs/`)

Both apps currently carry their own copy of `models/`, and the two copies have
diverged in semantics. Do not merge them ad hoc — see the spec.
````

- [ ] **Step 2: Update `apps/admin/CLAUDE.md`**

Insert this block immediately after the `# CLAUDE.md` heading:

```markdown
> **Monorepo layout.** This app lives at `apps/admin/` in the LodgeFlow
> workspace. Every path in this document is relative to that directory unless
> it starts with `docs/`, `.github/`, or `packages/`, which are repo-root paths.
> Scripts below run from within `apps/admin/`, or from the repo root as
> `pnpm --filter @lodgeflow/admin <script>`.
```

Then fix the **Code Quality** section, which documents `pnpm pre-commit` as "lint-staged (runs via Husky on commit)". That was never true here — the repo had no `.husky/` directory, so no hook was installed. Replace that line with:

```markdown
pnpm pre-commit       # lint-staged (runs via the workspace-root Husky hook)
```

Finally, update the **Additional Documentation** section, whose paths now resolve from the repo root rather than this directory:

```markdown
- `../../docs/api.md` — Full API endpoint reference (auth, rate limits, request/response shapes)
- `../../docs/issues_template.md` — **Required reading before creating issues**
- `../../docs/pull_requests_template.md` — **Required reading before opening PRs**
```

- [ ] **Step 3: Update `apps/customer/CLAUDE.md`**

Insert the equivalent block after its `# CLAUDE.md` heading:

```markdown
> **Monorepo layout.** This app lives at `apps/customer/` in the LodgeFlow
> workspace. Every path in this document is relative to that directory unless
> it starts with `docs/`, `.github/`, or `packages/`, which are repo-root paths.
> Scripts below run from within `apps/customer/`, or from the repo root as
> `pnpm --filter @lodgeflow/customer <script>`.
```

- [ ] **Step 4: Note the deliberate duplication**

Add this to both `CLAUDE.md` files so the next contributor does not "helpfully" deduplicate the models before the reconciliation work happens:

```markdown
### Duplicated models (temporary)

`models/` exists in both `apps/admin` and `apps/customer` and the two copies
have **diverged in semantics** — `Booking`'s `pre('save')` hooks, its index
options, `Settings` validation and seeding, and `Cabin`'s discount validator
all differ. Do not merge them ad hoc. Reconciliation is Step 2 of
`docs/superpowers/specs/2026-08-04-monorepo-and-admin-gap-closure-design.md`,
which resolves each divergence explicitly and audits existing data.
```

- [ ] **Step 5: Verify formatting and commit**

```bash
pnpm format:check
git add -A
git commit -m "docs: update for the monorepo layout

Root README, plus per-app CLAUDE.md corrections for paths and scripts.
Records that the duplicated models have diverged in semantics and must
not be merged ad hoc — that is Step 2 of the spec."
```

- [ ] **Step 6: Confirm the migration's done condition**

From the spec: *"both apps build locally, CI passes, and both Vercel projects deploy green with root directories repointed at `apps/*`."*

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
git rev-list --count HEAD          # ≥ 484
gh run list --limit 2              # both legs green
```

Expected: all pass. Step 1 of the spec is complete, and Step 2 (schema reconciliation and `packages/database`) can be planned against a stable base.

---

## Rollback

Through Task 4 everything is confined to the `feat/monorepo-skeleton` branch — `git checkout main` abandons it entirely.

After Task 5, rollback means reverting Vercel configuration, not code: restore each project's Root Directory to empty and reconnect the customer project to `Amadou-dot/lodgeFlow` (un-archive it first if Task 5 Step 7 already ran). Because the old customer repository is only archived rather than deleted, and the merge is a squash on `main`, no history is lost in either direction.
