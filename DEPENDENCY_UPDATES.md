# Dependency update report

## Scope

This update checks all eight workspace manifests against the npm registry on October 20, 2026.
It updates 53 distinct dependencies across 63 declarations, plus pnpm from 10.33.0 to 10.34.7.
No direct dependency crosses a major version. Compatible transitive dependencies are refreshed in `pnpm-lock.yaml`.

All peer dependency ranges, package exports, and existing public configuration options remain unchanged.
Upstream breaking changes are acceptable only when Bentocache can absorb them without breaking existing consumer code.

## Compatibility adaptations

- `@boringnode/bus` moves from 0.9.0 to 0.10.0. Its general type entrypoint now re-exports MQTT types.
  Bentocache imports `types/core` and `types/redis` instead, so consumers do not need the optional `mqtt` package.
  A packed-package consumer initially failed with `TS2307: Cannot find module 'mqtt'`.
  The same consumer compiles after this adaptation, without `skipLibCheck` and without installing MQTT.
- OpenTelemetry stable packages move from 2.6.1 to 2.12.0, and experimental packages move from 0.214.0 to 0.223.0.
  The instrumentation subclass and its public configuration remain compatible. All seven instrumentation tests pass.
- Kysely 0.29.7 is a development dependency only. Its Node.js 22 requirement does not replace users' existing Kysely installations.
  The existing `^0.27.3` peer range remains unchanged. A consumer using Kysely 0.27.3 compiles and runs against the built package.
- The documentation declares `@types/node` 25.9.9 explicitly, matching the root and simulator.
  Otherwise, pnpm resolves an optional Vite peer to Node.js types 26.6.5 and creates incompatible copies of Vite's plugin types.
  Aligning the declarations resolves simulator `TS2769` errors without type assertions or application changes.

## Blocked Orchid update

Orchid ORM updates from the exact development version 1.40.2 to **1.55.1**, not 1.78.27.
The final non-major update check reports no other pending updates.

Installing 1.78.27 produces these errors in Bentocache:

- `TS2305` for `DbResult` and `createDb` imported from `orchid-orm`.
- `TS2459` for `DefaultColumnTypes` and `DefaultSchemaConfig`, which the published root entrypoint no longer exports.

The affected files are `src/types/options/drivers_options.ts`, `src/drivers/database/adapters/orchid.ts`, and the Orchid driver test.
Paths in this section are relative to `packages/bentocache`.

This is not only an internal import change. `OrchidConfig.connection` publicly exposes
`DbResult<DefaultColumnTypes<DefaultSchemaConfig>>`, including its query inference and connection methods.
Modern connection types require `adapterNotInTransaction` instead of the legacy `adapter` contract.
The adapter also uses `connection.adapter.pool.query` for automatic table creation.
Replacing the public connection with modern types rejects existing connections.
Replacing it with a smaller structural interface removes methods from `OrchidConfig['connection']`.
Neither change preserves the existing public contract.

