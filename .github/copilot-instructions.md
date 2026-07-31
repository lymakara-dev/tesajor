Follow AGENTS.md at the repository root — it is the single operating manual
for all AI coding agents here. Key non-negotiables: money is integer cents
(never floats); every mutation is a Zod-validated server action in
src/lib/actions/ with membership checks and an activity_log entry; domain
logic lives in pure tested modules under src/lib/; every user-facing string
goes in BOTH messages/en.json and messages/km.json; schema changes ship
with their generated Drizzle migration. Before finishing any change run:
pnpm lint && pnpm exec tsc --noEmit && pnpm test. Task recipes live in
docs/playbooks/.
