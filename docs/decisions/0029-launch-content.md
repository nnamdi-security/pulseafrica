# 0029. Launch content: demonstration notice, Terms and Privacy, About's copy

- **Status:** Accepted (2026-11-01); the wording is approved on its PR
- **Deciders:** Nnamdi (project owner)
- **Related:** roadmap decisions D3, D63–D65, [METH-01](../AUDIT.md#meth-01), [FE-05](../AUDIT.md#fe-05), [decision 0004](0004-demonstration-data-disclosure.md), [decision 0013](0013-unweighted-results-and-methodology-copy.md) (D23), [decision 0023](0023-public-pages-migration-conventions.md) (D37), [decision 0028](0028-first-deployment.md)

## Decision

- **D63, demo data (closes D3):** the first deployment is a labelled demonstration. The seed runs once, on the empty production database. The existing "Demonstration data" notices stay where figures appear. Every page of `frontend/` also shows a one-line notice, linked to About, when the server runs with `DEMO_SITE=true` (`render.yaml` sets it). Polls that an admin creates later are real (`isSynthetic` false).
- **D64, registration, Terms and Privacy (FE-05):** registration stays open. `frontend/` gains `/privacy` and `/terms`. Each statement in them describes the code as it is: what is stored, what is published, the one session cookie, how long sign-in attempts are kept, where the data is hosted, and what deleting an account removes. The footer links to both pages (Cookie Policy goes to `/privacy#cookies`), and so does the register form's terms line, in new tabs so the form keeps its contents.
- **D65, About's unreviewed copy:** the team biographies and the 2024 and 2025 timeline entries with their usage figures are removed. In their place, a short section says what the project is: an independent, non-commercial portfolio project about a fictional nation, running as a demonstration with synthetic data. Methodology's funding answer ("a transparent public interest grant model") is replaced the same way. Both changes are made in the static pages too, so a rollback shows the same copy; the static footers' "The Team" link becomes "The Project".

## Alternatives considered

- **D63:** launching empty with real responses only, or running separate demonstration and real deployments.
- **D64:** closing registration until the pages exist.
- **D65:** keeping the copy word for word with a "fictional" label, or writing a fuller About.

## Consequences

- `CONTACT_EMAIL` in `frontend/src/components/content/LegalPage.tsx` is the owner's address, chosen on 2026-11-01.
- The Terms and Privacy pages aren't legal advice. Any change to what the code stores, publishes or keeps has to update `/privacy` in the same PR (PRIV-02).
- When the deployment stops being a demonstration, `DEMO_SITE` is turned off and About's project section is reworded.
- The static pages' footers still show Privacy Policy and Terms of Use as placeholder links (FE-05 on the static pages), since they have no such pages. They are retired with the static pages (D57).
