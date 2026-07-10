\# Issue Template



> \*\*Source of truth\*\*: this template codifies the structure to be used in all future issues in this repo. Issues here come in three flavors — \*\*bug\*\*, \*\*gap / launch blocker\*\*, and \*\*feature / scope\*\* — and they share a common skeleton with a few flavor-specific sections. Keep prose tight; reviewers expect technical, sourced descriptions, not narratives.



\---



\## When to pick which flavor



\- \*\*Bug\*\* — something rendered or behaved wrong. Steps to reproduce exist. Use the \_bug\_ skeleton.

\- \*\*Gap / launch blocker\*\* — a feature, page, or invariant is missing but expected. Use the \_gap\_ skeleton. Frame the problem around the \*\*infrastructure that exists but isn't wired up\*\* ("the column exists, nothing writes to it") — that's the load-bearing framing in this repo.

\- \*\*Feature / scope\*\* — net-new functionality the client asked for. Use the \_feature\_ skeleton.



The headings differ slightly; the discipline (problem first, scope second, acceptance criteria third) is identical across all three.



\---



\## Sections used in this repo (and when)



| Section | Bug | Gap | Feature |

|---|---|---|---|

| `## Problem` | ✅ | ✅ | ✅ |

| Steps to reproduce + Expected/Actual | ✅ | — | — |

| `## Likely cause` | ✅ (when known) | — | — |

| `## Why this is a launch blocker` | — | ✅ (when applicable) | — |

| `## Rationale` | — | — | ✅ (when removing or changing direction) |

| `## Scope` / `## Scope (decided)` / `## Scope of removal` | sometimes | ✅ | ✅ |

| `## Possible approaches` | ✅ (when ambiguous) | sometimes | sometimes |

| `## Acceptance criteria` | ✅ | ✅ | ✅ |

| `## Out of scope (deferred)` | — | ✅ | ✅ |

| `## Notes` | optional | optional | optional |

| `## Related` | optional | optional | optional |



\---



\## ## Problem



Always the first section. State the broken or missing state up front, then back it with \*\*concrete file paths and code references\*\*. This repo's convention is to point at the exact lines/files where the problem lives so the reviewer can verify in one click.



Example shapes pulled from real issues:



> \_"`components/footer.tsx` contains several `href="#"` placeholders: ..."\_



> \_"`lib/actions/checkout.ts` calls `stripe.checkout.sessions.create(...)` \*\*without\*\* `shipping\_address\_collection`, so the Stripe Checkout page never prompts the customer for an address."\_



> \_"Product cards / PDP show a heart wishlist icon, but there is no wishlist system implemented: No `Wishlist` / `WishlistItem` table in `prisma/schema.prisma`, ..."\_



Rules:



\- \*\*Backticks for every identifier.\*\* File paths, function names, env vars, DB columns.

\- \*\*Quote behavior precisely.\*\* "Returns null" / "creates the row" / "scrolls to top and does nothing" — not "is broken" or "doesn't work right".

\- \*\*Reference adjacent infrastructure that does/doesn't exist.\*\* Half the issues in this repo close with "we have the column, we just don't write to it" or "we have the page, but no link reaches it" — surface that mismatch.



\---



\## ### Steps to reproduce — \_bugs only\_



Numbered list. Each step is a single user action.



```markdown

Steps to reproduce:

1\. On a mobile viewport, open the mobile nav sheet.

2\. Tap the \*\*Sign In\*\* button. The Clerk sign-in modal opens \*on top\* of the nav sheet.

3\. Tap anywhere — empty space outside the modal, the modal's \*\*X\*\* close button, or even an input inside the modal.



\*\*Actual:\*\* The first tap closes the nav sheet ...

\*\*Expected:\*\* While the Clerk sign-in modal is open, it should fully capture pointer events. ...

```



`\*\*Actual:\*\*` and `\*\*Expected:\*\*` lines follow the steps. Keep both short and behavioral.



\---



\## ## Likely cause — \_bugs, optional\_



One paragraph. Use when you have a real hypothesis you want to anchor — saves the implementer 30 minutes of reading. Don't speculate if you don't actually know.



> \_"The mobile nav `Sheet` (Radix Dialog) is listening for outside-pointer-down events. The Clerk modal renders into a portal that is a sibling of the sheet's content, so taps inside/around the Clerk modal register as 'outside' from the sheet's perspective ..."\_



