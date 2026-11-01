import * as XLSX from 'xlsx';
import { DonneurOrdre, OperationVirement } from '../types/afb160';
import { parseRibString } from './ribValidator';

export interface ExcelImportResult {
  detectedDonneur: Partial<DonneurOrdre> | null;
  operations: OperationVirement[];
  totalRows: number;
  warnings: string[];
}

/**
 * Parses an Excel file (.xlsx, .xls, .csv).
 */
export async function parseExcelFile(file: File): Promise<ExcelImportResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array of rows
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  const warnings: string[] = [];
  const operations: OperationVirement[] = [];
  let detectedDonneur: Partial<DonneurOrdre> | null = null;

  if (rawRows.length === 0) {
    warnings.push('Le fichier Excel est vide.');
    return { detectedDonneur: null, operations: [], totalRows: 0, warnings };
  }

  // Check if first row is a header row with column names
  const firstRowStr = rawRows[0].map((cell) => String(cell || '').toLowerCase().trim());
  const isHeaderRow =
    firstRowStr.some((c) => c.includes('rib') || c.includes('banque') || c.includes('nom') || c.includes('montant') || c.includes('compte'));

  let startIndex = 0;
  let colIndex = {
    rib: -1,
    banque: -1,
    guichet: -1,
    compte: -1,
    cle: -1,
    montant: -1,
    rang: -1,
    nom: -1,
    libelle: -1,
  };

  if (isHeaderRow) {
    startIndex = 1;
    firstRowStr.forEach((header, idx) => {
      if (header.includes('rib')) colIndex.rib = idx;
      else if (header.includes('banque')) colIndex.banque = idx;
      else if (header.includes('guichet')) colIndex.guichet = idx;
      else if (header.includes('compte')) colIndex.compte = idx;
      else if (header.includes('cle') || header.includes('clé')) colIndex.cle = idx;
      else if (header.includes('montant')) colIndex.montant = idx;
      else if (header.includes('rang')) colIndex.rang = idx;
      else if (header.includes('nom') || header.includes('beneficiaire') || header.includes('bénéficiaire')) colIndex.nom = idx;
      else if (header.includes('libell') || header.includes('motif')) colIndex.libelle = idx;
    });
  } else {
    // Check if format is like Screenshot 4:
    // Col A: RIB (23 chars)
    // Col B: Montant (number or 12/16 digits centimes)
    // Col C: Rang (e.g. V00000, 000001, etc.)
    // Col D: Nom or Libellé
    colIndex.rib = 0;
    colIndex.montant = 1;
    colIndex.rang = 2;
    colIndex.nom = 3;

    // Check row 0: if Col C is "V00000" or Col B is 0, it's the Donneur d'Ordre!
    const row0 = rawRows[0];
    const row0A = String(row0[0] || '').replace(/[^a-zA-Z0-9]/g, '');
    const row0B = Number(String(row0[1] || '0').replace(/[^0-9.]/g, ''));
    const row0C = String(row0[2] || '').trim().toUpperCase();

    if (row0A.length === 23 && (row0C.includes('V000') || row0B === 0 || row0C === '0' || row0C === '')) {
      const parsedDonneurRib = parseRibString(row0A);
      detectedDonneur = {
        banque: parsedDonneurRib.banque,
        guichet: parsedDonneurRib.guichet,
        compte: parsedDonneurRib.compte,
        cle: parsedDonneurRib.cle,
        libelle: String(row0[3] || '').trim(),
      };
      startIndex = 1;
    }
  }

  // Iterate rows
  let autoRang = 1;
  for (let i = startIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every((c) => c === '' || c === undefined)) {
      continue;
    }

    let banque = '';
    let guichet = '';
    let compte = '';
    let cle = '';

    if (colIndex.rib >= 0 && row[colIndex.rib]) {
      const parsed = parseRibString(String(row[colIndex.rib]));
      banque = parsed.banque;
      guichet = parsed.guichet;
      compte = parsed.compte;
      cle = parsed.cle;
    } else {
      if (colIndex.banque >= 0) banque = String(row[colIndex.banque] || '').trim();
      if (colIndex.guichet >= 0) guichet = String(row[colIndex.guichet] || '').trim();
      if (colIndex.compte >= 0) compte = String(row[colIndex.compte] || '').trim();
      if (colIndex.cle >= 0) cle = String(row[colIndex.cle] || '').trim();
    }

    // Extract amount
    let montant = 0;
    if (colIndex.montant >= 0 && row[colIndex.montant] !== undefined) {
      const rawM = String(row[colIndex.montant]).trim().replace(/\s/g, '').replace(',', '.');
      const num = parseFloat(rawM);
      if (!isNaN(num)) {
        // If amount has no decimal point and is very large (e.g. 000096450000 from screenshot 4),
        // check if it represents centimes: 000096450000 -> 964500.00
        if (rawM.length >= 8 && !rawM.includes('.') && num >= 10000000) {
          montant = num / 100;
        } else {
          montant = num;
        }
      }
    }

    // Extract rang
    let rang = '';
    if (colIndex.rang >= 0 && row[colIndex.rang]) {
      rang = String(row[colIndex.rang]).trim();
    } else {
      rang = String(autoRang).padStart(6, '0');
    }

    // Extract nom
    let nom = '';
    if (colIndex.nom >= 0 && row[colIndex.nom]) {
      nom = String(row[colIndex.nom]).trim();
    } else {
      nom = `BENEFICIAIRE ${autoRang}`;
    }

    // Extract libelle
    let libelle = '';
    if (colIndex.libelle >= 0 && row[colIndex.libelle]) {
      libelle = String(row[colIndex.libelle]).trim();
    } else if (detectedDonneur?.libelle) {
      libelle = detectedDonneur.libelle;
    }

    if (!banque && !compte && montant === 0) {
      continue; // skip blank-like rows
    }

    operations.push({
      id: `xl-${Date.now()}-${autoRang}-${Math.random().toString(36).substring(2, 6)}`,
      rang: rang.padStart(6, '0'),
      banque: banque.padStart(5, '0').slice(-5),
      guichet: guichet.padStart(5, '0').slice(-5),
      compte: compte.padStart(11, '0').slice(-11),
      cle: cle.padStart(2, '0').slice(-2),
      nom,
      libelle,
      montant,
    });

    autoRang++;
  }

  if (operations.length === 0) {
    warnings.push('Aucune opération valide trouvée dans la feuille Excel.');
  }

  return {
    detectedDonneur,
    operations,
    totalRows: operations.length,
    warnings,
  };
}

