# Playbook: Change the database schema

**Use when**: adding/altering tables, columns, or enums.
**Copy the shape from**: any table in `src/db/schema.ts` — it's the whole
schema in one commented file.

## Steps

1. Read the relevant domain section of `src/db/schema.ts` and
   `docs/REFERENCE.md` first — the column you want may exist, or a design
   convention may apply (see rules below).
2. Edit `src/db/schema.ts`. Conventions to preserve:
   - Money columns: `integer` named `*_cents`. Never numeric/float.
   - `uuid` PKs with `.defaultRandom()`; timestamps `created_at` with
     `.defaultNow()`.
   - Money-related FKs point at `group_members.id`, **not** `users.id`
     (placeholder members have no user).
   - Cascade deletes follow ownership (child of group → `onDelete:
     "cascade"`); financial history is soft-deleted, not cascaded away.
   - Comment anything subtle — the file doubles as documentation.
3. Generate the migration: `pnpm db:generate`. Never hand-edit a previously
   applied migration; a mistake gets a new corrective migration.
4. Apply locally: `pnpm db:migrate` (Docker Postgres must be up).
5. If seed data should exercise the change, update `src/db/seed.ts` and
   re-run `pnpm db:seed`.
6. Update the affected table row/section in `docs/REFERENCE.md`.
7. Verify: `pnpm lint && pnpm exec tsc --noEmit && pnpm test`.
8. Commit the schema change, the new file(s) in `drizzle/`, **and**
   `drizzle/meta/` together in one commit (`feat:`/`fix:` scope).

## Don't

- Don't use `pnpm db:push` for anything shared — local prototyping only.
- Don't add a table without deciding its authorization story (who may
  read/write it — which membership check guards it).
