import { DonneurOrdre, OperationVirement } from '../types/afb160';

export function parseAFB160Text(text: string): {
  donneur: DonneurOrdre | null;
  operations: OperationVirement[];
  errors: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  const errors: string[] = [];
  let donneur: DonneurOrdre | null = null;
  const operations: OperationVirement[] = [];

  let opIndex = 1;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    if (rawLine.length < 156) {
      // Allow slightly trimmed end spaces
      errors.push(`Ligne ${idx + 1}: longueur anormale (${rawLine.length} caractères au lieu de 160)`);
    }

    const line = rawLine.padEnd(160, ' ');
    const codeEnreg = line.slice(0, 2);

    if (codeEnreg === '03' && !donneur) {
      // Header record
      const dateJJ = line.slice(24, 26);
      const dateMM = line.slice(26, 28);
      const dateAA = line.slice(28, 30);
      const dateFormatted = `20${dateAA}-${dateMM}-${dateJJ}`;

      const nom = line.slice(30, 54).trim();
      const guichet = line.slice(86, 91).trim();
      const compte = line.slice(91, 102).trim();
      const libelle = line.slice(118, 149).trim();
      const banque = line.slice(149, 154).trim();
      const cle = line.slice(154, 156).trim();
      const ref = line.slice(12, 24).trim();

      donneur = {
        nom: nom || 'DONNEUR D ORDRE',
        banque: banque || '00001',
        guichet: guichet || '00001',
        compte: compte || '00000000000',
        cle: cle || '00',
        dateExecution: dateFormatted,
        libelle: libelle || 'VIREMENT AFB160',
        referenceEmetteur: ref || '000000000000',
      };
    } else if (codeEnreg === '06') {
      // Detail record
      const rawNom = line.slice(30, 54).trim();
      const guichet = line.slice(86, 91).trim();
      const compte = line.slice(91, 102).trim();
      const rawMontant = line.slice(102, 118).trim();
      const montant = (parseInt(rawMontant, 10) || 0) / 100;
      const libelle = line.slice(118, 149).trim();
      const banque = line.slice(149, 154).trim();
      const cle = line.slice(154, 156).trim();

      // Check if nom starts with 5 or 6 digit rang
      let rang = String(opIndex).padStart(6, '0');
      let nom = rawNom;
      const rangMatch = rawNom.match(/^(\d{5,6})\s+(.+)$/);
      if (rangMatch) {
        rang = rangMatch[1];
        nom = rangMatch[2];
      }

      operations.push({
        id: `op-${Date.now()}-${opIndex}-${Math.random().toString(36).substring(2, 6)}`,
        rang,
        banque,
        guichet,
        compte,
        cle,
        nom,
        libelle,
        montant,
      });

      opIndex++;
    }
  }

  if (!donneur && operations.length > 0) {
    errors.push("Aucun enregistrement d'en-tête (code 03) trouvé.");
  }

  return { donneur, operations, errors };
}
