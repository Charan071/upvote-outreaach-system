# Skill Observation Log

Observations captured during task-oriented work.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = skill updated/created | DECLINED (YYYY-MM-DD) = user decided not to pursue —
resolved statuses always carry their resolution date

---

## 2026-08-25

### Observation 1: Verify vendor send capabilities before accepting a simplified architecture

**Status:** OPEN
**Date:** 2026-08-25
**Session context:** Architecture verdict on two Product Hunt → LinkedIn outreach plans; the second plan treated Zernio as a safe LinkedIn sending layer after the user said enrichment was unnecessary.
**Skill:** New skill candidate: architecture-plan-verdict
**Type:** open-source
**Phase/Area:** Constraint verification before plan collapse

**Issue:** A first plan correctly said to verify a vendor’s LinkedIn actions before designing around it. After the user asked for a simpler system, the second plan dropped that check and built the whole execution layer on an assumed send API. Live vendor docs stated LinkedIn DMs are not available because the platform blocks third-party DM access.

**Suggested improvement:** When a simplified plan depends on one vendor action (send, enrich, search), re-read that vendor’s capability matrix before agreeing. A “make it smaller” request is not permission to skip the load-bearing constraint.

**Principle:** Collapsing an architecture after a “keep it simple” clarification still requires re-checking the one external capability the thin design now depends on.

### Observation 2: URL-in name-out without an API is still scraping

**Status:** OPEN
**Date:** 2026-08-25
**Session context:** Verdict on Product Hunt discovery after the official API was treated as unavailable.
**Skill:** New skill candidate: architecture-plan-verdict
**Type:** open-source
**Phase/Area:** Distinguishing allowed input from disguised collection

**Issue:** A plan correctly refused crawling a site, then proposed that users paste page URLs and the app produce person names. Resolving a page URL to entities without that site’s API is fetching and parsing the page.

**Suggested improvement:** When a source forbids scraping, require the human-exported fields the downstream system actually needs (here: person name), not identifiers the app would have to dereference.

**Principle:** If the only way to go from an allowed identifier to a required field is to fetch the source page, the identifier is not a legal substitute for an API.

### Observation 3: A better browser CLI does not change a site’s collection terms

**Status:** OPEN
**Date:** 2026-08-25
**Session context:** Verdict on using agent-browser / derive-client for Product Hunt discovery.
**Skill:** New skill candidate: architecture-plan-verdict
**Type:** open-source
**Phase/Area:** Tool substitution vs policy

**Issue:** After scraping was rejected, a follow-up plan swapped Playwright for a CDP CLI and proposed recording site XHR into a generated client. The legal constraint was crawl/scrape and a gated official API, not the browser engine.

**Suggested improvement:** When a plan says “if permitted” then asks whether the new tool can collect the data without the official API, treat that as a no. Do not reverse-engineer a published, gated API via HAR replay.

**Principle:** Replacing the automation runtime does not create permission. Skills that turn a website’s private XHR into a client are a bypass of the official API, not an alternative to asking for access.
