import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  FileText,
  Users,
  Layers,
  DollarSign,
  Ticket,
  CheckCircle2,
  Calendar,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TicketItem } from './BilletsView';
import { isNonAttribueText } from './BilletsExcelImportModal';

export type BilletsReportType = 'personnes' | 'groupes' | 'bilan' | 'liste';
export type ReportOrientation = 'portrait' | 'landscape';
export type ReportStatusFilter = 'tous' | 'paye' | 'impaye' | 'attribue' | 'non_attribue' | 'selection';

interface BilletsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: TicketItem[];
  initialReportType?: BilletsReportType;
  filterCampagne?: string;
  initialFilterStatut?: ReportStatusFilter;
  selectedTicketIds?: string[];
}

// Utility to format ticket numbers into clean ranges (e.g. #0300–0302, #0318, #0339–0346)
export const formatTicketRanges = (numbers: number[]): string => {
  if (!numbers || numbers.length === 0) return '—';
  const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
    } else {
      if (start === prev) {
        ranges.push(`#${String(start).padStart(4, '0')}`);
      } else if (prev === start + 1) {
        ranges.push(`#${String(start).padStart(4, '0')}, #${String(prev).padStart(4, '0')}`);
      } else {
        ranges.push(`#${String(start).padStart(4, '0')}–#${String(prev).padStart(4, '0')}`);
      }
      start = current;
      prev = current;
    }
  }
  return ranges.join(', ');
};

