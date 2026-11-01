import * as XLSX from 'xlsx';
import { TicketItem } from '../types/caisse';
import { isNonAttribueText } from '../components/BilletsExcelImportModal';

export type TicketExportFilter =
  | 'tous'
  | 'paye'
  | 'impaye'
  | 'attribue'
  | 'non_attribue'
  | 'selection'
  | 'filtre';

export interface TicketExportOptions {
  filterStatut?: TicketExportFilter;
  filterCampagne?: string;
  filterGroupe?: string;
  selectedTicketIds?: string[];
  customTitle?: string;
}

export function isTicketAttribue(t: TicketItem): boolean {
  return Boolean(t.beneficiaire && t.beneficiaire.trim() !== '' && !isNonAttribueText(t.beneficiaire));
}

export function filterTicketsForExport(
  tickets: TicketItem[],
  options: TicketExportOptions
): TicketItem[] {
  let list = [...tickets];

  // Campaign filter
  if (options.filterCampagne && options.filterCampagne !== 'Tous') {
    list = list.filter((t) => t.campagne === options.filterCampagne);
  }

  // Groupe filter
  if (options.filterGroupe && options.filterGroupe !== 'Tous') {
    list = list.filter((t) => t.groupe === options.filterGroupe);
  }

  // Selection filter
  if (options.filterStatut === 'selection' && options.selectedTicketIds) {
    const selectedSet = new Set(options.selectedTicketIds);
    list = list.filter((t) => selectedSet.has(t.id));
    return list;
  }

  // Status filter
  if (options.filterStatut === 'paye') {
    list = list.filter((t) => t.paye);
  } else if (options.filterStatut === 'impaye') {
    list = list.filter((t) => !t.paye);
  } else if (options.filterStatut === 'attribue') {
    list = list.filter(isTicketAttribue);
  } else if (options.filterStatut === 'non_attribue') {
    list = list.filter((t) => !isTicketAttribue(t));
  }

  return list;
}

export function getExportFilterLabel(filter?: TicketExportFilter): string {
  switch (filter) {
    case 'paye':
      return 'Vendus / Payés uniquement';
    case 'impaye':
      return 'Non vendus / Impayés uniquement';
    case 'attribue':
      return 'Distribués / Attribués uniquement';
    case 'non_attribue':
      return 'Non distribués / Non attribués uniquement';
    case 'selection':
      return 'Billets sélectionnés uniquement';
    default:
      return 'Tous les billets';
  }
}

