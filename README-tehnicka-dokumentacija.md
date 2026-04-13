# Zlatarka - tehnicka dokumentacija

## 1. Tehnoloski stack

Osnovni stack:

- Next.js 15, App Router
- React 19
- TypeScript
- Supabase JS klijent
- TanStack Query
- Zustand
- React Hook Form
- Zod

Pomocne biblioteke:

- `xlsx` i `exceljs` za izvoz
- `lucide-react` za ikonice
- `dayjs` za rad sa datumima
- `file-saver` za klijentske downloade

## 2. Struktura projekta

Najvazniji direktorijumi:

- `app/`
  - stranice i API route handler-i
- `components/`
  - layout i forme
- `lib/`
  - repository sloj, utility funkcije, stores, i18n, Supabase helperi
- `types/`
  - zajednicki TypeScript tipovi
- `db/`
  - SQL migracije i pomocne SQL skripte
- `tests/`
  - unit testovi za formule i XML izvoz
- `scripts/`
  - pomocni generatori import SQL fajlova

## 3. Aplikaciona arhitektura

### 3.1 Frontend sloj

Frontend je organizovan kroz App Router stranice u `app/`.

Tipican tok:

1. stranica prikazuje filtere i UI
2. podaci se ucitavaju preko `useQuery`
3. izmene se salju preko `useMutation`
4. nakon mutacije invalidiraju se relevantni query kljucevi

Primeri:

- dnevni unos: `app/daily-entry/page.tsx`
- dobavljaci: `app/suppliers/page.tsx`
- parametri: `app/settings/page.tsx`

### 3.2 API sloj

API je realizovan kroz Next route handler-e u `app/api/**/route.ts`.

Handler-i tipicno rade sledece:

- citaju query parametre ili body
- validiraju ulaz preko Zod schema
- pozivaju repository funkcije iz `lib/repositories`
- vracaju JSON ili fajl odgovor

### 3.3 Repository sloj

Repository sloj je u `lib/repositories/` i predstavlja glavni pristup podacima.

Njegove odgovornosti:

- citanje iz Supabase tabela
- upis i update
- poslovna pravila vezana za bazu
- server-side zastite, npr. zabrana izmene zakljucanog meseca

Najvazniji repository fajlovi:

- `daily-entries.ts`
- `daily-intake-locks.ts`
- `suppliers.ts`
- `supplier-history.ts`
- `summaries.ts`
- `calculation-constants.ts`
- `correction-requests.ts`
- `audit-logs.ts`

## 4. Autentifikacija i sesija

### 4.1 Login

Login stranica koristi Supabase password login.

Fajl:

- `app/login/page.tsx`

Posle uspesne prijave postavljaju se cookie vrednosti:

- Supabase auth cookie-i koje `@supabase/ssr` koristi za stvarnu sesiju
- `app_user=<email ili identifikator>` za audit identitet

### 4.2 Middleware

Fajl:

- `middleware.ts`

Middleware:

- propusta `/login`
- propusta `/_next`, `/api` i favicon
- kroz `@supabase/ssr` cita i osvezava stvarnu Supabase sesiju iz cookie-ja
- za sve ostale rute proverava prijavljenog korisnika preko `supabase.auth.getUser()`
- ako korisnik ne postoji, radi redirect na `/login`
- usput odrzava `app_user` cookie za audit logove

Napomena:

- UI vise ne zavisi od rucno upisanog `app_session` cookie-ja
- nema sofisticiran RBAC ili permissions model
- API rute nisu blokirane middleware-om zato sto middleware namerno preskace `/api`

## 5. Supabase integracija

### 5.1 Environment promenljive

Neophodne promenljive:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Fajl:

- `lib/supabase/shared.ts`

### 5.2 Server klijent

Fajl:

- `lib/supabase/server.ts`

Server klijent koristi anon key i radi bez persisted session-a:

- `persistSession: false`
- `autoRefreshToken: false`

Tehnicka posledica:

