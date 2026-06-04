# CAREQ Design System — Clinical Precision

Source: [UI/*/DESIGN.md](../UI/landing%20page/DESIGN.md) prototypes. Use this file as the single token reference when implementing screens.

## Brand

Reliable, efficient, calm. Corporate/modern minimalism for healthcare queue management.

## Core tokens

| Token | Value | Usage |
|-------|-------|--------|
| Primary | `#004ac6` | CTAs, links, active nav |
| Background | `#faf8ff` | Page background |
| On surface | `#191b23` | Body text |
| On surface variant | `#434655` | Secondary text |
| Outline variant | `#c3c6d7` | Borders |
| Error | `#ba1a1a` | Destructive / errors |

## Typography (Inter)

- `headline-lg`: 32px / 700 — queue numbers, hero
- `headline-md`: 24px / 600 — section titles
- `headline-sm`: 20px / 600
- `body-md`: 16px / 400
- `body-sm`: 14px / 400
- `label-md`: 14px / 600, uppercase + letter-spacing for badges

## Layout

8px grid. Public pages: `max-w-7xl`, 16px mobile / 40px desktop horizontal margin. Touch targets ≥ 44px.

## Screen → route map

| UI folder | Route |
|-----------|-------|
| landing page | `/` |
| Visit entry | `/visit` |
| Patient Registation | `/registration` |
| Patien search and check in | `/patient-search` |
| check in walk in tab | `/checkin` |
| book appoinment | `/appointments` |
| my appointments | `/my-appointments` |
| queue status look up | `/status` |
| Queue status waiting/called/completed | `/status/[ref]` |
| staff login | `/login` |
| staff dashboard | `/dashboard` |
| public queue board Tv | `/queue`, `/queue/[screenId]` |
| admin * tabs | `/admin` |

## Implementation

- React components: `components/careq/*` (branded primitives)
- shadcn/ui: `components/ui/*` themed via `app/globals.css` CSS variables
- Icons: Lucide (not Material Symbols from HTML prototypes)
