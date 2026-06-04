# UI Integration — Implementation Roadmap

**Status:** Ready to execute. **Blocker:** Cursor is in Plan mode — switch to **Agent** mode to apply code changes.

## Audit summary (current codebase)

| Area | State | Action |
|------|-------|--------|
| Routes | All 26 prototype screens have matching routes | Restyle only |
| APIs | Complete for patients, queue, admin | Preserve; extend `/api/queue/public` for `screenId` in Phase 6 |
| Styling split | Public/staff use `#0d6efd` + `.careq-*`; admin uses shadcn | Unify to Clinical Precision `#004ac6` via CSS variables |
| Modals | Custom `useFocusTrap` divs in patient/staff | Migrate to `ConfirmDialog` → shadcn `Dialog` |
| Icons | Inline SVG + Lucide in headers | Standardize on Lucide |
| Display screens | Admin config exists; `/queue` ignores it | Add `/queue/[screenId]` + API filter |
| Hardcoded blue | 40+ occurrences of `#0d6efd` | Replace with `bg-primary`, `text-primary`, `CAREQ_PRIMARY` |

**Business logic:** Do not change fetch URLs, validation messages, or Supabase flows. UI-only diffs except Phase 6 routing.

---

## Phase 0 — Tokens (why: single source of truth)

**Files:** `app/globals.css`, `tailwind.config.ts`, `lib/design-tokens.ts`, `design-system/MASTER.md`

### `lib/design-tokens.ts`

```ts
export const CAREQ_PRIMARY = "#004ac6";
export const CAREQ_DEFAULT_THEME_COLOR = CAREQ_PRIMARY;
```

### `app/globals.css` `:root` changes

```css
:root {
  --background: 250 100% 99%;      /* #faf8ff */
  --foreground: 222 47% 11%;       /* #191b23 */
  --primary: 222 100% 39%;         /* #004ac6 */
  --primary-foreground: 0 0% 100%;
  --radius: 0.75rem;
  --status-waiting: 222 100% 39%;
  --status-called: 142 76% 36%;
  --status-completed: 215 16% 47%;
  --secondary-container: 214 89% 93%;
  --on-secondary-container: 215 25% 40%;
}
```

### `.careq-card` fix (why: remove layout-shift hover)

Remove `transform: translateY(-5px)` on hover. Use `shadow-md` + `border-border` only.

### `tailwind.config.ts`

Extend `fontSize` (headline-lg, body-md, …), `spacing` (margin-mobile, margin-desktop), semantic `status-*` colors.

---

## Phase 1 — `components/careq/` (why: DRY, SOLID)

| File | Responsibility |
|------|----------------|
| `careq-page.tsx` | Layout shell: `max-w-careq`, responsive horizontal padding |
| `careq-card.tsx` | Surface card; `hoverable` optional |
| `status-badge.tsx` | `waiting` \| `called` \| `completed` \| `error` |
| `empty-state.tsx` | Icon + title + description + optional CTA |
| `page-header.tsx` | Title, subtitle, back link |
| `confirm-dialog.tsx` | Controlled Dialog wrapper (replaces custom modals) |
| `index.ts` | Barrel export |

**Principle:** Feature components depend on `careq/*`, not raw Tailwind strings.

---

## Phase 2 — Public shell

**Why:** Prototype landing drives nav + marketing structure for entire public UX.

| File | Change |
|------|--------|
| `components/layout/PublicHeader.tsx` | Light sticky bar, links `/visit`, `/status`, Staff Login |
| `components/layout/PublicFooter.tsx` | **New** — copyright + links from `UI/landing page/code.html` |
| `app/(public)/layout.tsx` | `bg-background`, include footer |
| `app/(public)/page.tsx` | Full hero, stats, features, CTA banner |

---

## Phase 3 — Patient (order matters)

1. `RegistrationForm.tsx` — `CareqCard`, `ConfirmDialog` for duplicate/success
2. `PatientSearch.tsx` — `EmptyState`, verify dialog
3. `CheckinForm.tsx` — shadcn `Tabs` styling
4. `AppointmentForm.tsx`, `MyAppointments.tsx`
5. `QueueStatus.tsx` — `StatusBadge`, large queue number typography
6. Thin pages: `visit/page.tsx`, `status/page.tsx`, `registration/page.tsx` — `PageHeader`

---

## Phase 4 — Staff

- `LoginForm.tsx` + `app/login/page.tsx`
- `DashboardQueue.tsx` — empty waiting `EmptyState`, call/recall `ConfirmDialog`
- `StaffHeader.tsx` — primary color tokens

---

## Phase 5 — Admin

- `AdminPanel.tsx` — Dialog for edit modals; `StatusBadge` for appointment status; default theme `#004ac6`
- `app/api/admin/settings/route.ts` — default `CAREQ_DEFAULT_THEME_COLOR`

---

## Phase 6 — TV board

- `app/queue/[screenId]/page.tsx` — new
- `app/api/queue/public/route.ts` — optional `?screenId=`
- `QueueBoard.tsx` — theme_color, show_wait_time, show_priority
- Admin: "Open board" link per screen

---

## Phase 7 — Verification

```bash
npm run build
npm test
```

Manual: `docs/SMOKE_CHECKLIST.md` sections 1–8.

---

## Global find-replace (after tokens)

| From | To |
|------|-----|
| `#0d6efd` | `primary` classes or `CAREQ_PRIMARY` in inline styles |
| `#0b5ed7` | `hover:bg-primary/90` |
| `careq-navbar` solid blue | Remove; header uses `PublicHeader` light style |

---

## Next step for agent

When Agent mode is active, run phases 0→2 first, then `npm run build`, then phases 3–7 incrementally with a commit per phase if requested.
