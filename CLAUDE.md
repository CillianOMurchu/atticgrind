# Claude Code — Atticus project

## Read This First

- **README.md** — project overview and live feature index
- **docs/ARCHITECTURE.md** — system design, data flow, sphere algorithm details
- **docs/STYLE_GUIDE.md** — TypeScript patterns, CSS conventions, naming rules
- **docs/TROUBLESHOOTING.md** — known bugs and their exact locations

Do not read individual source files to re-learn the project. Use these docs.

---

## Project Identity

Personal portfolio for Cillian Ó Murchú. Live at `cillianomurchu.vercel.app`.
React 18 + TypeScript + Vite + Tailwind + Framer Motion. No SSR. No global state library.

---

## File Structure Rules

```
src/pages/           Route-level screens only. One file per route.
src/components/      Reusable UI. Feature folders for co-located logic.
  sphere/            All canvas sphere logic lives here. Do not split out.
  name/              Name widget and its sub-components. Do not split out.
  HeroTitle/         HeroTitle component + its CSS file.
  layout/            Navbar, Footer only.
  navigation/        Mobile menu components only.
  ui/                Stateless presentational atoms.
src/context/         React context providers only.
src/data/            Static data files (no API calls).
src/hooks/           General-purpose hooks. Sphere-specific hooks live in sphere/.
src/utils/           Pure functions. Sphere-specific utils live in sphere/.
src/styles/          theme.css only. No new CSS files here.
```

**When adding a new feature:** If it has more than 2 related files, give it a `components/<feature>/` folder. Keep hook, util, type, and component files co-located inside that folder.

---

## Import Path Conventions

Always use relative imports. No path aliases configured.

```
From src/pages/           → ../components/..., ../hooks/..., ../utils/..., ../data/...
From src/components/xyz/  → ../../context/..., ../../hooks/..., ../../utils/...
From src/components/sphere/ → ./[file]  (all sphere deps are siblings)
From src/components/name/   → ./[file]  (all name deps are siblings)
```

Vite glob import in `sphere/iconLoader.ts` uses `"../../assets/programming-icons/*.svg"` — if iconLoader.ts moves, this path must update.

---

## Key Patterns

**Animation variants:** Always import from `utils/animations.ts`. Do not define local variants for scroll-triggered animations — add to `scrollVariants` there instead.

**CSS styling:** Use `theme.css` utility classes (`.neon`, `.text-accent`, `.border-accent-subtle`, `.surface`, `.timeline-card-*`, etc.) before writing inline styles. CSS custom properties are in `styles/theme.css`. Tailwind is not extended via config — custom classes live in `theme.css`.

**Info boxes:** Use `components/ui/InfoBox.tsx` (generic). Pass `text` (full string) and optionally `displayedText` (partial, for typing cursor). `className` accepts positional and sizing overrides. Do not recreate info-box styling inline.

**Component size:** Keep components under 150 lines. If a component grows beyond that, extract sub-components into the same folder.

**No new dependencies** without a clear reason. The bundle was already cleaned of ~650KB of unused deps (three.js, react-hook-form, etc.).

---

## Commands

```bash
npm run dev           # dev server
npm run build         # tsc + vite build — run this after structural changes
npm run test:run      # vitest single run
```

After any significant change, run `npm run build` to catch type errors.

---

## What NOT To Do

- Do not add files to `src/utils/` or `src/hooks/` if they belong to a feature (sphere, name, etc.). Co-locate instead.
- Do not define animation variants locally in a component — use `utils/animations.ts`.
- Do not create a new CSS file. Add classes to `theme.css` or use Tailwind utilities.
- Do not use `any` types. The Twitch player interface pattern in `Streaming.tsx` shows how to type external scripts.
- Do not add `console.log` to production code.
- Do not use wildcard versions in `package.json` (was fixed — `clsx` and `tailwind-merge` are now pinned).
- Do not install Three.js — the sphere is canvas-based, not Three.js.

---

## Known Issues to Be Aware Of

See **docs/TROUBLESHOOTING.md** for the full list. Critical ones:

1. **HeroTitle buttons have no `onClick`** — `selectedItem` in HomeScreen is never set by user interaction. The description panel below the hero is currently unreachable. Do not assume it works.
2. **CSS class name mismatch** — `Navbar.tsx` uses `border-bottom-neon`, `MobileMenuPanel.tsx` uses `border-left-neon`, but `theme.css` defines `border-neon-bottom` / `border-neon-left`. The borders don't render.
3. **`useElementCenter` is dead code** — superseded by OrbOriginContext, do not build on top of it.

---

## Agent Workflow

For non-trivial changes, use this sequence:
1. `/plan` — agree on approach before touching files
2. Implement
3. `/project:verify` — runs build and type check, reports errors
4. `/review` — code review of the diff

For large refactors or anything touching the sphere feature, always run verify after.
