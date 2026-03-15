# Zlatarka - funkcionalna dokumentacija

## 1. Namena aplikacije

Zlatarka je interna aplikacija za rad mlekare. Pokriva tri glavna operativna toka:

- otkup mleka od proizvodjaca
- internu proizvodnju
- prodaju, kupce i magacin

Najzreliji i najvise povezan sa bazom je modul za otkup. Moduli za proizvodnju i prodaju postoje i rade, ali se trenutno veci deo njihovih podataka cuva lokalno u browser storage-u, ne u Supabase bazi.

## 2. Prijava i pristup

Korisnik se prijavljuje preko login forme. Nakon uspesne prijave aplikacija:

- koristi Supabase email/password autentifikaciju
- upisuje `app_session` cookie za pristup aplikaciji
- upisuje `app_user` cookie koji se koristi za audit i identifikaciju korisnika u logovima

Sve stranice osim `/login` su zasticene middleware-om i traze prisutan `app_session` cookie.

## 3. Glavni moduli

### 3.1 Otkup mleka

Ovo je centralni modul aplikacije. Obuhvata dnevni rad, preglede, obracun, proizvodjace, korekcije i audit.

#### 3.1.1 Kontrolna tabla otkupa

Stranica: `/dashboard`

Namena:

- pregled kljucnih pokazatelja za izabrani period
- brz uvid u ukupnu kolicinu, prosecnu masnu jedinicu, ukupan iznos i broj aktivnih dobavljaca

Tipicna upotreba:

- dnevni ili mesecni operativni pregled
- poredjenje sa prethodnim periodom

#### 3.1.2 Dnevni unos mleka

Stranica: `/daily-entry`

Ovo je najvazniji operativni ekran za unos kolicine i masnih jedinica.

Glavne funkcionalnosti:

- izbor godine, meseca i perioda:
  - `1-15`
  - `16-kraj`
  - `Ceo mesec`
- tabela po proizvodjacu i danima
- unos dnevne kolicine po celiji
- prikaz prosecnog mm po proizvodjacu
- red `Zbir` i kolona `Ukupno`
- XLSX izvoz dnevnog prikaza
- cuvanje samo izmenjenih vrednosti
- zastita od izlaska sa strane kada postoje nesacuvane izmene
- zakljucavanje i otkljucavanje meseca

Masne jedinice:

- za svakog proizvodjaca mogu da se unose i menjaju mm vrednosti
- postoji popup za pregled i izmenu mm po proizvodjacu
- postoji opcija `Uvezi mm`

Uvoz mm:

- ako je izabran `1-15`, uvoz se bazira na poslednjim mm iz prethodnog meseca
- ako je izabran `16-kraj`, uvoz se bazira na mm iz prvog dela tekuceg meseca
- ako je izabran `Ceo mesec`, uvoz se bazira na prethodnom mesecu
- korisnik moze:
  - da vidi predlozene mm vrednosti
  - da ih rucno izmeni pre uvoza
  - da iskljuci pojedine proizvodjace iz kopiranja
  - da ukljuci opciju da se mm kopira samo onima kojima nedostaje za ciljni deo meseca

Rad sa aktivnim i neaktivnim proizvodjacima:

- proizvodjac moze biti sakriven iz novog dnevnog unosa
- sakriveni proizvodjaci se ne prikazuju u novim mesecima bez aktivnosti
- ako vec imaju unos u posmatranom mesecu, ostaju vidljivi zbog istorije
- kroz dijalog `Dodatni proizvodjaci` mogu ponovo da se ukljuce
- klik na ime proizvodjaca otvara mali akcioni popup:
  - `Detalji`
  - `Sakrij` ili `Ukljuci`

Zakljucavanje meseca:

- zakljucan mesec postaje read-only
- ne dozvoljava se izmena dnevnog unosa
- ne dozvoljava se bulk upsert za taj mesec
- zakljucavanje je server-side provereno, nije samo UI blokada

Korekcije:

