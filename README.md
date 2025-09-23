
# QuarterlyPilot Pro (Advanced)
A launch‑ready Vite + React + TypeScript app for quarterly tax planning. Adds:

- 2025 IRS brackets & standard deduction
- Self-employment tax incl. OASDI wage base and Additional Medicare
- Half SE tax deduction automatically reduces taxable income before brackets
- Premium CSV/PDF downloads gated behind email capture with upgrade CTAs
- Child Tax Credit + Other Dependents + refundable ACTC (toggle $2,000 vs $2,200/child)
- W‑2 wages/withholding + Net business + Other income → **Total income**
- Safe‑harbor modes: 90% current, 100% prior, 110% prior (AGI > $150k)
- Equal vs Annualized schedule; **.ics** calendar files
- **CSV** and **PDF** downloads
- Stripe links: `VITE_SUBSCRIBE_PERSONAL_URL`, `VITE_SUBSCRIBE_FREELANCER_URL`, `VITE_CONSULT_URL`, `VITE_PORTAL_URL`

## Quick start
```bash
npm i
# install build-time PostCSS helpers if you plan to run `npm run build`
npm i -D @tailwindcss/postcss autoprefixer
npm run dev
```
Create a `.env` (or set these in Vercel → Environment Variables):
```
VITE_SUBSCRIBE_PERSONAL_URL=
VITE_SUBSCRIBE_FREELANCER_URL=
VITE_CONSULT_URL=
VITE_PORTAL_URL=
VITE_SUBSCRIBE_URL=

`VITE_SUBSCRIBE_URL` is an optional legacy fallback that will be used if the plan-specific URLs are not provided.
```

## Notes
- Personal exemptions remain **0** in 2025 per IRS; use Child Tax Credit/Other Dependent Credit instead.
- The **$2,200 per child** toggle is provided in case your facts fall under new 2025 rules; default stays **$2,000**.
- This is an estimate tool only; complex items like QBI, state taxes, credits, and itemized deductions are not included.
"# QuarterlyPilot-Pro" 
