-- One-off update script for supplier bank accounts.
-- Source files used for matching:
--   1) /Users/dejanpopovic/Documents/dp_tmp/zl/komitenti.xml
--   2) /Users/dejanpopovic/Documents/dp_tmp/zl/suppliers_rows.csv
--
-- Matching rule used:
--   normalized supplier name <=> normalized COMPANY field from komitenti.xml
--   (case-insensitive, diacritics-insensitive, supports both "PREZIME IME" and "IME PREZIME")
--
-- Result:
--   all 80 suppliers covered
--   77 suppliers get a concrete bank account
--   3 suppliers are explicitly cleared to an empty account by request

begin;

create temp table tmp_supplier_bank_account_updates (
  supplier_id bigint primary key,
  bank_account text,
  supplier_name text not null,
  matched_company text not null
) on commit drop;

insert into tmp_supplier_bank_account_updates (supplier_id, bank_account, supplier_name, matched_company)
values
  (2, '205-9001021338159-85', 'Popadić Čedomir', 'POPADIC CEDOMIR'),
  (3, '205-9001011875784-63', 'Bronja Feriz', 'BRONJA FERIZ'),
  (4, '205-9001021492832-17', 'Hasanovic Ersin', 'HASANOVIC ERSIN'),
  (5, '205-9001006574261-27', 'Kamberovic Fadil', 'KAMBEROVIC FADIL'),
  (6, '200-0000081366861-36', 'Muratović Ćemal', 'MURATOVIC CEMAL'),
  (7, '200-0000130375073-46', 'Muratović Zumreta', 'MURATOVIC ZUMRETA'),
  (8, '205-9001021591776-05', 'Muratović Benjamin', 'MURATOVIC BENJAMIN'),
  (9, '155-5200181989863-58', 'Muratović Murat', 'MURATOVIC MURAT'),
  (10, '205-9001008329760-48', 'Bogućanin Selman', 'BOGUCANIN SELMAN'),
  (11, '325-9300600577974-33', 'Bronja Ersina', 'BRONJA ERSINA'),
  (12, '200-0000130585132-78', 'Muratović Dželadin', 'MURATOVIC DZELADIN'),
  (13, '205-9001014669417-61', 'Bogućanin Izet', 'BOGUCANIN IZET'),
  (14, '205-9001019888320-25', 'Bogućanin Muamer', 'BOGUCANIN MUAMER'),
  (15, '205-9001018392738-36', 'Bogućanin Muzafer', 'BOGUCANIN MUZAFER'),
  (16, '205-9001018399414-87', 'Bogućanin Ismet', 'BOGUCANIN ISMET'),
  (17, '205-9001017411232-22', 'Bogućanin Asmir', 'BOGUCANIN ASMIR'),
  (18, '205-9001014857159-17', 'Bogućanin Mirzet', 'BOGUCANIN MIRZET'),
  (19, '200-0000129622024-63', 'Bogućanin Fehim', 'BOGUCANIN FEHIM'),
  (20, '200-0000081132054-43', 'Bronja Mahmut', 'BRONJA MAHMUT'),
  (21, '205-1001529520361-90', 'Bronja Taip', 'BRONJA TAIP'),
  (22, '205-1001528464642-03', 'Bronja Rifat', 'BRONJA RIFAT'),
  (23, '205-9001019062995-75', 'Bronja Ismet', 'BRONJA ISMET'),
  (24, '205-9001015190727-62', 'Bronja Osman', 'BRONJA OSMAN'),
  (25, '200-0000121747243-56', 'Bronja Ajka', 'BRONJA AJKA'),
  (26, '205-9001011614093-18', 'Bronja Nusret', 'BRONJA NUSRET'),
  (27, '200-0000127081239-61', 'Mašović Alija', 'MASOVIC ALIJA'),
  (28, '205-1001528464022-20', 'Avdović Hasim', 'AVDOVIC HASIM'),
  (29, '205-9001006930637-33', 'Avdović Refik', 'AVDOVIC REFIK'),
  (30, '205-9001009602029-94', 'Muratović Sait', 'MURATOVIC SAIT'),
  (31, '205-9001013544378-63', 'Šaćirović Dževad', 'SACIROVIC DZEVAD'),
  (32, '155-5211080207718-41', 'Šaćirović Mirzet', 'SACIROVIC MIRZET'),
  (33, '205-9001009604145-51', 'Ujkanović Naser', 'UJKANOVIC NASER'),
  (34, '205-1001525354902-54', 'Aljovic Alija', 'ALJOVIC ALIJA'),
  (35, '155-0001000251760-64', 'Aljović Jahija', 'JAHIJA ALJOVIC'),
  (36, '205-9001020190433-54', 'Smajović Edževid', 'SMAJEVIC EDZEVID'),
  (37, '205-9001018324422-23', 'Muratović Iso', 'MURATOVIC ISO'),
  (38, '200-0000129903660-25', 'Sejdović Feriz', 'SEJDOVIC FERIZ'),
  (39, '200-0000129903775-68', 'Džanković Izet', 'DZANKOVIC IZET'),
  (40, '205-9001002384352-09', 'Džanković Fikret', 'DZANKOVIC FIKRET'),
  (41, '205-9001003095125-41', 'Hamidović Ramiza', 'HAMIDOVIC RAMIZA'),
  (42, '205-9001019924482-82', 'Hamidović Rahman', 'HAMIDOVIC RAHMAN'),
  (43, '205-1001528463816-56', 'Kamberović Nusret', 'KAMBEROVIC NUSRET'),
  (44, '200-0000130205933-59', 'Ferhatović Feriz', 'FERHATOVIC FERIZ'),
  (45, '205-1001526946551-29', 'Hamidović Ibrahim', 'HAMIDOVIC IBRAHIM'),
  (46, '200-0000133763066-18', 'Hamidović Nusret', 'HAMIDOVIC NUSRET'),
  (47, '205-9001019069167-86', 'Skrijelj Sadat', 'SKRIJELJ SADAT'),
  (48, '200-0000113323124-33', 'Ibrović Mirsad', 'IBROVIC MIRSAD'),
  (49, '325-9340600087375-43', 'Ibrovic Nihad', 'IBROVIC NIHAD'),
  (50, '155-0001000028050-51', 'Hamidović Husein', 'HAMIDOVIC HUSEIN'),
  (51, '200-0000129022213-49', 'Šehović Ćemal', 'SEHOVIC CEMAL'),
  (52, '200-0000129903040-42', 'Halković Merfin', 'HALKOVIC MERFIN'),
  (53, '200-0000129632755-74', 'Brničanin Iso', 'BRNICANIN ISO'),
  (54, '205-9001007387694-54', 'Šabanović Safet', 'SABANOVIC SAFET'),
  (55, '200-0000130569889-23', 'Duljevic Mesud', 'DULJEVIC MESUD'),
  (56, '200-0000133766510-65', 'Ganović Zenun', 'GANOVIC ZENUN'),
  (57, '200-0000129904089-96', 'Asotić Iljaz', 'ASOTIC ILJAZ'),
  (58, '200-0000136681184-11', 'Muratović Latif', 'MURATOVIC LATIF 2'),
  (59, '200-0000136267329-73', 'Muratovic Fatih', 'MURATOVIC FATIH'),
  (60, '200-0000130696279-26', 'Muratović Halil', 'MURATOVIC HALIL'),
  (61, '205-1001529523227-28', 'Vatić Zulfo', 'VATIC ZULFO'),
  (62, '160-5300800129763-25', 'Biočanin Njegoš', 'BIOCANIN NJEGOS'),
  (63, '205-9001030883054-91', 'Jakupović Haris', 'JAKUPOVIC HARIS'),
  (64, '205-9001006080498-29', 'Hasanović Hitko', 'HASANOVIC HITKO'),
  (67, '200-0000082032304-64', 'Bronja Redzep', 'BRONJA REDZEP'),
  (68, null, 'Hasanovic Hatko', 'MANUAL EMPTY ACCOUNT'),
  (69, '325-9300706605394-76', 'Ostojić Milan', 'OSTOJIC MILAN'),
  (70, '205-9001018537345-96', 'Stanić Mirko', 'STANIC MIRKO'),
  (71, null, 'Trmcic Radoslav', 'MANUAL EMPTY ACCOUNT'),
  (72, '205-1001528292393-31', 'Popović Mladomir', 'POPOVIC MLADOMIR'),
  (73, '325-9300706165386-27', 'Džanković Muzafer', 'DZANKOVIC MUZAFER'),
  (75, '205-1001528465414-15', 'Mujovic Enis', 'MUJOVIC ENIS'),
  (76, '200-0000129904160-77', 'Saljic Irfan', 'SALJIC IRFAN'),
  (78, '205-1001548193041-35', 'Muratovic Nedzib', 'MURATOVIC NEDZIB'),
  (80, '200-0000121970694-70', 'Novcic Radojica', 'NOVCIC RADOICA'),
  (81, null, 'Hasanovic Enis', 'MANUAL EMPTY ACCOUNT'),
  (82, '325-9300706154066-37', 'Karisik Hajro', 'KARISIK HAJRO'),
  (83, '205-9001006146278-84', 'Jakupović Habib', 'JAKUPOVIC HABIB'),
  (84, '205-9001017407782-90', 'Spasojević Negoslav', 'SPASOJEVIC NEGOSLAV'),
  (85, '205-9001028419014-35', 'Bojović Žarko', 'BOJOVIC ZARKO'),
  (86, '205-9001009604145-51', 'Ujkanović Naser', 'UJKANOVIC NASER');

update public.suppliers s
set bank_account = u.bank_account
from tmp_supplier_bank_account_updates u
where s.id = u.supplier_id
  and s.bank_account is distinct from u.bank_account;

-- Verification
select
  s.id,
  s.first_name,
  s.last_name,
  s.bank_account,
  u.matched_company
from public.suppliers s
join tmp_supplier_bank_account_updates u on u.supplier_id = s.id
order by s.id;

commit;