- kada je mesec zakljucan, korisnik moze da posalje zahtev za korekciju
- korekcija se vezuje za proizvodjaca, datum, polje i trazenu novu vrednost

#### 3.1.3 Mesecni pregled

Stranica: `/monthly-view`

Namena:

- obracun po proizvodjacu za izabrani mesec i period
- pregled ukupne kolicine, prosecnog mm i obracunatih finansijskih vrednosti

Glavne funkcionalnosti:

- filteri po godini, mesecu, periodu i gradu
- prikaz agregiranih podataka po proizvodjacu
- koriscenje parametara obracuna koji vaze za konkretan mesec
- izvoz pregleda u XLSX
- generisanje priznanica u PDF formatu
- generisanje XML fajla za placanja
- izbor samo odredjenih proizvodjaca za placanja i izvoz

Napomena:

- u XML za placanja ulaze samo proizvodjaci sa iznosom vecim od 0 i unetim tekucim racunom

#### 3.1.4 Kvartalni pregled

Stranica: `/quarterly-view`

Namena:

- pregled kvartalne stimulacije po proizvodjacu

Glavne funkcionalnosti:

- izbor godine i kvartala
- prikaz ukupne kolicine po proizvodjacu
- obracun kvartalne premije po litru
- izvoz kvartalnog pregleda u XLSX

#### 3.1.5 Pregled po proizvodjacu

Stranica: `/supplier-history`

Namena:

- pregled godisnje istorije jednog proizvodjaca

Glavne funkcionalnosti:

- pretraga proizvodjaca po imenu, prezimenu i gradu
- otvaranje detalja proizvodjaca direktno iz dnevnog unosa
- godisnji zbir:
  - ukupno litara
  - ukupan iznos
  - prosecna mm
  - broj aktivnih meseci i dana
  - poslednja isporuka
- mesecni pregled po mesecima
- dnevni detalji po datumima

#### 3.1.6 Dodavaci

Stranica: `/suppliers`

Namena:

- administracija proizvodjaca/dobavljaca

Glavne funkcionalnosti:

- dodavanje novog dobavljaca
- izmena postojeceg dobavljaca
- brisanje dobavljaca
- pomeranje redosleda gore/dole
- automatsko postavljanje `order_index` na poslednje mesto pri kreiranju
- pregled statusa da li je aktivan za dnevni unos
- pregled broja krava
- vizuelno obelezavanje redova ako fale kljucni podaci:
  - broj gazdinstva
  - maticni broj
  - broj racuna
- tooltip koji objasnjava sta tacno nedostaje

Polja i validacija:

- u aplikaciji su obavezni:
  - redosled
  - ime
  - prezime
  - grad
- drzava se automatski postavlja na `Srbija`

Napomena:

- kljucni identifikacioni podaci nisu prikazani kao posebne kolone u tabeli da ekran ne bi bio pretrpan
- oni su dostupni kroz formu/modal za izmenu

#### 3.1.7 Parametri obracuna

Stranica: `/settings`

Namena:

- upravljanje verzijama finansijskih parametara koji vaze od odredjenog meseca

Parametri:

- cena po masnoj jedinici
- procenat poreza
- pragovi stimulacije
- iznosi stimulacije
- kvartalna premija po litru

Glavne funkcionalnosti:

- cuvanje vise verzija parametara
- izbor od kog meseca verzija vazi
- pregled aktivne verzije za konkretan mesec
- brisanje stare verzije, uz uslov da bar jedna ostane

#### 3.1.8 Korekcije

Stranica: `/corrections`

Namena:

- obrada zahteva za korekciju nakon zakljucavanja meseca

Glavne funkcionalnosti:

- pregled svih zahteva
- filtriranje po statusu i periodu
- odobravanje ili odbijanje
- pracenje ko je trazio i ko je odlucio

#### 3.1.9 Audit logovi

Stranica: `/audit-logs`

Namena:

- pregled bitnih akcija u sistemu

Sta se prati:

