const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const wb = xlsx.readFile(path.join(__dirname, '..', 'GASSTOS.xls'));
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

const raw = [];
for (let i = 9; i < data.length; i++) {
  const row = data[i];
  if (!row[0] || !row[1]) continue;
  const rawDate = String(row[0]).trim();
  const rawConcept = String(row[1]).trim();
  const amtEuros = Number(row[3]);
  const saldoEuros = Number(row[4]);
  const ref1 = row[5] ? String(row[5]).trim() : '';
  const ref2 = row[6] ? String(row[6]).trim() : '';
  const [d, m, y] = rawDate.split('/').map(Number);
  const isoDate = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');

  raw.push({
    rawDate,
    isoDate,
    day: d,
    month: m,
    year: y,
    rawConcept,
    amountEuros: amtEuros,
    amountCents: Math.round(Math.abs(amtEuros) * 100),
    saldoEuros,
    saldoCents: Math.round(saldoEuros * 100),
    ref1,
    ref2,
    bank: 'Banc Sabadell'
  });
}

// Same-day exact offsetting transactions
const excludedIndices = new Set();
for (let i = 0; i < raw.length; i++) {
  if (excludedIndices.has(i)) continue;
  const a = raw[i];
  if (a.amountEuros < 0) {
    for (let j = 0; j < raw.length; j++) {
      if (i === j || excludedIndices.has(j)) continue;
      const b = raw[j];
      if (b.amountEuros > 0 && Math.abs(a.amountEuros + b.amountEuros) < 0.01 && a.rawDate === b.rawDate) {
        excludedIndices.add(i);
        excludedIndices.add(j);
        break;
      }
    }
  }
}

// Known non-same-day offsets (Escapes Sergio and emergency fund transfers)
for (let i = 0; i < raw.length; i++) {
  if (/ESCAPES SERGIO/i.test(raw[i].rawConcept)) excludedIndices.add(i);
  if (/TRANSFERENCIA A Oriol Vidal Gonzalez/i.test(raw[i].rawConcept)) excludedIndices.add(i);
}

const gasRegex = /ESCLATOIL|FAMILY ENERGY|REPSOL|CEPSA|GALP|BALLENOIL|PLENOIL|BONAREA|PETRONOR/i;

const outputMovements = [];

// A. Process months 1 to 9 from GASSTOS.xls
for (let i = 0; i < raw.length; i++) {
  if (excludedIndices.has(i)) continue;
  const item = raw[i];
  if (item.month === 10) continue; // Month 10 is handled with Uri's manual verified data

  if (item.amountEuros > 0) {
    let concept = 'EXTRES';
    let incomeType = 'other';
    if (/NOMINA ASIMETRICS/i.test(item.rawConcept)) {
      concept = 'NÒMINA';
      incomeType = 'salary';
    }
    outputMovements.push({
      rawDate: item.rawDate,
      isoDate: item.isoDate,
      month: item.month,
      year: item.year,
      rawConcept: item.rawConcept,
      amountEuros: item.amountEuros,
      amountCents: item.amountCents,
      saldoEuros: item.saldoEuros,
      saldoCents: item.saldoCents,
      ref1: item.ref1,
      ref2: item.ref2,
      bank: 'Banc Sabadell',
      type: 'income',
      concept,
      incomeType
    });
  } else {
    let category = 'GASTOS GENERALES';
    let section = 'fixed';

    if (/GEMINIS STYLE/i.test(item.rawConcept)) {
      category = 'CORTE DE PELO';
      section = 'fixed';
    } else if (/AUTOESCOLA GINER/i.test(item.rawConcept)) {
      category = 'REV./REPARACIONS MOTO';
      section = 'fixed';
      item.rawConcept = 'Carnet A2 moto (Autoescola Giner)';
    } else if (/GESTORIA TRAFIC/i.test(item.rawConcept)) {
      category = 'REV./REPARACIONS MOTO';
      section = 'fixed';
      item.rawConcept = 'Cambio de nombre moto nueva (Gestoria Trafic)';
    } else if (gasRegex.test(item.rawConcept)) {
      if (Math.abs(item.amountEuros) > 20) {
        category = 'BENZINA COTXE';
      } else {
        category = 'BENZINA MOTO';
      }
      section = 'fixed';
    } else if (/Simyo/i.test(item.rawConcept)) {
      category = 'OTROS';
      section = 'fixed';
    }

    outputMovements.push({
      rawDate: item.rawDate,
      isoDate: item.isoDate,
      month: item.month,
      year: item.year,
      rawConcept: item.rawConcept,
      amountEuros: item.amountEuros,
      amountCents: item.amountCents,
      saldoEuros: item.saldoEuros,
      saldoCents: item.saldoCents,
      ref1: item.ref1,
      ref2: item.ref2,
      bank: 'Banc Sabadell',
      type: 'expense',
      section,
      category
    });
  }
}

