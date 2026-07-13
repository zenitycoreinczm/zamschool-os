---
version: alpha
name: ZamSchool Mobile Portals
description: >
  Mobile-first visual identity for ZamSchool student, teacher, and parent
  portals. Soft institutional workspace language grounded in the existing
  zamschool-os workspace tokens — canvas greys, white cards, brand sky, and
  role-tinted accents. Suitable for Zambian schools.
colors:
  primary: "#0284c7"
  primary-hover: "#0369a1"
  primary-muted: "#e0f2fe"
  primary-soft: "#0ea5e9"
  canvas: "#f4f6f9"
  sidebar: "#f8f9fb"
  foreground: "#0f172a"
  muted: "#64748b"
  border: "rgb(226 232 240 / 0.92)"
  border-strong: "rgb(203 213 225 / 0.95)"
  surface: "#ffffff"
  on-primary: "#ffffff"
  danger: "#e11d48"
  danger-soft: "#fff1f2"
  danger-border: "#fecdd3"
  warning: "#d97706"
  warning-soft: "#fffbeb"
  success: "#059669"
  success-soft: "#ecfdf5"
  role-student: "#ddd6fe"
  role-student-accent: "#0f766e"
  role-student-active-bg: "#f0fdfa"
  role-student-active-text: "#134e4a"
  role-student-ring: "#99f6e4"
  role-teacher: "#fef3c7"
  role-teacher-accent: "#0284c7"
  role-teacher-active-bg: "#f0f9ff"
  role-teacher-active-text: "#0c4a6e"
  role-teacher-ring: "#bae6fd"
  role-parent: "#ffedd5"
  role-parent-accent: "#0f766e"
  role-parent-active-bg: "#f0fdfa"
  role-parent-active-text: "#134e4a"
  role-parent-ring: "#99f6e4"
  role-admin: "#e0e7ff"
  chart-sky: "#7dd3fc"
  chart-sky-light: "#e0f2fe"
  chart-purple: "#a5b4fc"
  chart-purple-light: "#eef2ff"
  chart-yellow: "#fcd34d"
  chart-yellow-light: "#fef9c3"
  selection: "#0ea5e9"
  overlay: "rgb(15 23 42 / 0.20)"
  glass: "rgb(255 255 255 / 0.75)"
typography:
  font-sans:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
  display:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    fontSize: 1.875rem
    fontWeight: 600
    lineHeight: 1.25
  h1:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.3
  h2:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.35
  body-md:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.3
  eyebrow:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    fontSize: 0.6875rem
    fontWeight: 600
    letterSpacing: 0.2em
    lineHeight: 1.2
  dock-label:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    fontSize: 0.625rem
    fontWeight: 500
    lineHeight: 1.2
  tabular:
    fontFamily: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
rounded:
  xs: 0.5rem
  sm: 0.625rem
  md: 0.75rem
  lg: 1rem
  xl: 1.25rem
  2xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  page-x: 16px
  page-y: 16px
  section: 24px
  dock-height: 64px
  header-height: 60px
  sidebar-width: 256px
  touch-min: 44px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  button-secondary-hover:
    backgroundColor: "#f8fafc"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: 20px
  card-elevated:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: 20px
  card-hero:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: 24px
  dock-item-active-student:
    backgroundColor: "{colors.role-student-active-bg}"
    textColor: "{colors.role-student-active-text}"
    rounded: "{rounded.md}"
  dock-item-active-teacher:
    backgroundColor: "{colors.role-teacher-active-bg}"
    textColor: "{colors.role-teacher-active-text}"
    rounded: "{rounded.md}"
  dock-item-active-parent:
    backgroundColor: "{colors.role-parent-active-bg}"
    textColor: "{colors.role-parent-active-text}"
    rounded: "{rounded.md}"
  dock-item-idle:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
  nav-item-active-student:
    backgroundColor: "{colors.role-student-active-bg}"
    textColor: "{colors.role-student-active-text}"
    rounded: "{rounded.lg}"
    padding: 8px 10px
  nav-item-active-teacher:
    backgroundColor: "{colors.role-teacher-active-bg}"
    textColor: "{colors.role-teacher-active-text}"
    rounded: "{rounded.lg}"
    padding: 8px 10px
  nav-item-active-parent:
    backgroundColor: "{colors.role-parent-active-bg}"
    textColor: "{colors.role-parent-active-text}"
    rounded: "{rounded.lg}"
    padding: 8px 10px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 10px 12px
  badge-unread:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    size: 16px
  alert-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.xl}"
    padding: 12px 16px
  alert-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.xl}"
    padding: 12px 16px
  offline-banner-offline:
    backgroundColor: "{colors.danger-soft}"
    textColor: "#9f1239"
  offline-banner-slow:
    backgroundColor: "{colors.warning-soft}"
    textColor: "#92400e"
