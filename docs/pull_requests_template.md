# Pull Request Template

> **Source of truth**: this template codifies the structure to be used in all future PRs in this repo. Sections marked _optional_ are dropped when they don't apply; everything else is expected on every PR. Keep prose tight — reviewers in this repo expect terse, technical bodies, not narratives.

---

## Header

Open with a single line referencing the issue this PR resolves. Use one of these forms:

```
Closes #123.
```

```
Closes #178 · Parent: #173 · PR 5 of 5 in the reviews feature.
```

```
Closes #175 · Parent #173 · Depends on: #174 (merged) · Blocks: #176
```

- Use `Closes #N` so the issue auto-closes on merge.
- For multi-PR features, include `Parent: #N`, `Depends on: #N`, `Blocks: #N` chains so the dependency graph is readable from any single PR.

---

## ## Summary

Bullet list. One bullet per discrete change. Lead with the verb, not the rationale.

- Lead bullets describe **what landed**, not the journey it took to get there.
- Inline code spans for file paths, type names, function names, env keys, audit actions: `lib/actions/checkout.ts`, `requireAdmin`, `CLERK_WEBHOOK_SIGNING_SECRET`.
- Call out non-obvious invariants alongside the change that introduces them ("PII-clean: plaintext never enters metadata", "idempotent on `(reviewId, reporterId)`").
- 3–8 bullets is the typical range. If you need more, split the PR or move detail into `## Details` / `## Notes`.

---

## ## Details — _optional_

Use when `## Summary` would balloon past one screen, or when implementation specifics matter for review. Examples from this repo:

- _Where new code lives_ (`new email layer lives under lib/email/`)
- _Trigger ordering_ (`order confirmation is triggered from the Stripe webhook only after the order transaction finishes`)
- _Failure semantics_ (`email failures are captured to Sentry and logged via ORDER_EMAIL_SENT / ORDER_EMAIL_FAILED audit actions without rolling back the underlying order work`)

If the change is mechanical (lockfile fix, rename, dependency bump), skip this section.

---

## ## Why — _optional, for non-obvious choices_

One short paragraph or a few bullets explaining a load-bearing decision a reviewer might otherwise push back on. Use when:

- The approach contradicts a prior pattern.
- You picked option A from a multi-option issue and need to explain why.
- A subtle library behavior (e.g. how Clerk's `SignInButton` wraps `onClick`) makes the fix work.

Skip for ordinary changes.

---

## ## Trade-off — _optional_

Single short paragraph. Use only when you're knowingly accepting a downside. Be explicit so the reviewer doesn't have to guess.

> Example: _"We lose the (broken) modal-on-top-of-sheet visual layering, but as the issue notes, that UX wasn't working anyway."_

---

## ## Notes / ## Notes for reviewer — _optional_

Use for context that doesn't belong in `## Summary` but matters during review. Common shapes in this repo:

- Why the test plan deviates (e.g. `pnpm test:e2e ... — skipped locally without CLERK_E2E_TEST_EMAIL`)
- Pre-existing failures you confirmed are not introduced by this PR
- A flag, value, or constraint that needs a human sanity check before merge (e.g. _"`SUPPORT_EMAIL` value was preserved from the pre-existing returns page — please confirm the double-`n` is intentional before launch"_)

---

## ## Test plan

Always present. Use checkboxes — checked for things you actually ran, unchecked for things still pending (e.g. CI-only jobs, optional E2E with secrets the local dev box doesn't have).

```markdown
## Test plan
- [x] `pnpm test __tests__/integration/actions/admin/users.test.ts` — 8/8 pass (promote, demote, self-demote-guard, last-admin-guard, idempotent no-op, NOT_FOUND, invalid UUID, PII-clean audit)
- [x] `pnpm lint` — 0 errors (3 warnings on `lib/db/audit.ts` are pre-existing)
- [x] `pnpm exec tsc --noEmit` — clean
- [x] `pnpm build` — clean; `/admin/users` route registered
- [x] Manual: promote a CUSTOMER and verify they can hit `/admin`; demote them and verify they get the 404 from `requireAdmin`
- [ ] CI Type Check job passes (verified once merged)
```

Rules of thumb:

- **Quote the actual command you ran**, not a paraphrase. Reviewers re-run these.
- **State the result inline** — pass count, failure count, "clean", "no new errors". Don't make the reviewer guess.
- **Acknowledge pre-existing noise explicitly** ("2 pre-existing warnings", "144 pre-existing failures verified to exist at base SHA"). This is the convention — the alternative is a confused reviewer.
- **Manual steps go last** and are framed as testable: _"Manual: promote a CUSTOMER and verify..."_ — not _"I tried it and it worked"_.

The minimum acceptable test plan is:

```markdown
## Test plan
- [x] `pnpm exec tsc --noEmit` clean
- [x] `pnpm test` — N passing, M skipped
- [x] `pnpm lint` — no new errors
```

If you skipped any of these, say why in `## Notes`.

---

## ## Out of scope / ## Out of scope (deferred) — _optional_

Bullet list. Things that look like they belong with this change but you deliberately did not do. Include because a reviewer will ask if not.

- _"International shipping / non-US addresses (post-launch)"_
- _"Backend wiring for the contact form (`mailto:` works today; swappable to a server action later without UI changes)"_

If the deferred work has a tracking issue, link it.

---

## ## Follow-up — _optional_

Use only for actions the reviewer or the deployer needs to take **after** merging — env vars to configure, migrations to apply, DNS records to publish, etc.

> Example:
> - _"apply the new Prisma migration before deploy"_
> - _"configure `RESEND_API_KEY` and publish the SPF/DKIM/DMARC records documented in `docs/notes/transactional-email.md`"_

Not the same as `## Out of scope` — these are blocking actions tied to this PR landing, not future feature work.

---

## Conventions across all sections

- **No emojis.** Body stays plain markdown.
- **Backticks for every identifier** — file paths, function names, constant names, env vars, error class names. Bare names are harder to scan.
- **Hyphens for compound terms** when they cluster heavily (`opt-in`, `case-insensitive`, `last-admin`) — matches the codebase's prose style.
- **Past tense for changes** ("Adds", "Replaces", "Drops") in `## Summary` bullets; first-person plural ("We lose...") is fine in `## Trade-off`.
- **Reference architectural rules from `CLAUDE.md` when relevant** ("mirrors the `TRACKED_ORDER_FIELDS` shape", "per the email-redaction pattern in CLAUDE.md"). Reviewers cross-check against `CLAUDE.md` — make their job easy.
- **Issue numbers and commit SHAs are fair game** when they explain a trap or a precedent (`b6dc015 fixed exactly this trap`, `144 pre-existing failures verified to exist at base SHA`).

---

## Skeleton (copy-paste starting point)

```markdown
Closes #___.

## Summary
- _what changed, bullet per discrete change_
- _inline code spans for paths and identifiers_
- _surface non-obvious invariants here_

## Test plan
- [x] `pnpm exec tsc --noEmit` — clean
- [x] `pnpm test` — N passing, M skipped
- [x] `pnpm lint` — no new errors
- [ ] _manual steps if any_
```

Add `## Details`, `## Why`, `## Notes`, `## Out of scope`, `## Follow-up` only when they earn their place.
