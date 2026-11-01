/**
 * Utility functions for RIB (Relevé d'Identité Bancaire) validation and formatting.
 * Standard format:
 * - Code Banque: 5 chiffres
 * - Code Guichet: 5 chiffres
 * - Numéro de Compte: 11 caractères alphanumériques
 * - Clé RIB: 2 chiffres
 */

// Mapping of letters to numbers according to standard French/Malagasy bank rules
const LETTER_MAP: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

export function convertAccountToDigits(account: string): string {
  return account
    .toUpperCase()
    .split('')
    .map((char) => {
      if (char >= '0' && char <= '9') return char;
      if (LETTER_MAP[char] !== undefined) return LETTER_MAP[char].toString();
      return '0';
    })
    .join('');
}

/**
 * Calculates standard RIB key: 97 - ((89*B + 15*G + 3*C) % 97)
 */
export function calculateRibKey(banque: string, guichet: string, compte: string): string {
  const b = banque.padStart(5, '0').slice(-5);
  const g = guichet.padStart(5, '0').slice(-5);
  const c = convertAccountToDigits(compte.padStart(11, '0').slice(-11));

  try {
    const bNum = BigInt(b);
    const gNum = BigInt(g);
    const cNum = BigInt(c);
    const mod = (89n * bNum + 15n * gNum + 3n * cNum) % 97n;
    const key = 97n - mod;
    return key.toString().padStart(2, '0');
  } catch {
    return '00';
  }
}

export function validateRib(banque: string, guichet: string, compte: string, cle: string): boolean {
  if (!banque || !guichet || !compte || !cle) return false;
  if (banque.length !== 5 || guichet.length !== 5 || compte.length !== 11 || cle.length !== 2) {
    return false;
  }
  const expectedKey = calculateRibKey(banque, guichet, compte);
  return expectedKey === cle.padStart(2, '0');
}

/**
 * Parses raw RIB string (with or without dashes) into its components:
 * Example: "00008014900500145453342" or "00008-01490-05001454533-42"
 */
export function parseRibString(raw: string): {
  banque: string;
  guichet: string;
  compte: string;
  cle: string;
  isValid: boolean;
} {
  const cleaned = (raw || '').replace(/[^a-zA-Z0-9]/g, '');
  if (cleaned.length === 23) {
    const banque = cleaned.slice(0, 5);
    const guichet = cleaned.slice(5, 10);
    const compte = cleaned.slice(10, 21);
    const cle = cleaned.slice(21, 23);
    return {
      banque,
      guichet,
      compte,
      cle,
      isValid: true,
    };
  }
  return {
    banque: '',
    guichet: '',
    compte: '',
    cle: '',
    isValid: false,
  };
}

export function formatRib(banque: string, guichet: string, compte: string, cle: string): string {
  const b = (banque || '').padStart(5, '0').slice(-5);
  const g = (guichet || '').padStart(5, '0').slice(-5);
  const c = (compte || '').padStart(11, '0').slice(-11);
  const k = (cle || '').padStart(2, '0').slice(-2);
  return `${b}-${g}-${c}-${k}`;
}