---

## Overview

ZamSchool Mobile Portals is a **soft institutional workspace** for students, teachers, and parents in Zambian schools. The product should feel calm, trustworthy, and school-ready — not playful consumer ed-tech and not dense enterprise admin chrome.

**Brand essence:** soft canvas greys, white elevated cards, sky-blue primary actions, and light role-tinted accents (teal for student/parent, sky for teacher). Surfaces breathe; numbers use tabular figures; motion is short and ease-out only.

**Style keywords:** soft · institutional · mobile-first · role-tinted · thumb-zone · progressive disclosure.

**Visual source of truth:** the flex shells and dashboards in `zamschool-os-app-main` (`StudentShell`, `TeacherShell`, `ParentShell`, role dashboards, `lib/workspace/design.ts` tokens). Implementation target is `Zamschool-main` evolving those shells — not a greenfield brand or a separate native app in v1.

## Colors

The palette is anchored in the existing Tailwind `@theme` tokens in `app/globals.css`. Prefer semantic tokens over raw hex in application code.

### Core surfaces
- **Canvas (`#f4f6f9`):** page background for every portal shell.
- **Sidebar (`#f8f9fb`):** drawer / desktop rail background, slightly lighter than canvas.
- **Surface (`#ffffff`):** cards, dock, dialogs, hero panels.
- **Foreground (`#0f172a`):** primary text and icons on light surfaces.
- **Muted (`#64748b`):** secondary labels, meta, idle nav.
- **Border (`rgb(226 232 240 / 0.92)`):** default hairlines; use **border-strong** for dashed empty states.

### Brand actions
- **Primary (`#0284c7`):** primary buttons, key links, focus-adjacent brand moments.
- **Primary hover (`#0369a1`):** pressed / hover for primary CTAs.
- **Primary muted (`#e0f2fe`):** soft brand chips, selected calendar tiles, muted brand fill.
- **Selection / soft brand (`#0ea5e9`):** text selection and focus ring base (`shadow-workspace-focus`).

### Role identity (surfaces + accents — not body text on pastel alone)
| Role | Tile / soft fill | Nav & dock active | Notes |
|------|------------------|-------------------|-------|
| Student | violet `#ddd6fe` / gradient `from-violet-100/90 via-violet-50 to-white` | teal (`bg-teal-50 text-teal-900 ring-teal-200/80`) | Dock `activeAccent="teal"`, columns=4 |
| Teacher | amber `#fef3c7` / `from-amber-100/90 via-amber-50 to-white` | sky (`bg-sky-50 text-sky-900`, dock `activeAccent="sky"`) | Stats often amber-tinted icons |
| Parent | orange `#ffedd5` / `from-orange-100/90 via-orange-50 to-white` | teal (same family as student) | Multi-child chrome stays teal |

Role pastels are for **stat tiles, hero gradients, and identity chips only**. Body copy on pastel backgrounds must meet WCAG AA (use dark slate/teal/sky text, never yellow-on-white for 14px body).

### Semantic status
- **Danger:** rose (`#e11d48` on `#fff1f2`) for offline hard state, form errors, destructive confirm.
- **Warning:** amber soft for slow network and attention banners.
- **Success:** emerald soft for present / submitted / complete.

### Charts (legacy lama names preserved)
- `lamaSky` / `lamaPurple` / `lamaYellow` and light variants for charts only — do not use as primary button fills on mobile portals.

## Typography

Use the **system UI sans stack** (no custom webfont requirement for v1). Enable font features `cv02`, `cv03`, `cv04`, `cv11`, and tabular numbers on body.

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| Eyebrow (`.ws-eyebrow`) | 11px / 0.6875rem | 600 | Uppercase section kicker; letter-spacing `0.2em` |
| Display / hero name | 30px mobile → 30–36px | 600 | Dashboard hero name |
| H1 page | 24px | 600 | In-page titles |
| H2 card | 18px | 600 | Card titles |
| Body | 14px | 400 | Default copy |
| Body sm | 13px | 400 | Dense lists, table secondary |
| Label | 12px | 600 | Buttons, field labels |
| Dock label | 10px | 500 | Mobile dock captions only |
| Tabular (`.ws-tabular`) | inherits | 700 for stats | Attendance counts, grades, fees |