The [Orchid 1.56 migration instructions](https://github.com/romeerez/orchid-orm/blob/orchid-orm%401.78.27/BREAKING_CHANGES.md#L406-L435)
move database construction to driver-specific imports. Version 1.55.1 retains the legacy entrypoint and passes the existing driver tests.
Supporting newer versions requires separate compatibility work rather than forcing users to migrate their connections or weakening their types to `any`.

The historical `^1.24.0` peer range remains unchanged and still admits newer incompatible Orchid versions.
The development pin does not constrain consumers' installations or establish compatibility with every version in that peer range.

## Verification

Repository checks run on Node.js 22.23.3, matching the CI major version.
Integration services use Redis 7, Valkey 8.1, DynamoDB Local 2.6.1, PostgreSQL 17, MySQL 8.0, and a three-node Redis cluster.
`pnpm install --frozen-lockfile` succeeds in the prepared workspace.
The existing build-script allowlist excludes `sqlite3`, so its native install script was run explicitly before the SQLite tests.
A fresh install alone does not currently prepare that binding. The allowlist remains unchanged.

| Check                                              | Result                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm build`                                       | All three published packages and the simulator build successfully.                                             |
| `pnpm checks`                                      | ESLint and all five workspace typechecks pass.                                                                 |
| `env -u CI pnpm test`                              | 519 Bentocache, 7 OpenTelemetry, and 4 Prometheus tests pass. No skipped tests.                                |
| `pnpm -C docs export`                              | Frontend assets and static documentation export successfully.                                                  |
| `pnpm -C playground exec tsc --noEmit`             | The playground typechecks successfully.                                                                        |
| Prettier on changed manifests and TypeScript files | All checked files pass.                                                                                        |
| Packed-package consumer                            | Strict TypeScript compilation passes without `skipLibCheck` or MQTT. Runtime checks pass on Node.js 20 and 22. |

The separate consumer uses Kysely 0.27.3, Orchid 1.40.2, and ioredis 5.3.2 with the updated Bentocache tarball.
It checks upserts, reads, deletes, namespace isolation, clearing, TTL-bearing writes, and cross-instance Redis bus invalidation.
The PostgreSQL Kysely fixture uses an existing timestamp-based cache table, as explained below.

Browser checks render the exported documentation and the simulator with the rebuilt frontend assets.
The simulator is served from TypeScript source because its production output omits a template, as explained below.
The recorded interaction increments the shared value from 0 to 1, disables the bus, and enables it again.
The final DOM contains 17 cards and reports that the bus and L2 cache are enabled, with no browser errors.

## Remaining audit findings

`pnpm audit --prod --json` reports 5 findings, down from 226 against the original lockfile.
The remaining findings belong to the documentation or simulator dependency trees, not the published Bentocache packages.
The audit still exits with status 1. No major-version overrides are forced.

| Dependency                                      | Installed | Remaining finding                                                                  | Constraint                                                            |
| ----------------------------------------------- | --------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `@adonisjs/core`                                | 6.21.0    | [GHSA-6qvv-pj99-48qm](https://github.com/advisories/GHSA-6qvv-pj99-48qm), moderate | The advisory lists a fix in 7.3.1, outside the allowed major version. |
| `@adonisjs/http-server`                         | 7.8.1     | [GHSA-2m6q-8v3h-jqww](https://github.com/advisories/GHSA-2m6q-8v3h-jqww), moderate | The advisory lists a fix in 8.2.3.                                    |
| `@adonisjs/http-server`                         | 7.8.1     | [GHSA-524c-h47v-m3h8](https://github.com/advisories/GHSA-524c-h47v-m3h8), moderate | The advisory lists a fix in 8.2.2.                                    |
| `@faker-js/faker`, through Lucid                | 9.9.0     | [GHSA-qxc2-j82w-r537](https://github.com/advisories/GHSA-qxc2-j82w-r537), high     | The fix requires 10.5.0 or newer.                                     |
| `braces`, through the documentation build tools | 3.0.3     | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), high     | The audit lists no patched release.                                   |

## Other observed limitations

These existing configurations are outside the dependency adaptations and remain unchanged:

- The documentation uses Vite 7 with `@adonisjs/vite` 4 and plugins that declare Vite 6 peers.
  Installation still reports these peer warnings. The asset build and static export pass.
- The simulator's `adonisrc.ts` copies `resources/views/**/*.edge`, but its root view is `inertia/app/app.edge`.
  Starting the compiled production server cannot resolve that template. Browser validation uses the source server with rebuilt production assets instead.
- The unchanged Kysely adapter creates `expires_at` as `bigint`, but PostgreSQL writes send a `Date`.
  A TTL-bearing write to a fresh, isolated table fails with PostgreSQL error `22P02`.
  The existing full suite shares a timestamp-based table previously created by Knex, which masks this inconsistency.
  The separate compatibility check also uses a timestamp-based table. This update does not claim to fix isolated Kysely table creation.
