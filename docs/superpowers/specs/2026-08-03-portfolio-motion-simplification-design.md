# Portfolio Motion Simplification Design

## Goal

Remove obsolete portfolio rendering code, make navigation and open-work pages feel more immediate, and honor reduced-motion preferences without changing site content or visual language.

## Scope

- Remove one-line Splatify URL wrapper and redundant mouse listener.
- Remove uncalled feed renderers and CSS that only targets never-rendered markup.
- Remove view-panel transitions because each view replaces list DOM.
- Tighten text-only open-work hero height while preserving larger media hero.
- Add shared pill press feedback and restrained hover color transitions.
- Convert Jeju data-meter fill from width animation to transform scaling.
- Use responsive whiteout easing and reduced-motion fallbacks for decorative cursor and marquee motion.

## Constraints

- Preserve `main` deployment flow and visual identity.
- Do not stage `.gitignore` or `.codex/` JEBI artifacts.
- Do not add dependencies.
- Keep WebGL curtain and local Jeju app intact.

## Verification

- Existing Node test suite passes.
- Production build passes.
- Desktop and 390px mobile checks cover home, JEBI detail, and Jeju radio.