**Rules**
- Never set body text below 12px except dock labels (10px) and badge numerals (9–10px).
- Prefer `text-slate-900` for titles and `text-slate-500` / `workspace-muted` for meta.
- Truncate long school names and child names with `min-w-0 truncate` rather than wrapping the shell header.

## Layout

### Breakpoints
- **Mobile (default → &lt;1024px):** dock-first; sidebar is an off-canvas drawer.
- **sm 640px:** show global search; hide secondary chrome that would compress.
- **md 768px:** denser grids (2-col stats).
- **lg 1024px:** desktop rail sidebar (`relative`); dock hidden; content padding relaxes.

### Shell geometry (flex portals)
- Outer: `flex h-screen overflow-hidden` + canvas background. Prefer **`100dvh`** for grid-class shells; keep mobile browser chrome safe.
- Sidebar: `fixed inset-y-0 left-0 z-40 w-64` (16rem) or `w-[17.5rem]` when identity block needs room; `-translate-x-full` closed, `translate-x-0` open; `lg:relative lg:translate-x-0`.
- Overlay: `bg-slate-900/20 backdrop-blur-[2px]` when drawer open (`z-30`).
- Header: glass/blur `bg-workspace-canvas/95 backdrop-blur-sm`, border-b, hamburger `lg:hidden`, school name + year/term, search `hidden sm:…`, inbox/messages, avatar.
- Main: scroll region with **mobile bottom padding `pb-24`** so content clears the dock; `lg:pb-6`.
- Mobile dock: `fixed bottom-0 left-0 right-0 z-30`, white, top border, **4 or 5 equal columns**, `lg:hidden`.

### Spacing scale
- Page padding: `p-4 md:p-6` on dashboards.
- Vertical rhythm between sections: `space-y-6` / `gap-6`.
- Card internal: `p-5` default, hero `p-6`.
- Touch targets: **minimum 44×44px** for dock items, hamburger, avatar, primary actions.
- **Hide, do not shrink:** school name, search, avatar text use `hidden sm:inline` / similar rather than squashing.

### Content layout patterns
- **Hero → stats → primary lists → secondary rail:** student and parent dashboards use `xl:grid-cols-[minmax(0,1fr),360px]` with announcements in the rail (rail stacks under main on mobile).
- **Teacher:** hero with stats → attention banner → quick actions → schedule / workload / profile / announcements.
- **Thumb zone:** primary CTAs and dock destinations live in the lower half on phone; destructive actions are never the only bottom-right control without confirmation.

## Elevation & Depth

| Token | Value intent | Use |
|-------|--------------|-----|
| `shadow-workspace-xs` | 0 1px 2px slate/4% | Active nav chip, secondary button |
| `shadow-workspace-sm` | soft dual layer | Default cards, primary button |
| `shadow-workspace-md` | medium dual layer | Elevated cards, popovers, skip-link focus |
| `shadow-workspace-lg` | large dual layer | Rare modals / drawer emphasis |
| `shadow-workspace-focus` | 0 0 0 3px sky/22% | `:focus-visible` rings |

**Depth rules**
- Cards sit on canvas with white fill + `border-workspace-border` + `shadow-workspace-sm`.
- Header uses translucency + blur rather than a heavy drop shadow.
- Dock is flat white with a top border (not a floating pill in v1).
- Hover lift (`ws-hover-lift`, −2px) is desktop-only courtesy; respect `prefers-reduced-motion`.
- Motion durations: fast 150ms, normal 220ms, slow 380ms; easing `cubic-bezier(0.16, 1, 0.3, 1)`.

## Shapes

Radius scale maps to Tailwind `rounded-workspace-*`:

| Token | rem | Typical use |
|-------|-----|-------------|
| xs | 0.5 | tight chips |
| sm | 0.625 | calendar tiles |
| md | 0.75 | dock item hit area, small controls |
| lg | 1 | nav items, buttons, inputs |
| xl | 1.25 | default cards (`surface()`) |
| 2xl | 1.5 | heroes, large empty states, dialogs |
| full | pill | avatars, unread badges |