// B. Emergency Fund contributions (savings in Jul, Aug, Sep)
outputMovements.push({
  rawDate: '28/07/2026',
  isoDate: '2026-07-28',
  month: 7,
  year: 2026,
  rawConcept: 'Cuenta de emergencia (Ahorro Julio)',
  amountEuros: -514,
  amountCents: 51400,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Revolut / Fondo Emergencia',
  type: 'expense',
  section: 'savings',
  category: 'FONS EMERGENCIA'
});

outputMovements.push({
  rawDate: '31/08/2026',
  isoDate: '2026-08-31',
  month: 8,
  year: 2026,
  rawConcept: 'Cuenta de emergencia (Ahorro Agosto)',
  amountEuros: -867,
  amountCents: 86700,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Revolut / Fondo Emergencia',
  type: 'expense',
  section: 'savings',
  category: 'FONS EMERGENCIA'
});

outputMovements.push({
  rawDate: '28/09/2026',
  isoDate: '2026-09-28',
  month: 9,
  year: 2026,
  rawConcept: 'Cuenta de emergencia (Ahorro Septiembre)',
  amountEuros: -587,
  amountCents: 58700,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Revolut / Fondo Emergencia',
  type: 'expense',
  section: 'savings',
  category: 'FONS EMERGENCIA'
});

// C. Month 10 (Octubre 2026) exactly matching Uri's manual Excel verified data
// Income: Nòmina 723,98 €
outputMovements.push({
  rawDate: '27/10/2026',
  isoDate: '2026-10-27',
  month: 10,
  year: 2026,
  rawConcept: 'NOMINA ASIMETRICS INTELLIGENTIA',
  amountEuros: 723.98,
  amountCents: 72398,
  saldoEuros: 1001.32,
  saldoCents: 100132,
  bank: 'Banc Sabadell',
  type: 'income',
  concept: 'NÒMINA',
  incomeType: 'salary'
});

// Fijos: Gym 49,95 €, Corte de pelo 13,00 €, Otros 12,00 €, Gasolina moto 13,41 €
outputMovements.push({
  rawDate: '05/10/2026',
  isoDate: '2026-10-05',
  month: 10,
  year: 2026,
  rawConcept: 'ADEUDO RECIBO XP - Energie Fitness VV',
  amountEuros: -49.95,
  amountCents: 4995,
  saldoEuros: 534.65,
  saldoCents: 53465,
  bank: 'Banc Sabadell',
  type: 'expense',
  section: 'fixed',
  category: 'GYM - FIJO'
});

outputMovements.push({
  rawDate: '15/10/2026',
  isoDate: '2026-10-15',
  month: 10,
  year: 2026,
  rawConcept: 'COMPRA GEMINIS STYLE-BARCELONA',
  amountEuros: -13,
  amountCents: 1300,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Banc Sabadell',
  type: 'expense',
  section: 'fixed',
  category: 'CORTE DE PELO'
});

outputMovements.push({
  rawDate: '09/10/2026',
  isoDate: '2026-10-09',
  month: 10,
  year: 2026,
  rawConcept: 'TELEFONOS Simyo Simyo y otros fijos',
  amountEuros: -12,
  amountCents: 1200,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Banc Sabadell',
  type: 'expense',
  section: 'fixed',
  category: 'OTROS'
});

