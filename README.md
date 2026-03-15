# Zlatarka

Ovo je operativna aplikacija za mlekaru, organizovana kroz tri modula:

- otkup mleka
- proizvodnja
- prodaja i magacin

Detaljna dokumentacija je podeljena u dva README fajla:

- [README-funkcionalnosti.md](/Users/dejanpopovic/Projects/dp/zl/zlatarka-next-master/README-funkcionalnosti.md) - poslovni pregled funkcionalnosti, ekran po ekran
- [README-tehnicka-dokumentacija.md](/Users/dejanpopovic/Projects/dp/zl/zlatarka-next-master/README-tehnicka-dokumentacija.md) - tehnicka arhitektura, API, baza, razvoj i odrzavanje

Osnovno pokretanje:

```bash
npm install
npm run dev
```

Osnovne provere:

```bash
npm run verify
```

Neophodne environment promenljive:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

SQL migracije koje postoje u projektu nalaze se u direktorijumu [db](/Users/dejanpopovic/Projects/dp/zl/zlatarka-next-master/db).