export function exportTicketsToExcel(
  tickets: TicketItem[],
  options: TicketExportOptions = {}
): void {
  const targetTickets = options.filterStatut
    ? filterTicketsForExport(tickets, options)
    : tickets;

  const workbook = XLSX.utils.book_new();

  // 1. Detailed tickets sheet
  const sheetBilletsData = targetTickets.map((t) => {
    const isAttr = isTicketAttribue(t);
    return {
      'N° Billet': `#${String(t.numero).padStart(4, '0')}`,
      'Numéro Brut': t.numero,
      'Campagne': t.campagne,
      'Session': t.session || '—',
      'Prix (Ar)': t.prix,
      'Groupe': t.groupe || '—',
      'Bénéficiaire / Acheteur': isAttr ? t.beneficiaire : 'Non attribué',
      'Téléphone': isAttr ? (t.telephone || '—') : '—',
      'Statut Vente (Paiement)': t.paye ? 'Vendu (Payé)' : 'Non vendu (Impayé)',
      'Statut Distribution': isAttr ? 'Distribué' : 'Non distribué',
      "Date d'attribution": t.dateAttribution || '—',
    };
  });

  const wsBillets = XLSX.utils.json_to_sheet(sheetBilletsData);
  XLSX.utils.book_append_sheet(workbook, wsBillets, 'Détail Billets');

  // 2. Summary by Person
  const personsMap = new Map<
    string,
    {
      name: string;
      groupe: string;
      telephone: string;
      totalBillets: number;
      payes: number;
      impayes: number;
      totalDu: number;
      totalPaye: number;
    }
  >();

  targetTickets.forEach((t) => {
    const isAttr = isTicketAttribue(t);
    const name = isAttr ? t.beneficiaire.trim() : 'Non attribué';
    const key = name.toLowerCase();

    if (!personsMap.has(key)) {
      personsMap.set(key, {
        name,
        groupe: isAttr ? (t.groupe || '—') : '—',
        telephone: isAttr ? (t.telephone || '—') : '—',
        totalBillets: 0,
        payes: 0,
        impayes: 0,
        totalDu: 0,
        totalPaye: 0,
      });
    }

    const p = personsMap.get(key)!;
    p.totalBillets += 1;
    if (isAttr) p.totalDu += t.prix;
    if (t.paye) {
      p.payes += 1;
      p.totalPaye += t.prix;
    } else {
      p.impayes += 1;
    }
  });

  const sheetPersonnesData = Array.from(personsMap.values())
    .sort((a, b) => {
      if (a.name === 'Non attribué') return 1;
      if (b.name === 'Non attribué') return -1;
      return a.name.localeCompare(b.name, 'fr');
    })
    .map((p) => {
      const reste = p.totalDu - p.totalPaye;
      const taux = p.totalDu > 0 ? `${Math.round((p.totalPaye / p.totalDu) * 100)}%` : '0%';
      return {
        'Bénéficiaire / Acheteur': p.name,
        'Groupe': p.groupe,
        'Téléphone': p.telephone,
        'Nombre Total Billets': p.totalBillets,
        'Billets Payés': p.payes,
        'Billets Impayés': p.impayes,
        'Montant Total Dû (Ar)': p.totalDu,
        'Montant Encaissé (Ar)': p.totalPaye,
        'Reste à Payer (Ar)': reste,
        'Taux Paiement': taux,
      };
    });

  const wsPersonnes = XLSX.utils.json_to_sheet(sheetPersonnesData);
  XLSX.utils.book_append_sheet(workbook, wsPersonnes, 'Synthèse par Personne');

  // 3. Summary by Groupe
  const groupesMap = new Map<
    string,
    {
      groupe: string;
      totalBillets: number;
      attribues: number;
      nonDistribues: number;
      payes: number;
      impayes: number;
      totalAttendu: number;
      totalEncaisse: number;
    }
  >();

  targetTickets.forEach((t) => {
    const isAttr = isTicketAttribue(t);
    const gName = t.groupe || 'Indéfini';

    if (!groupesMap.has(gName)) {
      groupesMap.set(gName, {
        groupe: gName,
        totalBillets: 0,
        attribues: 0,
        nonDistribues: 0,
        payes: 0,
        impayes: 0,
        totalAttendu: 0,
        totalEncaisse: 0,
      });
    }

    const g = groupesMap.get(gName)!;
    g.totalBillets += 1;
    if (isAttr) {
      g.attribues += 1;
      g.totalAttendu += t.prix;
    } else {
      g.nonDistribues += 1;
    }
    if (t.paye) {
      g.payes += 1;
      g.totalEncaisse += t.prix;
    } else {
      g.impayes += 1;
    }
  });

  const sheetGroupesData = Array.from(groupesMap.values())
    .sort((a, b) => a.groupe.localeCompare(b.groupe, 'fr'))
    .map((g) => {
      const reste = g.totalAttendu - g.totalEncaisse;
      const taux = g.totalAttendu > 0 ? `${Math.round((g.totalEncaisse / g.totalAttendu) * 100)}%` : '0%';
      return {
        'Groupe': g.groupe,
        'Total Billets': g.totalBillets,
        'Billets Distribués': g.attribues,
        'Non Distribués': g.nonDistribues,
        'Billets Payés': g.payes,
        'Billets Impayés': g.impayes,
        'Montant Total Attendu (Ar)': g.totalAttendu,
        'Montant Encaissé (Ar)': g.totalEncaisse,
        'Reste à Recouvrer (Ar)': reste,
        'Taux Recouvrement': taux,
      };
    });

  const wsGroupes = XLSX.utils.json_to_sheet(sheetGroupesData);
  XLSX.utils.book_append_sheet(workbook, wsGroupes, 'Synthèse par Groupe');

  // 4. Global Balance Sheet
  const totalBilletsCount = targetTickets.length;
  const totalAttribues = targetTickets.filter(isTicketAttribue).length;
  const totalNonDistribues = totalBilletsCount - totalAttribues;
  const totalPayes = targetTickets.filter((t) => t.paye).length;
  const totalImpayes = totalBilletsCount - totalPayes;
  const totalMontantAttendu = targetTickets.reduce((sum, t) => sum + (isTicketAttribue(t) ? t.prix : 0), 0);
  const totalMontantEncaisse = targetTickets.filter((t) => t.paye).reduce((sum, t) => sum + t.prix, 0);
  const totalReste = totalMontantAttendu - totalMontantEncaisse;

  const sheetBilanData = [
    { 'Indicateur': 'Filtre appliqué', 'Valeur': getExportFilterLabel(options.filterStatut) },
    { 'Indicateur': 'Campagne', 'Valeur': options.filterCampagne || 'Toutes' },
    { 'Indicateur': 'Groupe', 'Valeur': options.filterGroupe || 'Tous' },
    { 'Indicateur': 'Date d\'exportation', 'Valeur': new Date().toLocaleString('fr-FR') },
    { 'Indicateur': 'Nombre de billets dans l\'export', 'Valeur': totalBilletsCount },
    { 'Indicateur': 'Billets distribués / attribués', 'Valeur': totalAttribues },
    { 'Indicateur': 'Billets non distribués', 'Valeur': totalNonDistribues },
    { 'Indicateur': 'Billets vendus / payés', 'Valeur': totalPayes },
    { 'Indicateur': 'Billets impayés / non payés', 'Valeur': totalImpayes },
    { 'Indicateur': 'Montant total attendu des ventes (Ar)', 'Valeur': totalMontantAttendu },
    { 'Indicateur': 'Total encaissé (Ar)', 'Valeur': totalMontantEncaisse },
    { 'Indicateur': 'Reste à recouvrer (Ar)', 'Valeur': totalReste },
    {
      'Indicateur': 'Taux global de recouvrement',
      'Valeur': `${totalMontantAttendu > 0 ? Math.round((totalMontantEncaisse / totalMontantAttendu) * 100) : 0}%`,
    },
  ];

  const wsBilan = XLSX.utils.json_to_sheet(sheetBilanData);
  XLSX.utils.book_append_sheet(workbook, wsBilan, 'Bilan Global');

  // File naming
  const filterSlug = options.filterStatut ? `_${options.filterStatut}` : '';
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `export_billets${filterSlug}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
