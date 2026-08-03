# Portfolio Motion Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove obsolete portfolio code and polish interaction motion without changing site content.

**Architecture:** Keep the single-page renderer. Delete unused feed branch because `renderWorks()` replaces list markup with summary or overview markup. Scope visual changes to shared CSS and standalone Jeju meter writer.

**Tech Stack:** Vite, vanilla JavaScript, CSS, Node test runner.

## Global Constraints

- No dependencies.
- Preserve `main` deployment flow.
- Do not stage `.gitignore` or `.codex/`.
- Verify desktop and 390px mobile rendering after build.

---

### Task 1: Remove obsolete renderer paths

**Files:**
- Modify: `src/main.js:355-405, 669-710`
- Modify: `src/styles.css:1027-1106, 1263-1288, 2909-2926`
- Modify: `tests/site.test.js:458, 1292-1312`

- [x] Remove `getSplatifyExportUrl()` and use `SPLATIFY_WEBAPP_URL` directly.
- [x] Remove redundant `mousedown` listener; `pointerdown` remains cursor input.
- [x] Delete `renderWorkEntry()` and `renderWorkGroups()` and CSS that only targets `.feed-work-group`/`.feed-entry` markup.
- [x] Remove view-panel height/padding/border transitions because summary and overview markup are mutually exclusive.
- [x] Run `npm test`.

### Task 2: Improve page density and pill feedback

**Files:**
- Modify: `src/styles.css:41-58, 1005-1018, 1515-1663, 2378-2393, 3006-3018`

- [x] Add shared strong ease-out token.
- [x] Reduce text-only desktop open-work hero from fixed 48rem to a content-appropriate clamp; retain 48rem for media heroes.
- [x] Add transform-only `:active` feedback and color/background hover transitions to shared pills.
- [x] Run production build; browser capture unavailable in this environment.

### Task 3: Make decorative motion lighter and accessible

**Files:**
- Modify: `src/styles.css:727-857, 2540-2541, 2824-2831`
- Modify: `public/apps/jeju-wave-radio/web/styles.css:229-236`
- Modify: `public/apps/jeju-wave-radio/web/src/app.js:26-32`

- [x] Replace whiteout `ease-in` with shared strong ease-out.
- [x] Add `prefers-reduced-motion` rules that stop mobile cursor float and marquee movement while leaving stable states visible.
- [x] Replace meter `width` updates with direct `transform: scaleX()` updates.
- [x] Run `npm test` and `npm run build`; browser check unavailable in this environment.
