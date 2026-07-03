# Evidence-Based Analysis — Design Spec

**Date:** 2026-07-02
**Status:** Approved — ready for implementation plan

## Context

Started as "scope the never-built Content nav section," but grew into something bigger: the user wants the whole product's analysis to be more rigorous and evidence-based — comparable in ambition to Baymard Institute's UX Ray product, though not literally replicating Baymard's proprietary paid research (which took a dedicated research team 15+ years to build). This spec covers the first, narrow, buildable step toward that: grounding real findings in real, named, publicly-documented UX/CRO research for two page types, with the evidence visible in the UI. The "Content" nav section itself is deferred until after this proves out — it may end up reusing this same framework as an eighth criteria set once built.

## Decisions

1. **Not starting from scratch.** `server/lib/analysisPrompt.js` already has a "100+ rule engine": 6 weighted scoring categories (UX Clarity, Trust & Credibility, Friction & Effort, Speed & Performance, Intent Match, Funnel Health), each with terse rule names, plus page-type-specific emphasis text. The gap isn't structure — it's that rules have no citations, and AI-generated findings never link back to a specific named rule.
2. **Scope: Homepage and Checkout only, for now.** These are the two most heavily-researched, most CRO-critical page types. The other five existing page types (Blog/Content, Lead/Form, Product Page, Landing—Marketing, Landing—Paid Media) keep today's uncited behavior — extending to them is separate future work once this is proven.
3. **Criteria are sourced from established, publicly-documented research** — Nielsen Norman Group, Baymard Institute's freely published articles (not their paid proprietary database), WCAG, Google's Core Web Vitals research, and well-known named principles (Hick's Law, the Iyengar & Lepper choice-overload study, Luke Wroblewski's form design research). This is real, credible, broadly-recognized material — not fabricated citations, and not a claim to have replicated Baymard's specific paid findings.
4. **Evidence must be visible to the user**, not just present in the backend prompt. `FrictionCard` gets a small "Evidence-based" badge when a finding cites a criterion; `EvidencePanel` (the detail view) gets a new "Evidence Base" section showing the actual citation text.

## Architecture

### Criteria data (`server/lib/criteriaLibrary.js`)

A new module exporting `CRITERIA_LIBRARY: Record<"homepage" | "checkout", Criterion[]>`, where each `Criterion` is `{ id: string, category: string, rule: string, guidance: string, source: string }`. `category` uses the same six category keys already defined in `SCORING_CATEGORIES` (`server/lib/analysisPrompt.js`) — no new categories introduced. Ten criteria each for `homepage` and `checkout` (listed in full in the implementation plan, since this is content, not just code).

### Prompt changes (`server/lib/analysisPrompt.js`)

`buildAnalysisPrompt(analysisType, markdown, url, device)` gains a new step: when `analysisType` is `"homepage"` or `"checkout"`, it looks up `CRITERIA_LIBRARY[analysisType]` and injects a new "NAMED EVIDENCE-BASED CRITERIA" section into the prompt, listing each criterion's rule, guidance, and source. The AI is instructed: for any friction point that matches one of these named criteria, include a `sourceCitation` field containing that criterion's `source` string. Findings that don't match a named criterion (still valid and useful) simply omit `sourceCitation` — the AI isn't forced to manufacture a citation for everything. For the other five page types, the prompt is unchanged.

### Route changes (`server/routes/analyze.js`)

The friction-point mapping (where the route builds its response `frictionPoints` array from the raw AI JSON) passes through `fp.sourceCitation || null` alongside the existing fields — no other change to the route.

### Type/UI changes (client)

- `FrictionPoint` (`src/lib/mockData.ts`) gains `sourceCitation?: string`.
- `FrictionCard.tsx`: when `point.sourceCitation` is present, render a small badge (checkmark icon + "Evidence-based" text) near the existing severity label.
- `EvidencePanel.tsx`: when `point.sourceCitation` is present, render a new "Evidence Base" section (styled consistently with the existing "Industry Benchmark" section) showing the citation text, placed directly after the "Analysis" section.
- `mockData.ts`'s `generateMockAnalysis` (used for the demo/fallback path) gets 2-3 of its existing hardcoded example friction points updated with a `sourceCitation` value for homepage/checkout mock scenarios, so the demo path also demonstrates the new UI rather than only the live-AI path.

## What This Does NOT Cover (by design)

The other five page types (Blog/Content, Lead/Form, Product Page, Landing—Marketing, Landing—Paid Media) are not touched — future work once Homepage/Checkout prove out. The "Content" nav section itself is not built here — deferred, may become an eighth criteria set later. `heuristicAnalysis.js` (the fallback used only when the AI call itself fails) is not updated with citations — it's a lower-fidelity generic fallback already, and fabricating citations there would undermine the honesty this whole effort is about. No multi-page/competitor benchmarking (that's roadmap Phases 6/8, separate work).
