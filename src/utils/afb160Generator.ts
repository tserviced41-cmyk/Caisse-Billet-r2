import { DonneurOrdre, OperationVirement } from '../types/afb160';

/**
 * Normalizes text to uppercase ASCII, removing accents and non-permitted characters.
 */
export function sanitizeAscii(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9\s.,'/-]/g, ' ')
    .toUpperCase();
}

/**
 * Formats a string to a fixed length, left-aligned, padded with spaces on the right.
 */
export function padRight(str: string, length: number): string {
  const sanitized = sanitizeAscii(str || '');
  if (sanitized.length >= length) {
    return sanitized.slice(0, length);
  }
  return sanitized.padEnd(length, ' ');
}

/**
 * Formats a number or string to a fixed length, right-aligned, padded with zeros on the left.
 */
export function padZeroLeft(value: string | number, length: number): string {
  const str = String(value || '0').replace(/[^0-9]/g, '');
  if (str.length >= length) {
    return str.slice(-length);
  }
  return str.padStart(length, '0');
}

/**
 * Converts a monetary amount to 16 digits in centimes (2 decimal places).
 * e.g., 964500 -> 964500.00 -> 96450000 -> "0000000096450000"
 */
export function formatAmountCentimes(amount: number): string {
  const rounded = Math.round((Number(amount) || 0) * 100);
  return padZeroLeft(rounded, 16);
}

/**
 * Converts a date (YYYY-MM-DD or DD/MM/YYYY or JJMMAA) into 6-digit JJMMAA.
 */
export function formatDateJJMMAA(dateInput: string): string {
  if (!dateInput) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
  }

  // Already 6 digits JJMMAA
  const digitsOnly = dateInput.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 6) {
    return digitsOnly;
  }

  // YYYY-MM-DD
  if (dateInput.includes('-')) {
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      const year = parts[0].slice(-2);
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${day}${month}${year}`;
    }
  }

  // DD/MM/YYYY
  if (dateInput.includes('/')) {
    const parts = dateInput.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].slice(-2);
      return `${day}${month}${year}`;
    }
  }

  return '250926';
}

/**
 * Builds Line 03 (Donneur d'ordre / Header)
 */
export function generateHeaderLine(donneur: DonneurOrdre, totalAmount: number): string {
  const dateStr = formatDateJJMMAA(donneur.dateExecution);
  const ref = padZeroLeft(donneur.referenceEmetteur || '0', 12);
  const nomDonneur = padRight(donneur.nom, 24);
  const guichet = padZeroLeft(donneur.guichet, 5);
  const compte = padRight(donneur.compte, 11);
  const totalCents = formatAmountCentimes(totalAmount);
  const libelleDonneur = padRight(donneur.libelle || donneur.nom, 31);
  const banque = padZeroLeft(donneur.banque, 5);
  const cle = padZeroLeft(donneur.cle, 2);

  // Exact 160-char layout:
  // 0..2:   "03"
  // 2..4:   "02"
  // 4..12:  "        " (8 spaces)
  // 12..24: ref (12 digits)
  // 24..30: dateStr (6 digits JJMMAA)
  // 30..54: nomDonneur (24 chars)
  // 54..78: "                        " (24 spaces)
  // 78..86: "        " (8 spaces)
  // 86..91: guichet (5 digits)
  // 91..102: compte (11 chars)
  // 102..118: totalCents (16 digits)
  // 118..149: libelleDonneur (31 chars)
  // 149..154: banque (5 digits)
  // 154..156: cle (2 digits)
  // 156..160: "    " (4 spaces)

  const line =
    '0302' +
    ' '.repeat(8) +
    ref +
    dateStr +
    nomDonneur +
    ' '.repeat(24) +
    ' '.repeat(8) +
    guichet +
    compte +
    totalCents +
    libelleDonneur +
    banque +
    cle +
    ' '.repeat(4);

  return line;
}

/**
 * Builds Line 06 (Détail virement bénéficiaire)
 */
export function generateDetailLine(
  op: OperationVirement,
  dateStr: string,
  defaultLibelle?: string
): string {
  const ref = '000000000000';
  // Nom format: if user hasn't prepended rang, we check if rang should be included or kept as is
  // In the user's sample: "000001 OLIVIER ROLLAND  " or "000230 RAVAVASON HUNDI"
  let nomStr = op.nom.trim();
  if (op.rang && !nomStr.startsWith(op.rang)) {
    // If name doesn't start with rang, prepend it with a space if fits or keep standard format
    // Notice screenshot 2 has "000230 RAVAVASON HUNDI"
    const candidate = `${op.rang} ${nomStr}`;
    nomStr = candidate.length <= 24 ? candidate : nomStr;
  }
  const nomBeneficiaire = padRight(nomStr, 24);

  const guichet = padZeroLeft(op.guichet, 5);
  const compte = padRight(op.compte, 11);
  const montantCents = formatAmountCentimes(op.montant);
  const libelleOp = padRight(op.libelle || defaultLibelle || '', 31);
  const banque = padZeroLeft(op.banque, 5);
  const cle = padZeroLeft(op.cle, 2);

  const line =
    '0602' +
    ' '.repeat(8) +
    ref +
    dateStr +
    nomBeneficiaire +
    ' '.repeat(24) +
    ' '.repeat(8) +
    guichet +
    compte +
    montantCents +
    libelleOp +
    banque +
    cle +
    ' '.repeat(4);

  return line;
}

/**
 * Builds Line 08 (Totalisateur / Fin de remise)
 */
export function generateFooterLine(donneur: DonneurOrdre, totalAmount: number): string {
  const header = generateHeaderLine(donneur, totalAmount);
  // Replaces "03" at start with "08"
  return '08' + header.slice(2);
}

/**
 * Generates the full AFB160 string with CRLF line endings.
 */
export function generateAFB160Content(
  donneur: DonneurOrdre,
  operations: OperationVirement[]
): {
  content: string;
  totalAmount: number;
  lineCount: number;
  lines: string[];
} {
  const totalAmount = operations.reduce((sum, op) => sum + (Number(op.montant) || 0), 0);
  const dateStr = formatDateJJMMAA(donneur.dateExecution);

  const lines: string[] = [];

  // Line 03
  lines.push(generateHeaderLine(donneur, totalAmount));

  // Lines 06
  operations.forEach((op) => {
    lines.push(generateDetailLine(op, dateStr, donneur.libelle));
  });

  // Line 08
  lines.push(generateFooterLine(donneur, totalAmount));

  // Use standard Windows/banking CRLF line endings
  const content = lines.join('\r\n') + '\r\n';

  return {
    content,
    totalAmount,
    lineCount: lines.length,
    lines,
  };
}
