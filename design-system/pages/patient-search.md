# Patient Search (`/patient-search`)

Overrides [MASTER.md](../MASTER.md). Locked tokens unchanged (`#004ac6`, Inter, JetBrains Mono).

## Layout

- Search-first: term field is visual hero; DOB secondary in 2-col grid on `sm+`
- Single `CareqCard`; flat `divide-y` result list — no nested cards per row
- Desktop: search button inline with fields (`sm:col-span-2` row or side-by-side)
- Touch targets ≥ 44px on all CTAs

## Copy budget

- PageHeader only for title/subtitle; one helper under search term
- Privacy: one linked line (`How we protect your data`) — real `<button>` or `<Link>`, not dead span
- Empty state: title + one short line max; primary action Register

## Results

- Row: name (`body-md` semibold), masked phone + patient `#` (`body-sm` muted)
- Actions right: **Check in today** (primary), **Book** (outline)
- `aria-live="polite"` on result count; 2 skeleton rows while loading

## Accessibility (ui-ux-pro-max)

- Labels with `htmlFor`; focus rings on inputs/buttons
- `cursor-pointer` on all interactive elements
- `prefers-reduced-motion`: no layout-shift hovers
