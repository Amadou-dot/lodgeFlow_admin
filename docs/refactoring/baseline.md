# Phase 0A baseline

## Source and isolation

Verified 2026-09-15 against committed main
`07670932f0b8349fa826802a6ee27f20b3501908`, exported with `git archive HEAD` into
`/tmp/lodgeflow-phase0-baseline.1bnoRo`. The snapshot did not copy local `.env.local`,
build output, dependencies, or the working tree's uncommitted Phase 0 changes.
Dependencies were installed from the committed lockfile into that fresh snapshot.

Runtime: Node 22.23.2 and pnpm 11.17.0. Commands below ran from the snapshot root
with Node 22 first in `PATH`. Agent execution permission was used for installation,
local database sockets and builds. Tests used disposable MongoDB servers.

The existing CI also passed on this baseline commit:
[CI run 34958578229](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/34958578229).
That run predates the new HTTP smoke job and cannot satisfy its Phase 0B gate.

## Results

| Command                          | Result                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Exit 0; lockfile accepted without updates; completed in 8.4 seconds.                           |
| `pnpm format:check`              | Exit 0; all matched tracked baseline files passed.                                             |
| `pnpm -r exec eslint .`          | Exit 0; no lint output.                                                                        |
| `pnpm -r test`                   | Exit 0; database 25/25, admin 1,014/1,014 across 59 suites, customer 141/141 across 20 suites. |
| `pnpm -r build`                  | Exit 0; shared database TypeScript check and both Next.js production builds passed.            |

Build command environment:

```sh
PATH=/home/yzel/.nvm/versions/node/v22.23.2/bin:$PATH \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk \
RESEND_API_KEY='' STRIPE_SECRET_KEY='' CLERK_SECRET_KEY='' \
NEXT_TELEMETRY_DISABLED=1 pnpm -r build
```

The publishable key above is the non-secret dummy key already used by CI. No
payment/email secrets or live database were needed to establish these results.

## Non-blocking installation output

- Sharp's optional native build reported a missing `node-addon-api` prerequisite;
  installation still exited 0 and both Next builds succeeded. This does not prove
  runtime image optimization works; retest that separately if its code changes.
- Husky reported that `.git` was absent because the baseline was an archive rather
  than a checkout. Installation finished; this is not a source or CI failure.

## Existing issue disposition

- **#133:** the two named GitHub workflow files are tracked and pass the full
  baseline formatting check. The original formatting report is resolved at this
  commit; close with this evidence when reconciling GitHub after review.
- **#134:** the lockfile is tracked, the workspace date override resolves 3.12.2,
  frozen installation passes, and both app builds pass. CI already uses frozen
  installation and builds. The original missing-lockfile report is resolved at
  this commit; no dependency upgrade is necessary.
- **#135:** the owner-scoped checkout query is present in baseline source. Its
  focused regression belongs to Phase 0C, not this installation/build report.

## Limits

These are results for the named baseline, not a claim that uncommitted Phase 0
changes or their HTTP smoke gate have passed review/CI. Re-run applicable checks
on the final Phase 0 tree and record those separately. Existing tests mock many
external integrations; hosted Clerk login, live Resend delivery, real Stripe
operations and deployed monitoring were not exercised.

The earlier `pnpm` sandbox state-file error did not recur in this permitted clean
installation. The earlier Next HTTP failure was also not a production-build
failure: both clean builds passed. The smoke harness must still prove requests
work through the actual server, not merely reuse the build result.
