# Playbook: Add a server action (any mutation)

**Use when**: the app needs a new write of any kind. Server actions are the
only write path — no mutations in components, route handlers (except the
four existing API routes), or client code.
**Copy the shape from**: `src/lib/actions/settlements.ts` (short, canonical)
or `src/lib/actions/expenses.ts` (complex, multi-table, invariants).

## The canonical shape

Every action follows exactly this sequence — keep the order:

```ts
"use server";
export async function doThing(input: unknown): Promise<ActionResult<...>> {
  // 1. Session
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  // 2. Zod parse (schema lives in src/lib/validation/<domain>.ts)
  const parsed = doThingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  // 3. Authorization: group/trip membership + cross-checks
  //    requireUserIsMember / requireGroupMemberIds (groups)
  //    getTripRole + src/lib/trips/permissions.ts (trips)

  // 4. Domain logic via pure functions from src/lib/** — never inline math

  // 5. db.transaction: writes + activityLog.insert (group data)

  // 6. revalidatePath(...) for every page whose data changed

  return { ok: true, data: { ... } };
}
```

## Steps

1. Add the Zod schema to the matching file in `src/lib/validation/`
   (create `<domain>.ts` if new). Validate tightly: `z.uuid()`,
   `.int().positive()` for cents, `.trim().max(n)` for strings, `.refine`
   for cross-field rules. The parameter type is always `input: unknown`.
2. Write the action in the matching `src/lib/actions/<domain>.ts` following
   the shape above. If it touches money, enforce the invariants
   (Σ paid = Σ owed = total) server-side even though the client validated.
3. Rate-limit abusable actions with `checkRateLimit` from
   `src/lib/rate-limit.ts` (see `auth.ts` registration and
   `payment-requests.ts` for the pattern).
4. If new domain math is involved, do
   [add-domain-logic.md](./add-domain-logic.md) first.
5. Wire the client: call the action from a form/component, render
   `ok: false` errors, and add any new user-facing strings per
   [add-ui-text-i18n.md](./add-ui-text-i18n.md).
6. Update the actions table in `docs/REFERENCE.md`.
7. Verify: `pnpm lint && pnpm exec tsc --noEmit && pnpm test`, then
   exercise the flow in the browser against seed data.

## Don't

- Don't accept computed amounts/XP/roles from the client — accept raw
  inputs and compute server-side.
- Don't skip the `activity_log` insert for group-data writes, and don't
  hard-delete financial rows (soft-delete via `deleted_at`).
- Don't throw for expected failures — return `{ ok: false, error }` so the
  UI can render it.