If the cause is unknown, omit the section. Don't fill it with "probably something in the cart code".



\---



\## ## Why this is a launch blocker — \_gap issues, optional\_



Short paragraph. Use only when the gap genuinely blocks launch — not for "this would be nice".



> \_"Fulfillment is impossible without an address. Every paid order needs a destination — this blocks the launch checklist."\_



Skip otherwise.



\---



\## ## Rationale — \_feature/removal issues, optional\_



Use when the issue is about removing or changing direction and the "why" needs to be on the record so future contributors don't reintroduce the thing.



> \_"A real wishlist is out of scope for now. Showing a non-functional control hurts trust. We can reintroduce it as a tracked feature when we're ready to build the full flow (model + actions + account page + auth gating + guest-vs-DB strategy like the cart)."\_



\---



\## ## Scope / ## Scope (decided) / ## Scope of removal



The implementation plan. Use sub-headings (`### Schema`, `### Page`, `### Server action`, `### Tests`) when the scope spans multiple layers — the reviews issues and account-settings issue both do this and it makes the issue scannable.



```markdown

\### Schema

\- New column `Review.moderationReason ModerationReason?`

&#x20; - Nullable so existing rows aren't broken

&#x20; - Closed enum (`OFF\_TOPIC | OFFENSIVE | SPAM | OTHER | ...`) — FTC 16 CFR Part 465 categories

\- Optional `Review.moderationNote String?` — free-text justification, required iff `reason = OTHER`



\### Server action

\- `hideReview(input)` in `lib/actions/admin/`

\- `requireAdmin`, Zod-validate (closed enum + `.superRefine` for the OTHER-requires-note rule)

\- Audit-log `REVIEW\_HIDDEN` with `changedFields: \['status', 'moderationReason']` — \*\*no plaintext `moderationNote` in `auditLog.metadata`\*\* (free-text PII stays on the row only)

```



Title variants:



\- `## Scope` — open-ended; implementer makes some decisions.

\- `## Scope (decided)` — choices are locked; don't re-litigate. Spell out what was decided and what's deferred.

\- `## Scope of removal` — for removal issues; lists every dead code path that needs to go.



Reference `CLAUDE.md` patterns explicitly when the scope inherits an established invariant (audit allowlist, PII redaction, error class shape).



\---



\## ## Possible approaches — \_optional\_



Numbered list of viable options when the issue isn't pre-decided. Each option gets a one-line tradeoff.



```markdown

\## Possible approaches

\- Close the mobile nav sheet \*before\* opening the Clerk sign-in modal (simplest; loses the "underneath" UX but eliminates the layering bug).

\- Detect when Clerk's modal is mounted and disable the sheet's `onPointerDownOutside` / `onInteractOutside` while it's open.

\- Use Clerk's hosted sign-in route (`/sign-in`) for the mobile flow instead of the modal, so only one overlay is ever active.

```



Don't pretend options exist if there's really one path. Skip the section in that case.



\---



\## ## Acceptance criteria



Always present. Checkbox list. Each item is \*\*independently testable\*\* — a reviewer should be able to look at the merged PR and tick each box.



```markdown

\## Acceptance criteria

\- \[ ] `Review.moderationReason` enum column + `Review.moderationNote` text column

\- \[ ] `hideReview` admin action records both fields atomically with the status flip

\- \[ ] Zod schema enforces "OTHER requires `note`" via `.superRefine` (caller can't bypass)

\- \[ ] `REVIEW\_HIDDEN` audit row records `changedFields: \['status', 'moderationReason']` only — never `moderationNote`

\- \[ ] Idempotent on already-HIDDEN: report sweep + audit still run; first-classification `moderationReason` preserved

\- \[ ] Integration test for each transition (PUBLISHED→HIDDEN, PENDING→HIDDEN, already-HIDDEN idempotency); unit test for the Zod superRefine

```



Rules:



\- \*\*Phrase each as a verifiable outcome\*\*, not a task. "✅ — Users can edit username" rather than "✅ — Build settings page".

\- \*\*Always include a test criterion.\*\* Either a specific test file ("Integration tests: promote, demote, self-demote-guard, last-admin-guard") or the kind of test ("E2E test for the page"). Issues without test acceptance get reopened.

