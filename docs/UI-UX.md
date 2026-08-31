# UI-UX

This document describes how the frontend is put together: the shell pattern each role uses, the conventions components follow, the design tokens they read from, the accessibility baseline you should hold yourself to, and how the layout responds to viewport changes. It is descriptive, not aspirational — every claim is grounded in the current source. For the audit findings, see [AUDIT.md](./AUDIT.md).

## Audience

You are reading this if you are about to add a page, add a role shell, or change how the app looks or behaves. You should be able to read this in five minutes and have a working mental model. If something in the source disagrees with this document, treat the source as correct and update the doc.

## Design tokens

All tokens live in a single Tailwind 4 `@theme` block at `app/globals.css:5-65`. There are five families:

1. **Brand palette.** `lamaSky`, `lamaPurple`, `lamaYellow` plus light variants. Use these for primary CTAs and surface accents.
2. **Workspace surfaces.** `workspace-canvas`, `workspace-sidebar`, `workspace-foreground`, `workspace-muted`, `workspace-border`. Every shell reads from this set so the canvas-to-content contrast is consistent.
3. **Brand actions.** Action-colored variants of the brand palette for buttons and links.
4. **Role stat tiles.** Distinct accent per role (admin, teacher, parent, student, payments). Use these when you need to differentiate a card by audience.
5. **Radius, elevation, motion.** `radius-xs` through `radius-2xl`, `elevation-xs` through `elevation-focus`, and easing/duration CSS variables that `animate-enter-up` reads from.

You should prefer tokens over raw values. If you reach for `bg-slate-50` or `text-[#0f172a]` directly, you are off the design system — open `app/globals.css` and add a token instead.

## Shell patterns

There are two shell layouts in the codebase.

The **CSS-grid shell** (`components/AdminShell.tsx`, `components/PaymentsShell.tsx`) uses the `.zamschool-workspace-shell` grid from `app/globals.css:159-175`. The grid is `100dvh` tall, single column on mobile, `14rem minmax(0, 1fr)` at `1024px`. The sidebar is a `<div class="zamschool-workspace-shell__sidebar">` with `position: fixed` below `lg:` and a box-shadow. The main scroll area uses `.zamschool-workspace-main-scroll` (`app/globals.css:226-232`).

The **flex shell** (`components/TeacherShell.tsx`, `components/ParentShell.tsx`, `components/StudentShell.tsx`) uses `flex h-screen overflow-hidden` with a `fixed inset-y-0 left-0 z-40 w-64` sidebar on mobile and `lg:relative` on desktop. This pattern is older and has inconsistent sidebar widths (see [AUDIT.md](./AUDIT.md) item 4 under Needs Work).

`components/RoleBasedShell.tsx:12-20` dynamic-imports the right shell per role and falls back to `AdminShell` for unknown roles. Add a new shell by adding a dynamic import and a role check; do not branch on role inside an existing shell.

## Component conventions

1. **One component per file, default export at the bottom**, named after the file. Side components (e.g. `AdminSidebar`, `HeaderActions`, `MobileDock`) live in the same file as the shell that owns them.
2. **Derived data uses `useMemo`.** Stable callbacks use `useCallback` with the smallest dep array you can justify. Do not memoize primitives.
3. **Profile bootstrap is one of three patterns**: `useWorkspaceContext()` (admin, payments), a role-scoped provider (teacher), or a manual `/api/account/shell` fetch with a `useRef(false)` re-entry guard (parent, student). See [AUDIT.md](./AUDIT.md) item 1 under Needs Work — pick one before adding the next shell.
4. **`MobileDock` accepts `isActive`** as either `undefined` (exact-match against `pathname`) or a function `(path, href) => boolean`. Read the existing shells before you change the contract; the API drifts across files today.
5. **Numeric alignment uses `.ws-tabular`.** Use it for any column of figures (attendance counts, revenue, grades).
6. **Loading states are full-shell.** Use `<WorkspaceLoader>` or the `shellFallback` from `RoleBasedShell.tsx`. Do not render partial layout with raw spinners inline.

## Accessibility

This is the baseline you should hold yourself to. The current code does not meet it everywhere (see [AUDIT.md](./AUDIT.md) item 5 under Needs Work) — when you touch a shell, move it closer to this bar.

1. **Sidebar and mobile dock need `role="navigation"` and `aria-label`.** Today they are unlabelled `<aside>` / `<nav>` elements.
2. **Hamburger buttons need `aria-expanded`, `aria-controls`, and `aria-label`.** The current overlays have `aria-label="Close sidebar"` but no expansion state.
3. **Loaders and error states need `role="status"` or `role="alert"`** so screen readers announce them. Today they are silent.
4. **Focus visibility.** The avatar link uses `hover:ring-2 hover:ring-sky-100` as a focus indicator. Move that to `focus-visible:ring-2 focus-visible:ring-sky-100` so keyboard users get the same affordance.
5. **Color contrast.** The brand-yellow and brand-purple on white are the most likely offenders. If a token combination fails WCAG AA at 14px or below, do not use it for body text — use it only for surfaces, badges, or ≥18px headings.
6. **Skip to content.** No shell has a skip link today. Add `<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>` as the first focusable child of the shell.

## Responsiveness

There are three breakpoints in active use: `sm` (640px), `md` (768px), and `lg` (1024px). The shell breakpoint is `lg`. `hooks/use-mobile.ts:4` uses `(max-width: 767px)` which is the inverse of Tailwind `md:`.

You should follow these rules:

1. **Hide, do not shrink.** Sidebar school name, search bar, avatar text — all hidden below `sm:` / `lg:` rather than compressed. Use `hidden sm:inline` or `lg:hidden`.
2. **Use `100dvh` for shell height** so the mobile address bar does not cause the layout to overflow. Already done in `app/globals.css:171`; do not regress to `100vh`.
3. **Use `clamp()` for fluid horizontal padding.** The reference is `padding-inline: clamp(1rem, 2vw, 1.5rem)` at `app/globals.css:226-232`.
4. **`MobileDock` is `fixed bottom-0`** at the mobile breakpoint only. Anchor it inside a `<nav>` and use a stable column count (4 or 5) per shell.
5. **`prefers-reduced-motion`** should disable `animate-enter-up` as well as loader dots. Add it when you add new animations.

### Mobile overflow containment (2026-08-31)

1. **Root-level overflow containment.** `html` and `body` both have `overflow-x: hidden` in `app/globals.css`. This prevents wide flex items from expanding the layout viewport past device width, which would cause mobile browsers to ignore the viewport meta tag and render the desktop layout squished.
2. **Body text wrapping.** `body` also has `overflow-wrap: break-word` and `word-break: break-word` to ensure long unbroken text wraps.
3. **Flex item min-width override on landing page.** Every flex item containing text across the landing page (`app/page.tsx`) now has `min-w-0` and `break-words` classes. This overrides the browser default `min-width: auto` on flex items that prevented text wrapping. Applied to: hero badge, platform feature lists, module breakdown items, comparison table cells, mobile comparison cards, pilot included/terms lists, leadership checklist spans, FAQ questions/answers.
4. **SystemStatusBadge label.** The label span in `SystemStatusBadge.tsx` also got `min-w-0 break-words`.
