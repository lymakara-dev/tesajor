# ADR-0002: Drizzle ORM over Prisma

- **Status**: Accepted (backfilled)
- **Date**: 2026-07-31 (documents a decision made at project start)

## Context

The plan allowed "Drizzle (or Prisma)". We need type-safe queries and
migrations against Postgres from serverless Next.js. Prisma at the time
carried a heavier runtime (query engine), slower cold starts on serverless,
and a schema DSL separate from TypeScript. Raw SQL was rejected for
maintainability of 22 interrelated tables.

## Decision

Drizzle ORM (`drizzle-orm` + `drizzle-kit`) with the `postgres.js` driver.
Schema is TypeScript in `src/db/schema.ts`; migrations are generated SQL in
`drizzle/` applied via `pnpm db:migrate`. Auth.js integrates through
`@auth/drizzle-adapter`.

## Consequences

Thin runtime, SQL-shaped queries that are easy to reason about for the
balance aggregations, one language for schema and code. Costs: fewer
batteries than Prisma (no built-in soft-delete or middleware — soft deletes
are explicit `deleted_at` filters in queries), and `drizzle/meta/`
snapshots must be committed with every migration. Revisit if Drizzle's
migration tooling becomes a bottleneck for a larger team.
