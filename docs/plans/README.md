# Feature Plans & Tracking Board

One place to see every feature's state — planned, being built, shipped, or
being improved. Detail lives in one plan document per feature; status
lives in exactly two places (the plan's own status table and this index),
so keeping track never requires archaeology.

## Status legend

| Status | Meaning |
|---|---|
| 💡 Idea | Mentioned/desired, no design yet |
| 📝 Planned | Design written in a plan doc, not started |
| 🔨 In progress | Being implemented (link the branch/PR in the plan doc) |
| ✅ Shipped | On `main`, verified |
| 🔁 Improving | Shipped, with follow-up work listed in the plan doc |
| ⏸️ Paused | Started, deliberately on hold (say why in the plan doc) |

## Board

| Feature | Phase | Status | Plan |
|---|---|---|---|
| Trip Companion — Explore (essentials + trending) | TC-1 | ✅ Shipped | [trip-companion.md](./trip-companion.md) |
| Trip Companion — Navidrome music | TC-2 | 📝 Planned | [trip-companion.md](./trip-companion.md) |
| Trip Companion — Road routing & follow mode | TC-3 | 📝 Planned | [trip-companion.md](./trip-companion.md) |
| Trip Companion — Khmer voice welcome & reminders | TC-4 | 📝 Planned | [trip-companion.md](./trip-companion.md) |
| CI hardening (E2E in CI, branch protection) | — | 💡 Idea | [ROADMAP](../ROADMAP.md) P0/P1 |
| Stripe Pro tier | — | 💡 Idea | [ROADMAP](../ROADMAP.md) P2 |
| Receipt OCR | — | 💡 Idea | [ROADMAP](../ROADMAP.md) P3 |

Shipped core features (expense engine, balances, Telegram, trips,
i18n, …) are tracked in the [ROADMAP status table](../ROADMAP.md) — this
board is for what's *next and in flight*.

## The workflow (how to add / build / improve without headache)

1. **New idea** → add a row here as 💡 with a one-liner (or a ROADMAP
   backlog bullet if it's small). No doc needed yet.
2. **Ready to design** → write `docs/plans/<feature>.md` (copy the shape
   of [trip-companion.md](./trip-companion.md): context → design per
   phase → rollout table with per-phase status → open questions). Flip
   the row to 📝.
3. **Start building** → flip to 🔨 here *and* in the plan's rollout
   table; work follows the [playbooks](../playbooks/) and `AGENTS.md`.
   One phase at a time; phases should be shippable independently.
4. **Ship** → flip to ✅, tick the phase in the plan doc, move any
   leftovers into an "Improvements" section at the bottom of the plan
   doc, update [ROADMAP](../ROADMAP.md) if it closes a roadmap item, and
   update [REFERENCE](../REFERENCE.md)/[ARCHITECTURE](../ARCHITECTURE.md)
   for any new tables/actions/modules.
5. **Improve an existing feature** → don't start a new doc; add the item
   to the plan doc's "Improvements" list and set the row to 🔁 while
   working on it.

Rules that keep this honest:

- A status change is part of the PR that causes it — same commit,
  never "later".
- Statuses live **only** in this table and the plan doc's rollout table.
  Don't scatter status claims into other docs.
- AI agents: `AGENTS.md` § "Keep the docs true" applies — treat a stale
  board as a bug.