/**
 * Downloads a sample Excel template matching the AFB160 structure.
 */
export function downloadExcelTemplate(donneur?: DonneurOrdre) {
  const wsData = [
    // Header format with Donneur d'ordre on row 1 (compatible with Screenshot 4)
    [
      donneur ? `${donneur.banque}${donneur.guichet}${donneur.compte}${donneur.cle}` : '00005000205652995010015',
      '0',
      'V00000',
      donneur?.libelle || 'SALAIRE MOIS DE SEPTEMBRE 2026',
    ],
    ['00008014900500145453342', 964500, '000001', 'OLIVIER ROLLAND'],
    ['00005000207139528000196', 915800, '000002', 'BOTOTSARA ORLANDO'],
    ['00005000207278050000131', 786400, '000003', 'RASOLONIRINA GERMAIN'],
    ['00005000207139805000186', 969800, '000004', 'EVAROTA MARORAZANA ROLLAND'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Virements_AFB160');

  // Trigger download
  XLSX.writeFile(wb, 'modele_virements_afb160.xlsx');
}

/**
 * Exports current operations list to Excel.
 */
export function exportOperationsToExcel(donneur: DonneurOrdre, operations: OperationVirement[]) {
  const wsData: any[][] = [
    ['RIB_Complet', 'Montant_MGA', 'Rang', 'Nom_Beneficiaire', 'Libelle_Operation', 'Banque', 'Guichet', 'Compte', 'Cle'],
  ];

  operations.forEach((op) => {
    const fullRib = `${op.banque}${op.guichet}${op.compte}${op.cle}`;
    wsData.push([
      fullRib,
      op.montant,
      op.rang,
      op.nom,
      op.libelle || donneur.libelle || '',
      op.banque,
      op.guichet,
      op.compte,
      op.cle,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Virements');

  const fileName = `virements_${donneur.nom.replace(/\s+/g, '_') || 'afb160'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
