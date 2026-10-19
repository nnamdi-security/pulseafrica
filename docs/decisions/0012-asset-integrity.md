# 0012. Integrity hashes on CDN files

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [SEC-08](../AUDIT.md#sec-08), roadmap decision D17, Milestone 3

## Context

Every page loads Tabler Icons from jsDelivr, `results.html` loads Chart.js from cdnjs, and `style.css` imports Google Fonts, all without Subresource Integrity (SEC-08). A changed file on a CDN would run with the page's full privileges.

## Decision

**D17:** add `integrity` (SHA-384) and `crossorigin="anonymous"` to the Tabler Icons 3.19.0 stylesheet and the Chart.js 4.4.1 script, both pinned to exact versions. Google Fonts stays as it is: its stylesheet differs by browser, so it can't carry a fixed hash, and a stylesheet can't run script.

## Alternatives considered

- **Self-host the icons, Chart.js and fonts:** closes SEC-08 fully, but adds about 1 MB of vendored files and needs a careful visual check. A frontend migration bundles them anyway.

## Consequences

- Upgrading either library means updating its hash, or the browser refuses the file.
- The fonts remain a third-party dependency with no integrity check.
