import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const DEFAULT_XLSX_PATH = '/Users/dejanpopovic/Documents/dp_tmp/zl/otkup sjenica - 2026 - Copy.xlsx';
const DEFAULT_SUPPLIERS_PATH = '/Users/dejanpopovic/Documents/dp_tmp/zl/suppliers_rows.csv';
const DEFAULT_SQL_OUTPUT = '/Users/dejanpopovic/Projects/dp/zl/zlatarka-next-master/db/generated/sjenica_jan_feb_2026_daily_entries.sql';
const DEFAULT_JSON_OUTPUT = '/Users/dejanpopovic/Projects/dp/zl/zlatarka-next-master/db/generated/sjenica_jan_feb_2026_preview.json';
const DEFAULT_MODE = 'name-based';

const MONTH_BY_SHEET = {
  jan: '01',
  feb: '02',
};

const DATE_BY_SECTION = {
  'prvi deo': '01',
  'drugi deo': '16',
};

const NAME_ALIASES = {
  'bogucanin mamer': 'bogucanin muamer',
  'nmasovic alija': 'masovic alija',
  'ujanovic naser': 'ujkanovic naser',
  'kamberovic nusreet': 'kamberovic nusret',
  'mujovic enes': 'mujovic enis',
  'novcic radoica': 'novcic radojica',
};

const MANUAL_SUPPLIER_SEEDS = {
  'bogucanin almir': {
    key: 'bogucanin_almir',
    fixedId: 87,
    firstName: 'Almir',
    lastName: 'Bogu\\u0107anin',
    firstNameVariants: ['Almir'],
    lastNameVariants: ['Bogu\\u0107anin', 'Bogucanin'],
    city: 'Sjenica',
    country: 'Srbija',
  },
};

function parseArgs(argv) {
  const args = {
    xlsx: DEFAULT_XLSX_PATH,
    suppliers: DEFAULT_SUPPLIERS_PATH,
    sql: DEFAULT_SQL_OUTPUT,
    json: DEFAULT_JSON_OUTPUT,
    mode: DEFAULT_MODE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value) continue;

    if (key === '--xlsx') args.xlsx = value;
    if (key === '--suppliers') args.suppliers = value;
    if (key === '--sql') args.sql = value;
    if (key === '--json') args.json = value;
    if (key === '--mode') args.mode = value;
  }

  return args;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function canonicalName(value) {
  const normalized = normalizeText(value);
  return NAME_ALIASES[normalized] ?? normalized;
}

function stripDiacritics(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getManualSupplierSeed(normalizedName) {
  return MANUAL_SUPPLIER_SEEDS[normalizedName] ?? null;
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current !== '' || row.length > 0) {
    row.push(current);
    if (row.some((value) => value !== '')) rows.push(row);
  }

  return rows;
}

