# Playbooks

Step-by-step recipes for the recurring task shapes in this repo. They are
tool-agnostic: any AI agent or human can execute them. Each one names the
existing file to copy the shape from — mirroring an existing pattern is
always preferred over inventing a new one.

| Playbook | Use when |
|---|---|
| [change-the-db-schema.md](./change-the-db-schema.md) | Adding/altering tables, columns, enums |
| [add-a-server-action.md](./add-a-server-action.md) | Any new mutation (the only write path) |
| [add-domain-logic.md](./add-domain-logic.md) | New math/rules: money, splits, quests, permissions |
| [add-ui-text-i18n.md](./add-ui-text-i18n.md) | Any new or changed user-facing string |

If your task doesn't fit a playbook, read `docs/ARCHITECTURE.md`, find the
closest existing implementation via `docs/REFERENCE.md`, and follow the
hard rules in `AGENTS.md`. If you find yourself doing a new task shape
twice, write the playbook.
