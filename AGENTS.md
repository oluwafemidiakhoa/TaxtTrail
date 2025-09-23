# Repository Guidelines

## Product Scope & Modules
This unified tax companion ships modular experiences: a Tax Document Organizer & Readiness flow for persona-based checklists, secure uploads, reminders, and Drive/Dropbox sync; a Guided Tax Interview that produces a prep summary sheet; a Self-Employed & Gig Tracker for income, expenses, IRS categorization, and quarterly reminders; Tax Literacy & Planning tools covering what-if calculators, actionable tips, and a jargon-free glossary; and a Tax Season Stress Manager with deadlines, progress tracking, and light gamification.

## Target Users & Monetization
Primary audiences span individuals preparing for a tax advisor visit, gig workers and freelancers (rideshare, consultants, creators), small-business owners needing lightweight bookkeeping, and tax preparers who can onboard clients for better intake. Monetize with a freemium core (checklists, calendar, reminders), subscription tiers at `$4.99` for personal upgrades and `$9.99` for freelancer storage plus tracking, and optional B2B licensing for firms bundling the experience.

## 18-Month Roadmap
**Phase 1 (Months 1-4):** Launch MVP with checklist generator, document organizer, calendar reminders, and guided interview aimed at freelancers. **Phase 2 (Months 5-8):** Add year-over-year rollover, literacy hub, basic calculators, and life-event nudges to drive retention. **Phase 3 (Months 9-12):** Ship gig tracker, mileage logging, quarterly estimator, and prep-export bundles. **Phase 4 (Months 13-18):** Layer gamification, hardened security, B2B workspaces, and state/local expansions while optimizing monetization funnels.

## Project Structure & Workflow
The Vite + React client lives in `src/`; `main.tsx` bootstraps `App.tsx`. Feature modules should live under `src/modules/<feature>` with shared logic in `src/lib` (for example, `tax.ts`), and styles in `src/styles` or co-located module styles. Static assets belong in `public/`. Configure environments by copying `.env.example` to `.env` and only exposing `VITE_` keys.

## Coding & Testing Standards
Favor typed React function components, two-space indentation, `PascalCase` for components, and `camelCase` for utilities, hooks, and checklist keys. Keep helpers pure and reuse the strict TypeScript config; add explicit types instead of `any`. Use `npm install`, `npm run dev`, `npm run build`, and `npm run preview` during development; run `npx tsc --noEmit` for type checks. Adopt `vitest` with `@testing-library/react` for future suites under `src/__tests__`, covering checklist generation, calculators, and reminder scheduling. Block merges on green builds and published test results.