function loadSuppliers(csvPath) {
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csvText);
  const header = rows[0] ?? [];
  const headerIndex = new Map(header.map((name, index) => [name, index]));

  const suppliers = [];
  const supplierByName = new Map();

  for (const row of rows.slice(1)) {
    const id = Number(row[headerIndex.get('id')]);
    const firstName = row[headerIndex.get('first_name')] ?? '';
    const lastName = row[headerIndex.get('last_name')] ?? '';
    const orderIndex = Number(row[headerIndex.get('order_index')] ?? 0);

    if (!Number.isFinite(id) || !firstName || !lastName) continue;

    const fullName = `${lastName} ${firstName}`;
    const normalized = canonicalName(fullName);
    const supplier = {
      firstName,
      lastName,
      fullName,
      normalized,
      orderIndex,
      supplierId: id,
      lookupKey: normalized,
      firstNameVariants: uniqueValues([firstName, stripDiacritics(firstName)]),
      lastNameVariants: uniqueValues([lastName, stripDiacritics(lastName)]),
    };

    suppliers.push(supplier);
    supplierByName.set(normalized, supplier);
  }

  return { suppliers, supplierByName };
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function parseWorkbook(xlsxPath) {
  const workbook = XLSX.readFile(xlsxPath, { cellDates: true });
  const parsedRows = [];

  for (const [sheetName, month] of Object.entries(MONTH_BY_SHEET)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Missing sheet: ${sheetName}`);

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
    let sectionDay = null;
    let sectionLabel = null;

    for (const row of rows) {
      const firstCell = String(row[0] ?? '').trim();
      const normalizedFirstCell = normalizeText(firstCell);

      if (normalizedFirstCell.includes('prvi deo')) {
        sectionDay = DATE_BY_SECTION['prvi deo'];
        sectionLabel = 'prvi deo';
        continue;
      }

      if (normalizedFirstCell.includes('drugi deo')) {
        sectionDay = DATE_BY_SECTION['drugi deo'];
        sectionLabel = 'drugi deo';
        continue;
      }

      if (!sectionDay) continue;
      if (!/^\d+$/.test(firstCell)) continue;

      const supplierName = String(row[1] ?? '').trim();
      if (!supplierName) continue;

      parsedRows.push({
        sourceSheet: sheetName,
        sourceSection: sectionLabel,
        date: `2026-${month}-${sectionDay}`,
        supplierName,
        normalizedSupplierName: canonicalName(supplierName),
        qty: parseNumber(row[2]),
        fatPct: parseNumber(row[3]),
        pricePerLiter: parseNumber(row[5]),
        stimulation: parseNumber(row[8]),
        totalAmount: parseNumber(row[9]),
      });
    }
  }

  return parsedRows;
}

function resolveRows(parsedRows, supplierByName) {
  const resolved = [];
  const unresolved = [];
  const skipped = [];
  const duplicateCheck = new Set();

  for (const row of parsedRows) {
    if (row.qty === null || row.qty <= 0) {
      skipped.push({
        ...row,
        reason: 'qty_missing_or_zero',
      });
      continue;
    }

    const supplier = supplierByName.get(row.normalizedSupplierName);

    if (!supplier) {
      const manualSeed = getManualSupplierSeed(row.normalizedSupplierName);
      if (manualSeed) {
        resolved.push({
          ...row,
          supplierId: manualSeed.fixedId,
          supplierFirstName: manualSeed.firstName,
          supplierLastName: manualSeed.lastName,
          supplierOrderIndex: Number.MAX_SAFE_INTEGER,
          supplierLookupKey: manualSeed.key,
          manualSupplierKey: manualSeed.key,
        });
        continue;
      }

      unresolved.push(row);
      continue;
    }

    const resolvedRow = {
      ...row,
      supplierId: supplier.supplierId,
      supplierFirstName: supplier.firstName,
      supplierLastName: supplier.lastName,
      supplierOrderIndex: supplier.orderIndex,
      supplierLookupKey: supplier.lookupKey,
      firstNameVariants: supplier.firstNameVariants,
      lastNameVariants: supplier.lastNameVariants,
    };

    const duplicateKey = `${resolvedRow.date}:${resolvedRow.supplierLookupKey}`;
    if (duplicateCheck.has(duplicateKey)) {
      throw new Error(`Duplicate import row for supplier ${resolvedRow.supplierLookupKey} on ${resolvedRow.date}`);
    }
    duplicateCheck.add(duplicateKey);

    resolved.push(resolvedRow);
  }

  resolved.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    return left.supplierOrderIndex - right.supplierOrderIndex;
  });

  return { resolved, unresolved, skipped };
}

function sqlNumber(value) {
  if (value === null || value === undefined) return 'null';
  return Number.isInteger(value) ? String(value) : String(value);
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function buildSql(rows) {
  const suppliersByKey = new Map();
  for (const row of rows) {
    if (!suppliersByKey.has(row.supplierLookupKey)) {
      if (row.manualSupplierKey) {
        const seed = Object.values(MANUAL_SUPPLIER_SEEDS).find((item) => item.key === row.manualSupplierKey);
        if (!seed) throw new Error(`Missing manual supplier seed for ${row.manualSupplierKey}`);
        suppliersByKey.set(row.supplierLookupKey, {
          lookupKey: row.supplierLookupKey,
          displayName: `${seed.lastName} ${seed.firstName}`,
          firstNameVariants: uniqueValues([seed.firstName, ...seed.firstNameVariants.map(stripDiacritics)]),
          lastNameVariants: uniqueValues([seed.lastName, ...seed.lastNameVariants.map(stripDiacritics)]),
          manualSeed: seed,
        });
      } else {
        suppliersByKey.set(row.supplierLookupKey, {
          lookupKey: row.supplierLookupKey,
          displayName: `${row.supplierLastName} ${row.supplierFirstName}`,
          firstNameVariants: row.firstNameVariants,
          lastNameVariants: row.lastNameVariants,
          manualSeed: null,
        });
      }
    }
  }

  const supplierRefs = [...suppliersByKey.values()];
  const supplierCtes = supplierRefs.flatMap((supplier) => {
    const key = supplier.lookupKey.replace(/[^a-z0-9]+/g, '_');
    const firstNameList = supplier.firstNameVariants.map((value) => `'${escapeSqlString(value)}'`).join(', ');
    const lastNameList = supplier.lastNameVariants.map((value) => `'${escapeSqlString(value)}'`).join(', ');

    if (supplier.manualSeed) {
      const seed = supplier.manualSeed;
      const seedCte = `supplier_seed_${key} as (
  insert into public.suppliers (order_index, first_name, last_name, city, country)
  select
    coalesce((select max(order_index) from public.suppliers), 0) + 1,
    '${escapeSqlString(seed.firstName)}',
    '${escapeSqlString(seed.lastName)}',
    '${escapeSqlString(seed.city)}',
    '${escapeSqlString(seed.country)}'
  where not exists (
    select 1
    from public.suppliers
    where first_name in (${firstNameList})
      and last_name in (${lastNameList})
  )
  returning id
)`;
      const refCte = `supplier_ref_${key} as (
  select id
  from (
    select id, 0 as priority from supplier_seed_${key}
    union all
    select id, 1 as priority
    from public.suppliers
    where first_name in (${firstNameList})
      and last_name in (${lastNameList})
  ) supplier_match
  order by priority, id
  limit 1
)`;

      return [seedCte, refCte];
    }

    return [
      `supplier_ref_${key} as (
  select id
  from public.suppliers
  where first_name in (${firstNameList})
    and last_name in (${lastNameList})
  order by id
  limit 1
)`,
    ];
  });

  const missingSupplierRefs = supplierRefs.map((supplier) => {
    const key = supplier.lookupKey.replace(/[^a-z0-9]+/g, '_');
    return `  select '${escapeSqlString(supplier.displayName)}' as supplier_name
  where not exists (select 1 from supplier_ref_${key})`;
  });

  const importRows = rows.map((row) => {
    const refKey = row.supplierLookupKey.replace(/[^a-z0-9]+/g, '_');
    const supplierExpression = `(select id from supplier_ref_${refKey})`;

    return `  select ${supplierExpression} as supplier_id, '${row.date}'::date as date, ${sqlNumber(row.qty)}::numeric as qty, ${sqlNumber(row.fatPct)}::numeric as fat_pct`;
  });

  return [
    '-- Generated by scripts/generate-sjenica-jan-feb-import.mjs',
    '-- Source workbook: jan/feb tabs, first and second half of month mapped to 1st and 16th.',
    '-- Supplier IDs are resolved by name in the target database.',
    'begin;',
    '',
    'with',
    `${supplierCtes.join(',\n')},`,
    'missing_supplier_refs as (',
    `${missingSupplierRefs.join('\n  union all\n')}`,
    '),',
    'validation as (',
    "  select case",
    '    when exists (select 1 from missing_supplier_refs)',
    "      then cast((select string_agg(supplier_name, ', ') from missing_supplier_refs) as integer)",
    '    else 1',
    '  end as ok',
    '),',
    'import_rows as (',
    `${importRows.join('\n  union all\n')}`,
    ')',
    'insert into public.daily_entries (supplier_id, date, qty, fat_pct)',
    'select supplier_id, date, qty, fat_pct',
    'from import_rows',
    'cross join validation',
    'on conflict (supplier_id, date) do update',
    'set qty = excluded.qty,',
    '    fat_pct = excluded.fat_pct;',
    '',
    'commit;',
    '',
  ].join('\n');
}

function buildFixedIdSql(rows) {
  const manualSeeds = [...new Set(rows.map((row) => row.manualSupplierKey).filter(Boolean))].map((key) => {
    const seed = Object.values(MANUAL_SUPPLIER_SEEDS).find((item) => item.key === key);
    if (!seed) throw new Error(`Missing manual supplier seed for ${key}`);
    return seed;
  });

  const seedStatements = manualSeeds.flatMap((seed) => {
    const firstNameList = seed.firstNameVariants.map((value) => `'${escapeSqlString(value)}'`).join(', ');
    const lastNameList = seed.lastNameVariants.map((value) => `'${escapeSqlString(value)}'`).join(', ');

    return [
      `insert into public.suppliers (id, order_index, first_name, last_name, city, country)`,
      'select',
      `  ${seed.fixedId},`,
      '  coalesce((select max(order_index) from public.suppliers), 0) + 1,',
      `  '${escapeSqlString(seed.firstName)}',`,
      `  '${escapeSqlString(seed.lastName)}',`,
      `  '${escapeSqlString(seed.city)}',`,
      `  '${escapeSqlString(seed.country)}'`,
      'where not exists (',
      '  select 1',
      '  from public.suppliers',
      `  where id = ${seed.fixedId}`,
      ');',
      '',
      'select case',
      `  when exists (select 1 from public.suppliers where id = ${seed.fixedId} and (first_name not in (${firstNameList}) or last_name not in (${lastNameList})))`,
      '    then cast(\'manual supplier id conflict\' as integer)',
      `  when exists (select 1 from public.suppliers where first_name in (${firstNameList}) and last_name in (${lastNameList}) and id <> ${seed.fixedId})`,
      '    then cast(\'manual supplier name conflict\' as integer)',
      '  else 1',
      'end;',
      '',
      `select setval(pg_get_serial_sequence('public.suppliers', 'id'), greatest(coalesce((select max(id) from public.suppliers), 0), ${seed.fixedId}), true);`,
      '',
    ];
  });

  const values = rows.map(
    (row) => `  (${row.supplierId}, '${row.date}', ${sqlNumber(row.qty)}, ${sqlNumber(row.fatPct)})`
  );

  return [
    '-- Generated by scripts/generate-sjenica-jan-feb-import.mjs',
    '-- Fixed-ID version. Safe only if supplier IDs match between environments.',
    '-- Provided dev/prod supplier lists were compared and matched.',
    '-- Duplicate name note: Ujkanovic/Ujanovic Naser is mapped to supplier_id 33.',
    'begin;',
    '',
    ...seedStatements,
    'insert into public.daily_entries (supplier_id, date, qty, fat_pct)',
    'values',
    `${values.join(',\n')}`,
    'on conflict (supplier_id, date) do update',
    'set qty = excluded.qty,',
    '    fat_pct = excluded.fat_pct;',
    '',
    'commit;',
    '',
  ].join('\n');
}

function buildPreview(parsedRows, resolvedRows, skippedRows, unresolvedRows) {
  const summaryByDate = {};

  for (const row of resolvedRows) {
    if (!summaryByDate[row.date]) {
      summaryByDate[row.date] = {
        supplierCount: 0,
        totalQty: 0,
      };
    }

    summaryByDate[row.date].supplierCount += 1;
    summaryByDate[row.date].totalQty += row.qty;
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceWorkbook: DEFAULT_XLSX_PATH,
    sourceSuppliersCsv: DEFAULT_SUPPLIERS_PATH,
    parsedRowCount: parsedRows.length,
    importedRowCount: resolvedRows.length,
    skippedRowCount: skippedRows.length,
    unresolvedRowCount: unresolvedRows.length,
    summaryByDate,
    importedRows: resolvedRows.map((row) => ({
      date: row.date,
      supplierId: null,
      supplierNameExcel: row.supplierName,
      supplierNameDb: `${row.supplierLastName} ${row.supplierFirstName}`,
      supplierLookupKey: row.supplierLookupKey,
      qty: row.qty,
      fatPct: row.fatPct,
      pricePerLiter: row.pricePerLiter,
      stimulation: row.stimulation,
      totalAmount: row.totalAmount,
    })),
    skippedRows: skippedRows.map((row) => ({
      date: row.date,
      supplierId: row.supplierId,
      supplierNameExcel: row.supplierName,
      supplierNameDb: `${row.supplierLastName} ${row.supplierFirstName}`,
      qty: row.qty,
      fatPct: row.fatPct,
      pricePerLiter: row.pricePerLiter,
      reason: row.reason,
    })),
    unresolvedRows: unresolvedRows.map((row) => ({
      date: row.date,
      supplierNameExcel: row.supplierName,
      qty: row.qty,
      fatPct: row.fatPct,
      pricePerLiter: row.pricePerLiter,
      stimulation: row.stimulation,
      totalAmount: row.totalAmount,
    })),
  };
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { supplierByName } = loadSuppliers(args.suppliers);
  const parsedRows = parseWorkbook(args.xlsx);
  const { resolved, unresolved, skipped } = resolveRows(parsedRows, supplierByName);

  const sql = args.mode === 'fixed-ids' ? buildFixedIdSql(resolved) : buildSql(resolved);
  const preview = buildPreview(parsedRows, resolved, skipped, unresolved);

  ensureParentDir(args.sql);
  ensureParentDir(args.json);
  fs.writeFileSync(args.sql, sql, 'utf8');
  fs.writeFileSync(args.json, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');

  console.log(`Generated ${resolved.length} upsert rows.`);
  console.log(`Skipped ${skipped.length} rows with missing or zero quantity.`);
  if (unresolved.length > 0) {
    const missingNames = [...new Set(unresolved.map((row) => row.supplierName))].sort();
    console.log(`Unresolved supplier names: ${missingNames.join(', ')}`);
  }
  console.log(`SQL: ${args.sql}`);
  console.log(`Preview: ${args.json}`);
}

main();
