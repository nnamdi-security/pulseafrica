# 0016. Migrate the frontend to Next.js, starting with a foundation in `frontend/`

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [FE-02](../AUDIT.md#fe-02), [FRONTEND_MIGRATION.md](../FRONTEND_MIGRATION.md), roadmap decisions D5, D25 and D30, Milestones 5–8

## Context

The static frontend works, but its shell, helpers and lists are copied into 9 pages, its 3,300 lines of inline script can't be unit-tested or type-checked, and its safety depends on hand-escaping (FE-02, FE-06). [FRONTEND_MIGRATION.md](../FRONTEND_MIGRATION.md) compared a Next.js migration (Option A) with modernising the pages in place (Option B). Its prerequisites are now met: the M2 parity suite, the M3 cookie session and the M4 reference endpoint.

## Decision

**D5:** Option A. The frontend moves to Next.js over Milestones 5–8, built in parallel and cut over in one step. Milestone 5 builds only the foundation; no page moves in it.

**D25:** the toolchain is Node 24 LTS, pnpm with a committed lockfile, Next.js (App Router) and React 19, TypeScript in strict mode, Tailwind CSS 4 with the design tokens as theme variables, and the libraries in [FRONTEND_MIGRATION.md §5](../FRONTEND_MIGRATION.md#5-dependency-assessment). Versions are pinned exactly, chosen from releases at least two weeks old, and upgraded only on purpose. TypeScript stays on 6.0 while `typescript-eslint` doesn't support 7.

**D30:** the app lives in `frontend/` in this repository. During Milestone 5 it runs locally and in CI only and is not deployed; Netlify keeps publishing the current site from the repo root. Hosting the new frontend is decided in Milestone 9.

## Alternatives considered

- **Option B, modernise in place:** about a third of the cost and no Node runtime, but no components, typed contract or escaping by default.
- **Defer and deploy first (Milestone 9):** a real deployment sooner, on a frontend that stays hard to change.
- **Tailwind CSS 3, as in the original sketch:** a JavaScript theme file that shadcn/ui would have to mirror in CSS variables; Tailwind 4 keeps one set of variables.
- **Preview deployments now:** they would show an empty shell, and would choose a host before Milestone 9.

## Consequences

- A Node toolchain and a second CI workflow ("Frontend"). `frontend/README.md` gives the commands.
- Until cutover (Milestone 8), fixes to shared behaviour are made in both frontends. The feature freeze on the static pages starts with Milestone 6.
- Netlify also serves the `frontend/` source files on its previews of the current site. They hold no secrets; this ends at cutover.
- The `frontend-migration` skill's approval gate is met for Milestones 5–8.
