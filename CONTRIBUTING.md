# Contributing to LodgeFlow

The guest site and staff dashboard share a database and can run side by side. Run the commands below from the repository root.

## Run the apps locally

1. Install Node.js 22 and pnpm 11.17.0, the versions used in CI.

   ```sh
   pnpm install --frozen-lockfile
   cp apps/customer/.env.example apps/customer/.env.local
   ```

2. Create `apps/admin/.env.local`. In both apps, set `MONGODB_URI` to the same development MongoDB replica set and set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the same Clerk development instance. Set `NEXT_PUBLIC_APP_URL=http://localhost:3001` in the guest app so local checkout returns there. [Guest configuration](apps/customer/.env.example)

3. For dashboard access, set `LODGEFLOW_STAFF_ORG_ID` in the admin app and use an organization member with a staff assignment. The staff guide links to the first-administrator bootstrap. [Staff setup](apps/admin/README.md#local-setup)

4. Start the apps in separate terminals.

   | App             | Command             | Local address                           |
   | --------------- | ------------------- | --------------------------------------- |
   | Staff dashboard | `pnpm dev:admin`    | [localhost:3000](http://localhost:3000) |
   | Guest site      | `pnpm dev:customer` | [localhost:3001](http://localhost:3001) |

For checkout, refunds, or email delivery, configure development provider credentials for the app handling the operation. The local admin seed command exits without writing data. The HTTP harness creates its own sample records. [Guest payments and email](apps/customer/README.md#payments-and-email) · [Staff payments and email](apps/admin/README.md#payments-and-email)

## Check a change

| Command          | What it checks                                                                   |
| ---------------- | -------------------------------------------------------------------------------- |
| `pnpm ci:check`  | Formatting, syntax rules, read-only lint, and tests across the workspace         |
| `pnpm test:http` | HTTP requests against both apps with disposable MongoDB and controlled providers |
| `pnpm build`     | Both production application builds and the shared package type checks            |

Database integration tests start local MongoDB processes. Builds need a Clerk publishable key for prerendering. The CI workflow includes a throwaway public key and also checks the admin tests and scripts with TypeScript. [CI workflow](.github/workflows/ci.yml) · [HTTP harness](docs/refactoring/http-smoke.md)

For documentation changes, check relative links, image paths, and edited Markdown explicitly. The workspace formatter skips Markdown by default.

```sh
pnpm exec prettier --check --ignore-path /dev/null README.md CONTRIBUTING.md
```

## Open a pull request

Keep each change focused. For work on reservations or payments, cover the affected behavior across both apps and the shared database package. Include the commands you ran and their results in the pull request. For changes to the screenshot tour, capture the pages with fictional guest data.

[Agent guide](AGENTS.md) · [Refactoring plan](docs/refactoring/plan.md) · [Issue template](docs/issues_template.md) · [Pull request template](docs/pull_requests_template.md)