- middleware koristi stvarnu Supabase browser sesiju za zastitu stranica
- repository sloj i dalje ne koristi poseban user-bound Supabase session za upite ka bazi
- identitet korisnika za audit se cita iz `app_user` cookie-ja, koji middleware sinhronizuje sa prijavljenim korisnikom

## 6. Modul otkupa - tehnicki detalji

### 6.1 Dnevni unos

Glavni ekran:

- `app/daily-entry/page.tsx`

Povezani API endpoint-i:

- `GET /api/daily-entries`
- `PUT /api/daily-entries/bulk-upsert`
- `PUT /api/daily-entries/upsert`
- `GET /api/daily-entries/lock`
- `PUT /api/daily-entries/lock`
- `POST /api/corrections`

Povezani repository sloj:

- `lib/repositories/daily-entries.ts`
- `lib/repositories/daily-intake-locks.ts`
- `lib/repositories/correction-requests.ts`

Klucna pravila:

- ucitava sve dnevne unose za mesec
- cuva samo izmenjene celije
- `bulkUpsertDailyEntries` pre upisa proverava da li su svi datumi otkljucani
- zakljucavanje je enforced na serveru
- audit log se pise posle bulk upsert-a

Uvoz masnih jedinica:

- logika je trenutno na UI strani
- izvor podataka su dnevni unosi vec ucitani za prethodni ili tekuci mesec
- u zavisnosti od izabranog perioda bira se drugi izvor mm vrednosti

### 6.2 Dobavljaci

Glavne stranice i endpoint-i:

- `app/suppliers/page.tsx`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `PUT /api/suppliers/[id]`
- `DELETE /api/suppliers/[id]`
- `POST /api/suppliers/reorder`

Validacija:

- `lib/schemas/suppliers.ts`

Repository:

- `lib/repositories/suppliers.ts`

Specijalna logika:

- `hidden_in_daily_entry` odredjuje da li se proizvodjac vidi u novim dnevnim unosima
- pri kreiranju novog dobavljaca `order_index` se postavlja na kraj liste
- `bank_account` se normalizuje na srpski obrazac `3-13-2`
- srednji deo racuna se dopunjava vodecim nulama do 13 cifara
- backend provera duplikata po `first_name + last_name` je autoritativna
- create tok moze da preusmeri na overwrite postojeceg zapisa umesto pravljenja duplikata
- postoji fallback za problem sa zaostalom `suppliers.id` sekvencom

### 6.3 Pregledi i obracun

Mesecni i kvartalni pregledi:

- `app/monthly-view/page.tsx`
- `app/quarterly-view/page.tsx`
- kvartalni pregled koristi snapshot payload sa `rows`, `coveredThroughDate`, `expectedEndDate` i `isComplete`
- kada poslednji dnevni unos ne pokriva kraj kvartala, UI prikazuje upozorenje, a XLSX export dodaje datum pokrivenosti u ime fajla i zaglavlje dokumenta
- `lib/repositories/summaries.ts` paginira citanje `daily_entries` u batch-evima od 1000 redova da mesecni i kvartalni pregledi ne ostanu odseceni kada Supabase vrati samo prvi page
- PDF priznaniice koriste helper `lib/exports/monthly-receipts.ts` da prate istu racunicu kao `MonthlySummaryRow.totalAmount`: PDV se racuna samo na cenu mleka, dok je stimulacija van PDV osnovice
- `lib/utils/date.ts` ima helper-e za formatiranje ISO datuma u lokalizovani prikaz, a `lib/i18n/locale.ts` odvaja UI locale od locale-a za nativne date/month inpute

Repository:

- `lib/repositories/summaries.ts`

Formula sloj:

- `lib/calculations/formulas.ts`

Konstante:

- `lib/constants/calculation.ts`
- `lib/repositories/calculation-constants.ts`

Period helper-i:

- `lib/utils/period.ts`
- `lib/utils/date.ts`
- `lib/utils/year-month.ts`

### 6.4 Istorija po proizvodjacu

Stranica:

- `app/supplier-history/page.tsx`

