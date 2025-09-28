
# TaxTrail - Smart Quarterly Tax Planning
A professional Vite + React + TypeScript application for self-employed individuals to plan quarterly tax payments and track business expenses. Features include:

- 2025 IRS brackets & standard deduction
- Self-employment tax incl. OASDI wage base and Additional Medicare
- Half SE tax deduction automatically reduces taxable income before brackets
- **Business Expense Tracking**: Comprehensive categorization for ecommerce, rideshare, and consulting
- **Child Tax Credit**: Configurable $2,000 vs $2,200/child with refundable ACTC calculations
- **Multiple Income Sources**: W-2 wages, business income, and other income integration
- **Safe Harbor Planning**: 90% current year, 100% prior year, 110% prior year (high earners)
- **Flexible Scheduling**: Equal vs annualized quarterly payments with .ics calendar export
- **Professional Exports**: CSV and PDF downloads with complete expense breakdown
- **Stripe Integration**: Seamless subscription and billing management

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

## Important Notes
- Personal exemptions remain **$0** in 2025 per IRS guidance; use Child Tax Credit/Other Dependent Credit instead
- The **$2,200 per child** option is available for qualifying situations; default remains **$2,000**
- TaxTrail provides tax planning estimates only; complex items like QBI, state taxes, and itemized deductions are not included
- **Always consult a qualified tax professional** for personalized tax advice and compliance

## Business Types Supported
- **E-commerce**: COGS, shipping, platform fees, marketing, software tools
- **Rideshare/Gig**: Vehicle expenses, platform commissions, supplies, professional services  
- **Consulting**: Travel, equipment, professional services, office operations, education 
