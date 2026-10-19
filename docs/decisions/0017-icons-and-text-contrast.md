# 0017. Tabler icons, and readable text in the new frontend

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [FE-03](../AUDIT.md#fe-03), [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md), roadmap decisions D6 and D7, Milestone 5

## Context

The current pages use the Tabler Icons webfont. The migration plan offered `@tabler/icons-react`, with the same glyphs, or `lucide-react`. Separately, FE-03 found small gold and light-grey text below the WCAG AA contrast ratio of 4.5:1, and 9px text in 55 rules; fixing it is a visible change.

## Decision

**D6:** `@tabler/icons-react`. Each icon keeps the glyph it has on the current pages.

**D7:** FE-03 is fixed in the new frontend only, from Milestone 5:

- small text on light surfaces uses the existing darker gold `#7a4c08` (`gold-ink`); `#C8973A` stays for marks, accents and text on navy;
- no text is smaller than 10px;
- every text colour meets 4.5:1 against its background, so faint text on navy (for example the footer's) is raised to the faintest tint that passes;
- axe's contrast rule runs on the new frontend's browser checks.

The static pages are not changed; they are retired at cutover.

## Alternatives considered

- **Lucide:** the brief's first choice, but every icon would change shape and need a visual review.
- **Fix both frontends now:** touches every page of `style.css` a few months before it's retired.
- **Keep the current colours:** the new frontend would inherit a known accessibility failure.

## Consequences

- The new shell differs slightly from the current one: 10px instead of 9px labels and brighter faint text on navy. The screenshot review accepts these differences and no others.
- No new colour: `#7a4c08` is already a token, and the tints are alpha values of parchment `#F5F0E8`.