API:

- `GET /api/suppliers/history`

Repository:

- `lib/repositories/supplier-history.ts`

Vraca:

- osnovne podatke o proizvodjacu
- godisnji sazetak
- mesecni pregled
- dnevne zapise

### 6.5 Korekcije i audit

Endpoint-i:

- `GET /api/corrections`
- `POST /api/corrections`
- `POST /api/corrections/[id]/review`
- `GET /api/audit-logs`

Logika:

- audit koristi `actorFromRequest`
- `actorIdentifier` se cita iz `app_user` cookie-ja
- IP i user-agent se preuzimaju iz HTTP zaglavlja kada postoje

## 7. Modul parametara obracuna

UI:

- `app/settings/page.tsx`

API:

- `GET /api/constants/versions`
- `PUT /api/constants/versions`
- `DELETE /api/constants/versions/[validFrom]`

Repository:

- `lib/repositories/calculation-constants.ts`

Karakteristike:

- vise verzija parametara po `valid_from`
- `valid_from` je datum u formatu `YYYY-MM-DD`
- dozvoljeni pocetci verzije su 1. i 16. u mesecu
- sistem automatski bira efektivnu verziju za dati datum, ukljucujuci i promene od sredine meseca
- settings UI bira `mesec + prvi/drugi deo`, a to se prevodi u `YYYY-MM-01` ili `YYYY-MM-16`
- najmanje jedna verzija mora da ostane u bazi

## 8. Produkcija i prodaja - tehnicki status

Ova dva modula trenutno nisu u istoj zrelosti kao otkup.

### 8.1 Proizvodnja

Glavni fajlovi:

- `lib/production/store.ts`
- `lib/production/intake.ts`
- `lib/production/utils.ts`
- `app/production/**`

Stanje:

- koristi Zustand `persist`
- cuva proizvode, pakovanja i proizvodne zapise lokalno
- dashboard koristi snapshot-e izvedene iz otkupa i lokalnih proizvodnih zapisa

### 8.2 Prodaja i magacin

Glavni fajlovi:

- `lib/sales/store.ts`
- `lib/sales/utils.ts`
- `app/sales/**`

Stanje:

- koristi Zustand `persist`
- kupci i isporuke se cuvaju lokalno u browser storage-u
- dashboard racuna stanje magacina iz lokalnih isporuka i lokalnih proizvodnih zapisa

Zakljucak:

- purchase modul je DB-backed
- production i sales su trenutno client-persisted moduli

## 9. Validacija podataka

Zod schema fajlovi:

- `lib/schemas/daily-entries.ts`
- `lib/schemas/corrections.ts`
- `lib/schemas/suppliers.ts`

Sta se validira:

- payload-i API poziva
- forme za dobavljace
- bulk upsert dnevnih unosa
- zahtevi za korekcije
- format tekuceg racuna za Srbiju kroz helper normalizaciju i Zod proveru

## 10. Baza i SQL migracije

Direktorijum:

- `db/`

Postojece SQL skripte:

- `001_daily_intake_locks.sql`
- `002_fix_daily_intake_locks_year_month_check.sql`
- `003_calculation_constants_versions.sql`
- `004_audit_logs.sql`
- `005_daily_entries_integrity.sql`
- `006_correction_requests.sql`
- `007_performance_indexes.sql`
- `008_update_supplier_bank_accounts_from_komitenti.sql`
- `009_supplier_daily_entry_visibility.sql`
- `010_fix_suppliers_id_sequence.sql`
- `011_monthly_summary_overrides.sql`
- `012_monthly_summary_overrides_price_with_tax.sql`
- `013_monthly_summary_overrides_recreate.sql`
- `014_calculation_constants_mid_month_effective_dates.sql`

Svrha migracija:

