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

Each app needs its own `.env.local`. `apps/admin/CLAUDE.md` documents its required
variables under **Environment Variables Required**; `apps/customer/.env.example`
documents its — copy it to `.env.local` and fill in real values.

## Workspace scripts

| Command | Effect |
| --- | --- |
| `pnpm build` | Build both apps |
| `pnpm test` | Test both apps |
| `pnpm ci:check` | Format check, lint, and test everything |
| `pnpm --filter @lodgeflow/admin <script>` | Run a script in one app |

`pnpm build` requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (both apps, for `ClerkProvider`
during prerendering) and, admin-only, `RESEND_API_KEY` (`apps/admin/app/api/send/*`
constructs its Resend client at module scope). See `.github/workflows/ci.yml` and
`apps/admin/CLAUDE.md` for details.

## Structure

- `apps/*` — the two Next.js applications, each self-contained
- `packages/*` — reserved for shared code, not created yet. `pnpm-workspace.yaml`
  already includes the glob for when it lands; see the design spec in
  `docs/superpowers/specs/`

Both apps currently carry their own copy of `models/`, and the two copies have
diverged in semantics. Do not merge them ad hoc — see the spec.