outputMovements.push({
  rawDate: '06/10/2026',
  isoDate: '2026-10-06',
  month: 10,
  year: 2026,
  rawConcept: 'BENZINA MOTO',
  amountEuros: -13.41,
  amountCents: 1341,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Banc Sabadell',
  type: 'expense',
  section: 'fixed',
  category: 'BENZINA MOTO'
});

// Ocio: Comidas 18,58 €, Regalos 30,27 €, Piezas moto 200,08 €, Hot Wheels 75,60 €
outputMovements.push({
  rawDate: '20/10/2026',
  isoDate: '2026-10-20',
  month: 10,
  year: 2026,
  rawConcept: 'Comidas y cenas (Sushi & comidas)',
  amountEuros: -18.58,
  amountCents: 1858,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Banc Sabadell',
  type: 'expense',
  section: 'leisure',
  category: 'COMIDAS'
});

outputMovements.push({
  rawDate: '18/10/2026',
  isoDate: '2026-10-18',
  month: 10,
  year: 2026,
  rawConcept: 'Regalos Octubre',
  amountEuros: -30.27,
  amountCents: 3027,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Banc Sabadell',
  type: 'expense',
  section: 'leisure',
  category: 'REGALOS'
});

outputMovements.push({
  rawDate: '12/10/2026',
  isoDate: '2026-10-12',
  month: 10,
  year: 2026,
  rawConcept: 'Piezas moto Octubre',
  amountEuros: -200.08,
  amountCents: 20008,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Banc Sabadell',
  type: 'expense',
  section: 'leisure',
  category: 'PIEZAS MOTO'
});

outputMovements.push({
  rawDate: '08/10/2026',
  isoDate: '2026-10-08',
  month: 10,
  year: 2026,
  rawConcept: 'Hot Wheels colección Octubre',
  amountEuros: -75.60,
  amountCents: 7560,
  saldoEuros: 0,
  saldoCents: 0,
  bank: 'Banc Sabadell',
  type: 'expense',
  section: 'leisure',
  category: 'HOT WHEELS'
});

console.log('Total output movements generated:', outputMovements.length);

const tsHeader = `// Auto-generated from GASSTOS.xls bank statement and verified user rules
// Account: ES75 0081 1633 4900 0617 8029 (Banc Sabadell)
// Period: 01/01/2026 - 27/10/2026
// Verified manual rules:
// - October exactly as Uri created manually (Nòmina 723,98€, Gym 49,95€, etc.)
// - Months 1-9: 100% known categories (Peluqueria 13€, Carnet A2 320€, Cambio nombre moto 230€, Gasolina moto <=20€, Gasolina coche >20€)
// - Months 1-9 generic expenses categorized under fixed 'GASTOS GENERALES'
// - Emergency fund contributions in Jul (514€), Aug (867€), Sep (587€) totalling 2.558,77€ in emergency account
// - Same-day Bizum reimbursements / refunds offsetted

import type { BudgetSection, IncomeType } from '@/types';

export interface BankMovementItem {
  rawDate: string;
  isoDate: string;
  month: number;
  year: number;
  rawConcept: string;
  amountEuros: number;
  amountCents: number;
  saldoEuros: number;
  saldoCents: number;
  ref1?: string;
  ref2?: string;
  bank: string;
  type: 'income' | 'expense';
  concept?: string; // For income: 'NÒMINA' | 'EXTRES'
  incomeType?: IncomeType;
  section?: BudgetSection; // For expense: 'fixed' | 'leisure' | 'savings'
  category?: string; // For expense: 'GYM - FIJO', 'COMIDAS', etc.
}

export const GASSTOS_BANK_MOVEMENTS: BankMovementItem[] = `;

const targetPath = path.join(__dirname, '..', 'src', 'data', 'gasstos2026.ts');
const tsContent = tsHeader + JSON.stringify(outputMovements, null, 2) + ';\n';
fs.writeFileSync(targetPath, tsContent, 'utf8');
console.log('src/data/gasstos2026.ts updated successfully with', outputMovements.length, 'movements.');