- zakljucavanje meseca
- verzionisani parametri obracuna
- audit logovi
- integritet dnevnih unosa
- workflow korekcija
- performance indeksi
- vidljivost dobavljaca u dnevnom unosu
- popravka sekvence za `suppliers.id`
- DB-backed override vrednosti za mesecni pregled po `year_month + period + supplier`
- migracija sa override-a `cena po kolicini` na override `cena sa PDV`, uz preracun izvedenih cena
- cista recreate skripta za `monthly_summary_overrides` ako se stara tabela brise rucno
- migracija `valid_from` polja parametara obracuna sa `YYYY-MM` na `YYYY-MM-DD`, uz podrsku za sredinu meseca

Napomena:

- projekat nema ugurani ORM ni automatski migration runner
- SQL se pusta rucno nad bazom

## 11. API pregled

### 11.1 Dobavljaci

- `GET /api/suppliers`
- `POST /api/suppliers`
- `GET /api/suppliers/[id]`
- `PUT /api/suppliers/[id]`
- `DELETE /api/suppliers/[id]`
- `POST /api/suppliers/reorder`
- `GET /api/suppliers/history`

### 11.2 Dnevni unosi

- `GET /api/daily-entries`
- `GET /api/daily-entries/[id]`
- `PUT /api/daily-entries/upsert`
- `PUT /api/daily-entries/bulk-upsert`
- `GET /api/daily-entries/lock`
- `PUT /api/daily-entries/lock`

### 11.3 Pregledi i izvoz

- `GET /api/summaries/monthly`
- `GET /api/summaries/monthly/export`
- `GET /api/summaries/monthly/receipts/pdf`
- `GET /api/summaries/monthly/payments`
- `GET /api/summaries/quarterly`
  Vraca snapshot objekat sa redovima i metapodacima o pokrivenosti kvartala.
- `GET /api/summaries/quarterly/export`
  Za parcijalne kvartale generise XLSX sa napomenom `OBUHVACENO DO` i imenom fajla `quarterly_summary_<godina>_Q<kvartal>_through_<datum>.xlsx`.

### 11.4 Parametri i administracija

- `GET /api/constants/versions`
- `PUT /api/constants/versions`
- `DELETE /api/constants/versions/[validFrom]`
- `GET /api/audit-logs`
- `GET /api/corrections`
- `POST /api/corrections`
- `POST /api/corrections/[id]/review`

## 12. I18n, teme i navigacija

I18n:

- `lib/i18n/dictionaries.ts`
- `lib/i18n/store.ts`
- `lib/i18n/use-translation.ts`

Teme:

- `lib/theme/store.ts`

Navigacija:

- `components/layout/sidebar.tsx`
- `components/layout/app-shell.tsx`
- `lib/navigation/store.ts`

Karakteristike:

- visejezicni UI
- theme switching
- korisnicko sakrivanje delova menija
- skupljen sidebar kao default stanje

## 13. Testiranje i verifikacija

Skripte iz `package.json`:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm test`

Preporucene provere:

```bash
npx tsc --noEmit --allowImportingTsExtensions
npm run build
node --test --experimental-strip-types tests/**/*.test.ts
```

Postojeci testovi:

- `tests/formulas.test.ts`
- `tests/calculation-constants.test.ts`
- `tests/payments-xml.test.ts`

Napomena:

- `npm run lint` trenutno zahteva dodatno sredjivanje ESLint 9 konfiguracije ako u repou nema `eslint.config.*`

## 14. Poznati tehnicki kompromisi

- auth zastita je jednostavna i bazirana na cookie prisustvu
- API sloj nije odvojen u poseban backend servis
- SQL migracije se pustaju rucno
- production i sales nisu jos DB-backed
- `tsconfig.json` ukljucuje `.next/types`, pa je za cist type-check cesto najbezbednije prethodno imati uspesan build

## 15. Preporuke za naredne korake

Ako se aplikacija dalje siri, najvrednije tehnicke investicije su:

1. uvodjenje pravog session/role modela
2. prebacivanje production i sales modula na server i bazu
3. uvodjenje migration workflow-a kroz alat ili CI
4. sredjivanje ESLint 9 konfiguracije
5. jaca automatizovana pokrivenost testovima za API i UI tokove