\- \*\*Include audit / observability criteria when the change touches mutations.\*\* `auditLog` rows, Sentry tags, PII-clean metadata — these are first-class in this repo.

\- \*\*Mention CLAUDE.md doc updates if the change invalidates anything there.\*\* ("Update CLAUDE.md to point at this UI instead of 'flip role in Prisma Studio'").



\---



\## ## Out of scope / ## Out of scope (deferred) — \_optional\_



Bullet list. Things adjacent to the scope that you deliberately are not doing. Same intent as the PR template's `## Out of scope`. Include because reviewers will otherwise ask.



> \_"International shipping / non-US addresses (post-launch)"\_

> \_"Multiple saved addresses per user (default-only at launch — single address per user)"\_



If the deferred work has a tracking issue, link it.



\---



\## ## Notes — \_optional\_



Free-form context. Common shapes:



\- Why this issue is lower priority than something adjacent.

\- A subtlety in an upstream dependency that affects the fix.

\- A caveat the implementer needs to know but that doesn't belong in `## Scope` (e.g. \_"Stripe Checkout has its own receipt email — keep that on as a fallback, but the branded Élan email is the experience we ship."\_)



\---



\## ## Related — \_optional\_



Bullet list of related issues. Lightweight — full dependency graphs go in the PR header (`Parent: #N · Blocks: #N`), not here.



```markdown

\## Related

\- #173 (reviews — depends on this for `reviewerDisplayName`)

\- #194 (shipping address management lands on the same settings page)

```



\---



\## Conventions across all sections



\- \*\*No emojis.\*\* Body stays plain markdown.

\- \*\*Backticks for every identifier.\*\* File paths, function names, constant names, env vars, error classes, DB columns, audit actions.

\- \*\*Reference real lines and files.\*\* If you can name a file, name it. If you can name a column, name it. "It doesn't work" is not an issue, it's a vibe.

\- \*\*Bold for emphasized invariants\*\* (`\*\*Result:\*\*`, `\*\*Actual:\*\*`, `\*\*no plaintext value in `auditLog.metadata`\*\*`). Use sparingly — every bold loses force if everything is bolded.

\- \*\*Cross-reference `CLAUDE.md` patterns\*\* when scope touches an established invariant ("mirrors the `TRACKED\_ORDER\_FIELDS` shape", "per the email-redaction pattern in CLAUDE.md").

\- \*\*Cross-reference other issues\*\* with `#N` notation when they're parents, blockers, or siblings.



\---



\## Skeletons (copy-paste starting points)



\### Bug



```markdown

\## Problem

\_What's broken, with file paths to the offending code.\_



Steps to reproduce:

1\. \_action\_

2\. \_action\_



\*\*Actual:\*\* \_what happens\_

\*\*Expected:\*\* \_what should happen\_



\## Likely cause

\_One paragraph. Omit if unknown.\_



\## Acceptance criteria

\- \[ ] \_verifiable outcome\_

\- \[ ] \_verifiable outcome\_

\- \[ ] Test added or updated to cover the regression

```



\### Gap / launch blocker



```markdown

\## Problem

\_The gap. Lead with the mismatch between existing infrastructure and what writes/reads it.\_



\## Why this is a launch blocker

\_One paragraph. Omit if not a blocker.\_



\## Scope (decided)

\### \_Layer 1 (e.g. Schema)\_

\- \_item\_



\### \_Layer 2 (e.g. Server action)\_

\- \_item\_



\### \_Layer 3 (e.g. UI)\_

\- \_item\_



\## Acceptance criteria

\- \[ ] \_verifiable outcome\_

\- \[ ] \_verifiable outcome\_

\- \[ ] \_test criterion — integration / E2E / unit, named explicitly\_



\## Out of scope (deferred)

\- \_adjacent thing intentionally not done\_

```



\### Feature / scope



```markdown

\## Problem

\_What's missing or what the client asked for.\_



\## Rationale

\_Why this is worth doing now. Omit if obvious.\_



\## Scope

\### \_Layer\_

\- \_item\_



\## Possible approaches

\- \_option (tradeoff)\_

\- \_option (tradeoff)\_



\## Acceptance criteria

\- \[ ] \_verifiable outcome\_

\- \[ ] \_test criterion\_



\## Related

\- #\_N\_ \_(short reason)\_

```

