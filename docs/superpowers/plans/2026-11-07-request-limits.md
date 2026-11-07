# Zod request limits

## Scope

Address [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) in both apps without changing authorization,
pricing, persistence, or unrelated dependencies. Use Zod 4.6.7 (patched floor
4.6.6). Bound JSON input before JSON parsing and validation, and bound user
booking/reservation note collections before element validation.

## Implementation and verification

- [x] Add regression tests for streamed JSON at and over 1 MiB, misleading or
      missing Content-Length, UTF-8 chunk boundaries, cancellation, malformed
      JSON, empty optional cancellation bodies, and transport failures.
- [x] Prove the new oversize cases fail against the existing implementation.
- [x] Replace both apps' unbounded text readers with capped streaming readers.
      Retain existing 400 validation envelopes and server-error treatment of
      stream failures. Preserve the optional DELETE reason. Apply the reader to
      the remaining bulk-cabin and welcome-email JSON boundaries; leave Stripe's
      signed raw webhook body unchanged.
- [x] Cap cabin, dining, and experience special-request lists and dining dietary
      lists at 100 entries of 1,000 characters, keeping defaults, empty lists,
      optional PATCH omission, and existing text unchanged. These are generous
      safety ceilings for note forms, not limits derived from production data.
- [x] Add boundary and early-rejection tests, including oversized invalid arrays
      that must not produce per-element issues. Upgrade both app manifests and
      the pnpm lockfile to 4.6.7 without unrelated package upgrades.
- [x] Attempt the workspace suite, read-only lint, formatting, type checks,
      both builds, and isolated HTTP gate. Record environment-blocked checks.
- [x] Obtain an independent review and address actionable findings.
- [ ] Complete Mongo-backed integration/database tests and the isolated HTTP
      gate in CI or a full local environment before marking the draft ready.

## Review focus

The body limit counts raw bytes, not characters or a trusted header. Streams
must stop and cancel at overflow without awaiting an indefinitely pending
cancel promise. UTF-8 characters split across chunks must survive decoding.
Authenticated routes must still reject unauthenticated requests before reading.
Empty JSON cancellation bodies must keep their existing optional-reason behavior.

## Deferred

Other staff-only catalog/profile collection limits and the Stripe raw webhook
need separate policy-specific review. The JSON body ceiling still bounds the
input consumed by existing users of the shared app-local readers.

## Local verification

Admin fast tests (1,141), customer tests (973), email tests (3), both app type
checks, formatting, lint, and all package builds pass. The MongoDB binary aborts
even on `--version` with a CPU-detection assertion in this environment. The HTTP
gate's two assertion tests pass, but its full runner cannot open the `tsx` IPC
socket. These remain explicit draft-PR gates; no live data or providers were used.