**Rules**
- Prefer **xl cards on canvas**, **lg controls**, **full avatars**.
- Sidebar logo may use `rounded-2xl` tile or circle — stay consistent per shell.
- Do not mix sharp 4px corners with 24px cards in the same view.

## Components

### Shell chrome
- **Skip link:** first focusable child; `sr-only focus:not-sr-only`; target `#main`.
- **Sidebar:** `role="navigation"` + `aria-label="Primary"`; sections from `studentPortalSections` / `teacherPortalSections` / `parentPortalSections`.
- **Hamburger:** `aria-expanded`, `aria-controls` pointing at sidebar id, `aria-label`.
- **Header glass:** school name (truncate), academic year/term, search ≥sm, messages with unread badge, avatar to profile.
- **WorkspaceLoader:** full-shell loading only (no half-drawn shell).

### Mobile dock
- Built via `buildStudentPortalDock` (4 items), `buildTeacherPortalDock` (5), `buildParentPortalDock` (5).
- Active state uses **role accent** (teal / sky / teal) — not monochrome slate for these three portals.
- Unread badges: compact pill, high-contrast (slate-900 on white or brand on white); announce via `aria-label`.
- Icons ~18px; labels 10px; min touch 44px height including padding.

### Cards & surfaces (`lib/workspace/design.ts`)
- `surface("default")` — white, border, `shadow-workspace-sm`, `rounded-workspace-xl`.
- `surface("elevated")` — stronger shadow for emphasis.
- `surface("inset")` — slate-50/80 for nested groups.
- `surface("dashed")` — empty states.
- `roleStatSurface.student|teacher|parent` — gradient borders for identity stats.

### Buttons
- **Primary:** `bg-brand text-white rounded-workspace-lg px-4 py-2.5 font-semibold shadow-workspace-sm`.
- **Secondary:** white + border + slate-700 text.
- Full-width primary allowed on mobile forms; keep desktop buttons auto-width.

### Dashboard building blocks
- **Hero card:** rounded-3xl / 2xl, white, name + identity line + refresh.
- **Stat tiles:** tone chips (emerald/rose/amber/sky/violet) with tabular values.
- **List rows:** 44px+ row height on mobile; chevron optional; avoid dense multi-column tables without horizontal scroll wrappers.
- **Attention banner (teacher):** amber/rose soft fill, actionable.
- **Child selector (parent):** chips or select with large hit targets; selected child persists in session/query state.
- **Announcements rail:** sidebar on xl+, stacked card on mobile.

### Feedback
- Errors: `role="alert"`, rose soft panel.
- Offline banner: rose offline / amber slow; `role="status"`; sits above shell content.
- Empty states: dashed surface + short instructional copy (Zambian school tone: clear English, no slang).

### Nav destinations (canonical)
**Student dock:** Dashboard → Messages → Assignments → Profile  
**Teacher dock:** Dashboard → Messages → Students → Attendance → Profile  
**Parent dock:** Dashboard → Messages → Children → Attendance → Fees  

Full sidebar sections remain available via hamburger for secondary destinations (results, announcements, settings, etc.).

## Do's and Don'ts

### Do
- Use workspace tokens from `app/globals.css` and helpers from `lib/workspace/design.ts`.
- Keep mobile portals **dock-first**; put secondary destinations in the drawer.
- Preserve role accents: teal student/parent, sky teacher for active nav/dock.
- Enforce **44px** touch targets and **WCAG AA** text contrast.
- Use `100dvh` / hide-not-shrink patterns; pad main content above the dock (`pb-24`).
- Load shells with `WorkspaceLoader`; bootstrap via workspace context / shell APIs already in use.
- Respect `prefers-reduced-motion` for enter animations and loaders.
- Keep copy professional and inclusive of multi-child parents and class-based student identity.

### Don't
- Don't invent a new brand palette or switch to a dark theme for v1 portals.
- Don't build a separate React Native / Expo app for phase 1 — evolve the Next.js flex shells.
- Don't use monochrome-only dock active states for student/teacher/parent if the design system specifies role accents.
- Don't put body text in yellow or light purple without dark text on a solid soft surface that passes AA.
- Don't shrink the dock to more than 5 items or less than 4 for these roles without updating this document.
- Don't hide critical offline state; never fake successful writes while offline.
- Don't expose admin/principal chrome or APIs inside student/teacher/parent shells.
- Don't rely on hover-only affordances for primary actions on mobile.
