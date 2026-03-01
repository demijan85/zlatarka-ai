# Zlatarka v2

A new Next.js application for milk factory purchase operations, rebuilt with a cleaner architecture, keyboard-first daily entry, and safer workflows.

## What is included

- Login page and protected app routes
- Collapsible navigation
- Supplier management page
  - add/edit/delete supplier
  - reorder suppliers
  - city filtering
- Daily intake page (Excel-like workflow)
  - keyboard navigation (`Arrow` keys, `Enter`, `Shift+Enter`, `Tab`, `Shift+Tab`)
  - fast numeric input per supplier/day
  - row totals, column totals, grand total
  - periodic quality (fat %) editing per supplier
  - bulk save + unsaved-change warning
  - daily XLSX export
- Monthly view
  - filters by year/month/period/city
  - summary table
  - exports: summary XLSX, receipts XLSX, payments XML
- Quarterly view
  - filters by year/quarter
  - summary table
  - export: quarterly XLSX
- Settings page for calculation constants (exposed in UI)
  - price per fat %
  - tax %
  - stimulation thresholds/amounts
  - premium per liter

## New libraries used

- `@tanstack/react-query` for data fetching/caching
- `zustand` for lightweight global state (calculation constants)
- `react-hook-form` + `zod` for input validation
- `@supabase/ssr` + `@supabase/supabase-js` for auth/data
- `lucide-react` for modern icon set
- `exceljs` and `xlsx` for exports

## Same DB connection

This project uses the same Supabase environment variables as your existing app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

A copy of your root `.env.local` was placed in `v2/.env.local`.

## Run the new project

```bash
cd v2
npm install
npm run dev
```

Open: `http://localhost:3000`

## API routes in v2

- `/api/suppliers`
- `/api/suppliers/[id]`
- `/api/suppliers/reorder`
- `/api/daily-entries`
- `/api/daily-entries/[id]`
- `/api/daily-entries/upsert`
- `/api/daily-entries/bulk-upsert`
- `/api/summaries/monthly`
- `/api/summaries/monthly/export`
- `/api/summaries/monthly/receipts`
- `/api/summaries/monthly/payments`
- `/api/summaries/quarterly`
- `/api/summaries/quarterly/export`

## Reliability improvements applied

- Strong request validation on API input (`zod`)
- Centralized repository/data-access layer
- Centralized and user-exposed calculation constants
- Safer bulk save pattern (only changed cells are persisted)
- UI warnings for unsaved daily changes
- Structured layout/components for maintainability

## Hosting (cheap / free)

Recommended low-cost options:

1. Vercel (free tier to start)
2. Netlify (free tier)

Since Supabase is already external, hosting is mostly static/serverless runtime cost.

## Notes

- This is intentionally built as a **new parallel app** in `v2/` so your current project stays untouched.
- You can migrate gradually by running both side-by-side.