export const BilletsReportModal: React.FC<BilletsReportModalProps> = ({
  isOpen,
  onClose,
  tickets,
  initialReportType = 'personnes',
  filterCampagne: defaultCampagne = 'Tous',
  initialFilterStatut = 'tous',
  selectedTicketIds = [],
}) => {
  const [reportType, setReportType] = useState<BilletsReportType>(initialReportType);
  const [selectedCampagne, setSelectedCampagne] = useState<string>(defaultCampagne);
  const [selectedStatut, setSelectedStatut] = useState<ReportStatusFilter>(initialFilterStatut);
  const [orientation, setOrientation] = useState<ReportOrientation>('landscape');
  const [reportSearchTerm, setReportSearchTerm] = useState('');

  // Sync state if props change when opening
  React.useEffect(() => {
    if (isOpen) {
      if (initialFilterStatut) setSelectedStatut(initialFilterStatut);
      if (defaultCampagne) setSelectedCampagne(defaultCampagne);
      if (initialReportType) setReportType(initialReportType);
    }
  }, [isOpen, initialFilterStatut, defaultCampagne, initialReportType]);

  // Extract unique campaigns
  const campagnes = useMemo(() => {
    return Array.from(new Set(tickets.map((t) => t.campagne).filter(Boolean)));
  }, [tickets]);

  const isTicketAttribue = (t: TicketItem) => {
    return Boolean(t.beneficiaire && t.beneficiaire.trim() !== '' && !isNonAttribueText(t.beneficiaire));
  };

  // Filtered tickets based on selected campaign, status and search
  const scopedTickets = useMemo(() => {
    let list = tickets;
    if (selectedCampagne !== 'Tous') {
      list = list.filter((t) => t.campagne === selectedCampagne);
    }
    if (selectedStatut === 'selection' && selectedTicketIds && selectedTicketIds.length > 0) {
      const selectedSet = new Set(selectedTicketIds);
      list = list.filter((t) => selectedSet.has(t.id));
    } else if (selectedStatut === 'paye') {
      list = list.filter((t) => t.paye);
    } else if (selectedStatut === 'impaye') {
      list = list.filter((t) => !t.paye);
    } else if (selectedStatut === 'attribue') {
      list = list.filter(isTicketAttribue);
    } else if (selectedStatut === 'non_attribue') {
      list = list.filter((t) => !isTicketAttribue(t));
    }
    return list;
  }, [tickets, selectedCampagne, selectedStatut, selectedTicketIds]);

  // Group by Person
  const personsList = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        groupe: string;
        telephone: string;
        billets: TicketItem[];
        totalDu: number;
        totalPaye: number;
      }
    >();

    scopedTickets.forEach((t) => {
      const isAttr = isTicketAttribue(t);
      const name = isAttr ? t.beneficiaire.trim() : 'Non attribué';
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name,
          groupe: isAttr ? (t.groupe || '—') : '—',
          telephone: isAttr ? (t.telephone || '') : '',
          billets: [],
          totalDu: 0,
          totalPaye: 0,
        });
      }
      const p = map.get(key)!;
      p.billets.push(t);
      if (isAttr) {
        p.totalDu += t.prix;
      }
      if (t.paye) p.totalPaye += t.prix;
    });

    let result = Array.from(map.values()).sort((a, b) => {
      if (a.name === 'Non attribué') return 1;
      if (b.name === 'Non attribué') return -1;
      return a.name.localeCompare(b.name, 'fr');
    });

    if (reportSearchTerm.trim()) {
      const q = reportSearchTerm.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.groupe.toLowerCase().includes(q) ||
          p.telephone.includes(q) ||
          p.billets.some((b) => b.numero.toString().includes(q))
      );
    }

    return result;
  }, [scopedTickets, reportSearchTerm]);

  // Group by Group
  const groupesList = useMemo(() => {
    const map = new Map<
      string,
      {
        groupe: string;
        totalBillets: number;
        attribues: number;
        payes: number;
        montantTotal: number;
        montantPaye: number;
      }
    >();

    scopedTickets.forEach((t) => {
      const gName = t.groupe || 'Indéfini';
      if (!map.has(gName)) {
        map.set(gName, {
          groupe: gName,
          totalBillets: 0,
          attribues: 0,
          payes: 0,
          montantTotal: 0,
          montantPaye: 0,
        });
      }
      const g = map.get(gName)!;
      g.totalBillets += 1;
      if (isTicketAttribue(t)) g.attribues += 1;
      if (t.paye) {
        g.payes += 1;
        g.montantPaye += t.prix;
      }
      g.montantTotal += t.prix;
    });

    let result = Array.from(map.values()).sort((a, b) => a.groupe.localeCompare(b.groupe, 'fr'));

    if (reportSearchTerm.trim()) {
      const q = reportSearchTerm.trim().toLowerCase();
      result = result.filter((g) => g.groupe.toLowerCase().includes(q));
    }

    return result;
  }, [scopedTickets, reportSearchTerm]);

  // Overall Statistics
  const totalBilletsCount = scopedTickets.length;
  const totalAttribues = scopedTickets.filter(isTicketAttribue).length;
  const totalPayes = scopedTickets.filter((t) => t.paye).length;
  const totalMontantAttendu = scopedTickets.reduce((sum, t) => sum + (isTicketAttribue(t) ? t.prix : 0), 0);
  const totalMontantEncaisse = scopedTickets.filter((t) => t.paye).reduce((sum, t) => sum + t.prix, 0);
  const totalReste = totalMontantAttendu - totalMontantEncaisse;

  // Non-breaking space formatting for currency numbers
  const formatAr = (val: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 })
      .format(val)
      .replace(/\s/g, '\u00A0');
    return `${formatted}\u00A0Ar`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // 1. Sheet: Détail Billets
    const sheetBilletsData = scopedTickets.map((t) => ({
      'N° Billet': `#${String(t.numero).padStart(4, '0')}`,
      'Campagne': t.campagne,
      'Session': t.session || '—',
      'Prix (Ar)': t.prix,
      'Groupe': t.groupe || '—',
      'Bénéficiaire': t.beneficiaire || 'Non attribué',
      'Téléphone': t.telephone || '—',
      'Statut Paiement': t.paye ? 'Payé' : 'Impayé',
      "Date d'attribution": t.dateAttribution || '—',
    }));
    const wsBillets = XLSX.utils.json_to_sheet(sheetBilletsData);
    XLSX.utils.book_append_sheet(workbook, wsBillets, 'Détail Billets');

    // 2. Sheet: Par Personne
    const sheetPersonnesData = personsList.map((p) => {
      const reste = p.totalDu - p.totalPaye;
      const billetNums = p.billets.map((b) => b.numero).sort((a, b) => a - b);
      return {
        'Bénéficiaire': p.name,
        'Groupe': p.groupe,
        'Téléphone': p.telephone || '—',
        'Nombre de billets': p.billets.length,
        'Séries / Numéros': formatTicketRanges(billetNums),
        'Total Dû (Ar)': p.totalDu,
        'Total Payé (Ar)': p.totalPaye,
        'Reste à Payer (Ar)': reste,
      };
    });
    const wsPersonnes = XLSX.utils.json_to_sheet(sheetPersonnesData);
    XLSX.utils.book_append_sheet(workbook, wsPersonnes, 'Synthèse par Personne');

    // 3. Sheet: Par Groupe
    const sheetGroupesData = groupesList.map((g) => {
      const reste = g.montantTotal - g.montantPaye;
      const taux = g.montantTotal > 0 ? Math.round((g.montantPaye / g.montantTotal) * 100) + '%' : '0%';
      return {
        'Groupe': g.groupe,
        'Nombre Total Billets': g.totalBillets,
        'Billets Attribués': g.attribues,
        'Billets Payés': g.payes,
        'Montant Total Attendu (Ar)': g.montantTotal,
        'Montant Encaissé (Ar)': g.montantPaye,
        'Reste à Recouvrer (Ar)': reste,
        'Taux de Recouvrement': taux,
      };
    });
    const wsGroupes = XLSX.utils.json_to_sheet(sheetGroupesData);
    XLSX.utils.book_append_sheet(workbook, wsGroupes, 'Synthèse par Groupe');

    // 4. Sheet: Bilan Global
    const statusLabel =
      selectedStatut === 'paye'
        ? 'Vendus / Payés uniquement'
        : selectedStatut === 'impaye'
        ? 'Non vendus / Impayés uniquement'
        : selectedStatut === 'attribue'
        ? 'Distribués / Attribués uniquement'
        : selectedStatut === 'non_attribue'
        ? 'Non distribués uniquement'
        : selectedStatut === 'selection'
        ? 'Billets sélectionnés'
        : 'Tous les statuts';

    const sheetBilanData = [
      { 'Indicateur': 'Campagne / Période', 'Valeur': selectedCampagne },
      { 'Indicateur': 'Statut des billets inclus', 'Valeur': statusLabel },
      { 'Indicateur': 'Nombre total de billets inclus', 'Valeur': totalBilletsCount },
      { 'Indicateur': 'Billets distribués / attribués', 'Valeur': totalAttribues },
      { 'Indicateur': 'Billets payés intégralement', 'Valeur': totalPayes },
      { 'Indicateur': 'Billets restant à payer', 'Valeur': totalAttribues - totalPayes },
      { 'Indicateur': 'Montant total attendu des ventes (Ar)', 'Valeur': totalMontantAttendu },
      { 'Indicateur': 'Total des fonds collectés / encaissés (Ar)', 'Valeur': totalMontantEncaisse },
      { 'Indicateur': 'Reste net à recouvrer (Ar)', 'Valeur': totalReste },
      { 'Indicateur': 'Taux global de recouvrement', 'Valeur': (totalMontantAttendu > 0 ? Math.round((totalMontantEncaisse / totalMontantAttendu) * 100) : 0) + '%' },
    ];
    const wsBilan = XLSX.utils.json_to_sheet(sheetBilanData);
    XLSX.utils.book_append_sheet(workbook, wsBilan, 'Bilan Global');

    const statusSlug = selectedStatut !== 'tous' ? `_${selectedStatut}` : '';
    const fileName = `rapport_billets_${selectedCampagne.toLowerCase().replace(/[^a-z0-9]/g, '_')}${statusSlug}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="billets-report-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn print:p-0 print:bg-white print:static print:block">
      {/* Print Styles for Direct Browser / PDF Print */}
      <style>{`
        @media print {
          @page {
            size: A4 ${orientation};
            margin: 8mm 8mm 10mm 8mm !important;
          }

          /* CRITICAL: Hide #root and all non-modal body children completely so Page 1 is never empty */
          #root,
          body > *:not(.billets-report-modal-overlay) {
            display: none !important;
            height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          html, body {
            background-color: #ffffff !important;
            color: #111827 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            font-size: 8.5pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide modal controls and interactive buttons completely */
          .print\\:hidden, .no-print, .caisse-app-shell, aside, nav, header {
            display: none !important;
          }

          /* Clean static container for the printable report starting at the very top of Page 1 */
          .billets-report-modal-overlay {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          .printable-billets-doc {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
          }

          .print-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Main Modal Window */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                <Printer className="w-5 h-5" />
              </div>
              <h2 className="text-base sm:text-lg font-black text-gray-900">
                Impression & Export PDF du Rapport des Billets
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Prévisualisez et imprimez proprement les rapports de distribution et de trésorerie.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exporter en Excel (.xlsx)</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 bg-[#00897b] hover:bg-[#00796b] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / Sauvegarder PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Filters (Hidden on Print) */}
        <div className="p-3 sm:p-4 bg-white border-b border-gray-100 flex flex-wrap items-center gap-3 text-xs no-print">
          {/* Report Type Selector */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setReportType('personnes')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                reportType === 'personnes'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Par Personne ({personsList.length})</span>
            </button>
            <button
              onClick={() => setReportType('groupes')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                reportType === 'groupes'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Par Groupe ({groupesList.length})</span>
            </button>
            <button
              onClick={() => setReportType('bilan')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                reportType === 'bilan'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Compte Rendu & Bilan</span>
            </button>
            <button
              onClick={() => setReportType('liste')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                reportType === 'liste'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Liste des Billets ({scopedTickets.length})</span>
            </button>
          </div>

          {/* Campagne Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-500">Campagne :</span>
            <select
              value={selectedCampagne}
              onChange={(e) => setSelectedCampagne(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-800 cursor-pointer text-xs"
            >
              <option value="Tous">Toutes les campagnes ({campagnes.length})</option>
              {campagnes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Statut Filter (Vendu, Non vendu, Distribué, Non distribué) */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-500">Statut :</span>
            <select
              value={selectedStatut}
              onChange={(e) => setSelectedStatut(e.target.value as any)}
              className="px-2.5 py-1.5 bg-gray-50 border border-teal-500/50 rounded-lg font-semibold text-teal-900 cursor-pointer text-xs"
            >
              <option value="tous">Tous les statuts</option>
              <option value="paye">Vendus / Payés uniquement</option>
              <option value="impaye">Non vendus / Impayés uniquement</option>
              <option value="attribue">Distribués uniquement</option>
              <option value="non_attribue">Non distribués uniquement</option>
              {selectedTicketIds && selectedTicketIds.length > 0 && (
                <option value="selection">Sélectionnés ({selectedTicketIds.length})</option>
              )}
            </select>
          </div>

          {/* Orientation Toggle */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="font-semibold text-gray-500">Orientation page :</span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              <button
                onClick={() => setOrientation('landscape')}
                className={`px-2.5 py-1 rounded font-semibold text-[11px] transition cursor-pointer ${
                  orientation === 'landscape'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Paysage (Recommandé)
              </button>
              <button
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1 rounded font-semibold text-[11px] transition cursor-pointer ${
                  orientation === 'portrait'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Portrait
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gray-100/60 print:bg-white print:p-0 print:overflow-visible">
          <div className="printable-billets-doc max-w-5xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-xs border border-gray-200 print:border-none print:shadow-none print:p-0 print:max-w-none text-gray-900">
            {/* Header Document Block */}
            <div className="border-b-2 border-gray-900 pb-4 mb-5 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-800 block mb-1">
                  Gestion de Caisse & AFB160 • Module Billets
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {reportType === 'personnes' && 'RAPPORT DES BILLETS PAR BÉNÉFICIAIRE / PERSONNE'}
                  {reportType === 'groupes' && 'RAPPORT DES BILLETS PAR GROUPE / LOT'}
                  {reportType === 'bilan' && 'COMPTE RENDU & BILAN FINANCIER DES BILLETS'}
                  {reportType === 'liste' && 'LISTE DÉTAILLÉE DES BILLETS'}
                </h1>
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-600 mt-1 font-medium">
                  <span>Campagne : <strong>{selectedCampagne}</strong></span>
                  <span>•</span>
                  <span>
                    Filtre : <strong className="text-teal-800">{
                      selectedStatut === 'paye'
                        ? 'Vendus / Payés uniquement'
                        : selectedStatut === 'impaye'
                        ? 'Non vendus / Impayés uniquement'
                        : selectedStatut === 'attribue'
                        ? 'Distribués uniquement'
                        : selectedStatut === 'non_attribue'
                        ? 'Non distribués uniquement'
                        : selectedStatut === 'selection'
                        ? 'Billets sélectionnés'
                        : 'Tous les billets'
                    }</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Édité le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-mono font-bold uppercase">
                  {totalBilletsCount} Billets au total
                </span>
              </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-6 print-break-inside-avoid">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <span className="text-[9px] font-bold uppercase text-gray-500 block">Total Billets</span>
                <span className="text-sm sm:text-base font-black text-gray-900">{totalBilletsCount}</span>
              </div>
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-center">
                <span className="text-[9px] font-bold uppercase text-blue-800 block">Attribués</span>
                <span className="text-sm sm:text-base font-black text-blue-700">{totalAttribues}</span>
              </div>
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-center">
                <span className="text-[9px] font-bold uppercase text-emerald-800 block">Payés</span>
                <span className="text-sm sm:text-base font-black text-emerald-700">{totalPayes}</span>
              </div>
              <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-lg text-center">
                <span className="text-[9px] font-bold uppercase text-teal-800 block">Total Encaissé</span>
                <span className="text-xs sm:text-sm font-black text-teal-800">{formatAr(totalMontantEncaisse)}</span>
              </div>
              <div className="p-3 bg-orange-50/60 border border-orange-200 rounded-lg text-center">
                <span className="text-[9px] font-bold uppercase text-orange-800 block">Reste à Recouvrer</span>
                <span className="text-xs sm:text-sm font-black text-orange-800">{formatAr(totalReste)}</span>
              </div>
            </div>

            {/* 1. REPORT BY PERSON */}
            {reportType === 'personnes' && (
              <div>
                <table className="w-full text-left text-[11px] border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 text-gray-900 font-bold uppercase text-[9px] tracking-wider border-b-2 border-gray-400">
                      <th className="py-2.5 px-3 whitespace-nowrap border-r border-gray-200">Bénéficiaire</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap border-r border-gray-200">Groupe</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap border-r border-gray-200">Téléphone</th>
                      <th className="py-2.5 px-3 border-r border-gray-200">Numéros Détenus (Séries & Plages)</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap border-r border-gray-200">Nb Billets</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-gray-200">Montant Total</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-gray-200">Payé</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Reste Dû</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {personsList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-gray-400 italic">
                          Aucun bénéficiaire enregistré pour cette sélection.
                        </td>
                      </tr>
                    ) : (
                      personsList.map((p, idx) => {
                        const billetNums = p.billets.map((b) => b.numero).sort((a, b) => a - b);
                        const reste = p.totalDu - p.totalPaye;
                        return (
                          <tr key={idx} className="even:bg-gray-50/70 hover:bg-gray-100/50 print-break-inside-avoid">
                            <td className="py-2 px-3 font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">{p.name}</td>
                            <td className="py-2 px-2.5 text-gray-700 font-medium whitespace-nowrap border-r border-gray-200">{p.groupe}</td>
                            <td className="py-2 px-2.5 text-gray-600 font-mono text-[10px] whitespace-nowrap border-r border-gray-200">{p.telephone || '—'}</td>
                            <td className="py-2 px-3 font-mono text-[10.5px] text-gray-800 leading-relaxed border-r border-gray-200">
                              {formatTicketRanges(billetNums)}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-teal-800 whitespace-nowrap border-r border-gray-200">{p.billets.length}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">
                              {formatAr(p.totalDu)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap border-r border-gray-200">
                              {formatAr(p.totalPaye)}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${reste > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {formatAr(reste)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-900 text-gray-900 text-xs">
                      <td colSpan={4} className="py-2.5 px-3 uppercase whitespace-nowrap border-r border-gray-200">
                        Total Général ({personsList.length} personnes)
                      </td>
                      <td className="py-2.5 px-2 text-center text-teal-800 whitespace-nowrap border-r border-gray-200">{totalAttribues}</td>
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap border-r border-gray-200">{formatAr(totalMontantAttendu)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800 whitespace-nowrap border-r border-gray-200">{formatAr(totalMontantEncaisse)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-700 whitespace-nowrap">{formatAr(totalReste)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Signatures block */}
                <div className="pt-8 mt-8 border-t-2 border-dashed border-gray-300 grid grid-cols-2 gap-12 text-xs print-break-inside-avoid">
                  <div>
                    <p className="font-bold text-gray-900 uppercase">Le Trésorier / Responsable Billets</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Signature précédée de la date</p>
                    <div className="pt-14 border-b border-gray-400 w-56"></div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 uppercase">La Direction / L'Administration</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Visa et cachet</p>
                    <div className="pt-14 border-b border-gray-400 w-56 ml-auto"></div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. REPORT BY GROUP */}
            {reportType === 'groupes' && (
              <div>
                <table className="w-full text-left text-[11px] border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 text-gray-900 font-bold uppercase text-[9px] tracking-wider border-b-2 border-gray-400">
                      <th className="py-2.5 px-4 whitespace-nowrap border-r border-gray-200">Groupe / Lot</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap border-r border-gray-200">Total Billets</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap border-r border-gray-200">Attribués</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap border-r border-gray-200">Payés</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-gray-200">Montant Attendu</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-gray-200">Montant Encaissé</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-gray-200">Reste à Payer</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Taux Recouvrement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {groupesList.map((g, idx) => {
                      const reste = g.montantTotal - g.montantPaye;
                      const taux = g.montantTotal > 0 ? Math.round((g.montantPaye / g.montantTotal) * 100) : 0;
                      return (
                        <tr key={idx} className="even:bg-gray-50/70 hover:bg-gray-100/50 print-break-inside-avoid">
                          <td className="py-2.5 px-4 font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">{g.groupe}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-gray-800 whitespace-nowrap border-r border-gray-200">{g.totalBillets}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-blue-700 whitespace-nowrap border-r border-gray-200">{g.attribues}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-700 whitespace-nowrap border-r border-gray-200">{g.payes}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">{formatAr(g.montantTotal)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap border-r border-gray-200">{formatAr(g.montantPaye)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 whitespace-nowrap border-r border-gray-200">{formatAr(reste)}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-gray-800 whitespace-nowrap">{taux}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-900 text-gray-900 text-xs">
                      <td className="py-2.5 px-4 uppercase whitespace-nowrap border-r border-gray-200">Total Général</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-gray-200">{totalBilletsCount}</td>
                      <td className="py-2.5 px-3 text-center text-blue-800 whitespace-nowrap border-r border-gray-200">{totalAttribues}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-800 whitespace-nowrap border-r border-gray-200">{totalPayes}</td>
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap border-r border-gray-200">{formatAr(totalMontantAttendu)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800 whitespace-nowrap border-r border-gray-200">{formatAr(totalMontantEncaisse)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-700 whitespace-nowrap border-r border-gray-200">{formatAr(totalReste)}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {totalMontantAttendu > 0 ? Math.round((totalMontantEncaisse / totalMontantAttendu) * 100) : 0}%
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Signatures block */}
                <div className="pt-8 mt-8 border-t-2 border-dashed border-gray-300 grid grid-cols-2 gap-12 text-xs print-break-inside-avoid">
                  <div>
                    <p className="font-bold text-gray-900 uppercase">Le Trésorier / Responsable Billets</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Signature précédée de la date</p>
                    <div className="pt-14 border-b border-gray-400 w-56"></div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 uppercase">La Direction / L'Administration</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Visa et cachet</p>
                    <div className="pt-14 border-b border-gray-400 w-56 ml-auto"></div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. REPORT BILAN / SYNTHESE */}
            {reportType === 'bilan' && (
              <div className="space-y-6">
                <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 print-break-inside-avoid">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
                    Tableau Bilan Synthétique
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-gray-200">
                      <span className="text-gray-600">Nombre total de billets émis</span>
                      <span className="font-bold text-gray-900 whitespace-nowrap">{totalBilletsCount}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200">
                      <span className="text-gray-600">Billets distribués / attribués à des bénéficiaires</span>
                      <span className="font-bold text-blue-800 whitespace-nowrap">{totalAttribues}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200">
                      <span className="text-gray-600">Billets payés intégralement</span>
                      <span className="font-bold text-emerald-800 whitespace-nowrap">{totalPayes}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200">
                      <span className="text-gray-600">Billets restant à payer / impayés</span>
                      <span className="font-bold text-orange-800 whitespace-nowrap">{totalAttribues - totalPayes}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-sm">
                      <span className="text-gray-800">Montant total attendu des ventes</span>
                      <span className="font-mono text-gray-900 whitespace-nowrap">{formatAr(totalMontantAttendu)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200 font-bold text-sm text-emerald-800">
                      <span>Total des fonds collectés et enregistrés</span>
                      <span className="font-mono whitespace-nowrap">{formatAr(totalMontantEncaisse)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-sm text-orange-800">
                      <span>Reste net à recouvrer</span>
                      <span className="font-mono whitespace-nowrap">{formatAr(totalReste)}</span>
                    </div>
                  </div>
                </div>

                {/* Signatures block */}
                <div className="pt-8 mt-8 border-t-2 border-dashed border-gray-300 grid grid-cols-2 gap-12 text-xs print-break-inside-avoid">
                  <div>
                    <p className="font-bold text-gray-900 uppercase">Le Trésorier / Responsable des Billets</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Signature précédée de la date</p>
                    <div className="pt-14 border-b border-gray-400 w-56"></div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 uppercase">La Direction / L'Administration</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Visa et cachet</p>
                    <div className="pt-14 border-b border-gray-400 w-56 ml-auto"></div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. LISTE COMPLETE */}
            {reportType === 'liste' && (
              <div>
                <table className="w-full text-left text-[11px] border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 text-gray-900 font-bold uppercase text-[9px] tracking-wider border-b-2 border-gray-400">
                      <th className="py-2.5 px-3 whitespace-nowrap border-r border-gray-200">N° Billet</th>
                      <th className="py-2.5 px-3 whitespace-nowrap border-r border-gray-200">Campagne</th>
                      <th className="py-2.5 px-3 whitespace-nowrap border-r border-gray-200">Prix</th>
                      <th className="py-2.5 px-3 whitespace-nowrap border-r border-gray-200">Groupe</th>
                      <th className="py-2.5 px-3 whitespace-nowrap border-r border-gray-200">Bénéficiaire</th>
                      <th className="py-2.5 px-3 whitespace-nowrap border-r border-gray-200">Téléphone</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Paiement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {scopedTickets.map((t) => (
                      <tr key={t.id} className="even:bg-gray-50/70 hover:bg-gray-100/50 print-break-inside-avoid">
                        <td className="py-1.5 px-3 font-mono font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">#{t.numero.toString().padStart(4, '0')}</td>
                        <td className="py-1.5 px-3 text-gray-700 whitespace-nowrap border-r border-gray-200">{t.campagne}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">{formatAr(t.prix)}</td>
                        <td className="py-1.5 px-3 text-gray-700 font-medium whitespace-nowrap border-r border-gray-200">{t.groupe || '—'}</td>
                        <td className="py-1.5 px-3 font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">{t.beneficiaire || 'Non attribué'}</td>
                        <td className="py-1.5 px-3 text-gray-600 font-mono text-[10px] whitespace-nowrap border-r border-gray-200">{t.telephone || '—'}</td>
                        <td className="py-1.5 px-3 text-center font-bold whitespace-nowrap">
                          <span className={t.paye ? 'text-emerald-700' : 'text-orange-700'}>
                            {t.paye ? 'Payé' : 'Impayé'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
