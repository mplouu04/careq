# Staff Dashboard (`/dashboard`)

Overrides [MASTER.md](../MASTER.md). Light Clinical Precision theme — ignore dark/analytics generator palettes.

## Information hierarchy

1. Page title + date
2. `QueueCommandBar` — single row: Doctor, Room, Call next, Live dot
3. **StatCard 2×2 grid** (avg, served, waiting, no show) — above kanban
4. Kanban: mobile tabs (`xl:hidden`) + 4-col grid (`xl:grid`)

## Command bar

- `aria-label` on selects; no label paragraphs
- Live: emerald dot when connected, amber when offline; pulse respects `motion-reduce`
- Disabled Call next: reduced opacity + `title` hint, no paragraph below

## Kanban density

- Waiting rows ≤ 72px: mono ID, name, est wait, Recall
- In-progress: compact row with inline Skip / No Show / Done
- Column headers: semantic color + Lucide icon (`StatusBadge` or icon in header)
- Completed / no-show: mono ID + name, single line

## Tokens

- Queue IDs: `font-mono-careq`
- In-progress accent: `status-called` / amber only where status-appropriate
- No-show: `status-no-show` tokens

## Deduplication

- Shared row components (`WaitingRow`, `InProgressRow`, `QueueListRow`)
- One column config for desktop grid and mobile tab content