- bulk izmene dnevnog unosa
- zakljucavanje i otkljucavanje meseca
- zahtevi za korekcije
- odluke po korekcijama
- izmene parametara gde je audit implementiran

#### 3.1.10 Podesavanje menija

Stranica: `/menu-settings`

Namena:

- skrivanje ili prikazivanje sekcija i pojedinacnih stavki u sidebar-u

Glavne funkcionalnosti:

- sakrivanje celih sekcija
- sakrivanje pojedinacnih stavki
- reset na podrazumevani meni

### 3.2 Proizvodnja

Modul proizvodnje postoji kao zasebna celina sa sopstvenim ekranima.

Stranice:

- `/production/dashboard`
- `/production/daily-entry`
- `/production/products`
- `/production/reports`
- `/production/traceability`

Stanje modula:

- funkcionalan je za lokalni rad u browser-u
- podaci se trenutno cuvaju u lokalnom Zustand store-u sa persist mehanizmom
- nije jos potpuno vezan za server bazu kao modul otkupa

Glavne funkcionalnosti:

- pregled otkupnog mleka kao ulaza za preradu
- dnevni unos prerade
- rad sa proizvodima i pakovanjima
- izvestaji o preradi i pakovanju
- sledljivost po proizvodnim zapisima

### 3.3 Prodaja i magacin

Modul prodaje i magacina takodje postoji kao zasebna celina.

Stranice:

- `/sales/dashboard`
- `/sales/deliveries`
- `/sales/customers`

Stanje modula:

- koristi lokalni Zustand store sa persist mehanizmom
- nije jos potpuno prebacen na Supabase bazu

Glavne funkcionalnosti:

- upravljanje kupcima
- evidentiranje isporuka
- pregled stanja po pakovanjima
- osnovni dashboard prodaje
- top kupci i istorija isporuka

## 4. Zajednicke funkcionalnosti kroz aplikaciju

### 4.1 Sidebar i navigacija

- sidebar je po defaultu skupljen
- kada je skupljen, stavke imaju tooltip na hover/focus
- meni se moze rucno prosiriti
- mobilni prikaz ima poseban mobile open/close tok

### 4.2 Jezik

Aplikacija podrzava:

- srpski (cirilica)
- engleski

### 4.3 Tema

Postoji vise tema interfejsa:

- Zlatar
- Uvac
- Kamen

### 4.4 Upozorenja za nesacuvane izmene

Na ekranima gde postoji ozbiljan operativni unos:

- aplikacija prepoznaje nesacuvane promene
- prilikom izlaska upozorava korisnika
- nudi da sacuva ili da nastavi bez cuvanja

## 5. Poslovna pravila koja su vec ugradjena

- jedan proizvodjac moze biti privremeno sakriven iz novog dnevnog unosa
- istorijski meseci ostaju vidljivi i kada je proizvodjac sakriven
- jedan mesec moze biti zakljucan i time postaje read-only
- korekcije se koriste kada je mesec zakljucan
- obracun po mesecu koristi verziju parametara koja vazi za taj mesec
- za XML placanja nisu dovoljni samo podaci o kolicini, vec i ispravan racun
- pri kreiranju novog proizvodjaca redosled ide na kraj liste

## 6. Ogranicenja i vazne napomene

- modul otkupa je glavni produkcijski deo i oslanja se na bazu
- moduli proizvodnje i prodaje su trenutno vise operativni prototipovi unutar iste aplikacije
- middleware proverava prisustvo session cookie-ja, ali aplikacija nema slozen role/permission model
- deo kvaliteta rada zavisi od toga da li su SQL migracije pustene u bazi

## 7. Preporuceni nacin koriscenja

Za svakodnevni rad mlekare preporuceni tok je:

1. azuriranje proizvodjaca i njihovih podataka
2. dnevni unos kolicina i masnih jedinica
3. zakljucavanje meseca kada se zavrsi obracun
4. po potrebi slanje i obrada korekcija
5. mesecni pregled i izvoz placanja
6. kvartalni pregled za premije
