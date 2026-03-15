# Repo Rules

## Documentation

- Posle svake promene korisnickog ponasanja, UI toka ili poslovnog pravila azuriraj `README-funkcionalnosti.md`.
- Posle svake promene API-ja, validacije, SQL migracije, arhitekture, autentifikacije ili nacina cuvanja podataka azuriraj `README-tehnicka-dokumentacija.md`.
- Ako promena utice i na funkcionalni i na tehnicki nivo, azuriraj oba dokumenta u istom zadatku.
- Ne zavrsavaj zadatak dok ne proveris da li dokumentacija treba da se dopuni.

## Required Verification

- Pre finalnog odgovora obavezno pokreni `npm run verify` za svaku promenu koda, konfiguracije ili baze koja moze da utice na build, tipove ili testove.
- Ako `npm run verify` ne moze da prodje, to mora biti eksplicitno prijavljeno korisniku sa jasnim razlogom.
- Ako je promena samo dokumentacija i nije menjan kod, verifikacija nije obavezna osim ako korisnik to izricito trazi.

## Change Checklist

- Proveri da li izmena menja:
  - korisnicki tok
  - API payload ili response
  - SQL skripte ili strukturu baze
  - validaciju
  - operativne korake za korisnika
- Ako menja bilo sta od navedenog, azuriraj odgovarajuci README pre zavrsetka.
