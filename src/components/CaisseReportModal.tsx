import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Calendar, Filter, ArrowUpRight, ArrowDownRight, Wallet, CheckCircle2 } from 'lucide-react';
import { Caisse, Transaction } from '../types/caisse';
import {
  DatePeriodFilter,
  getPeriodDateRange,
  parseTxDate,
} from '../utils/dateUtils';

interface CaisseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  caisse?: Caisse | null;
  caisses: Caisse[];
  transactions: Transaction[];
  initialPeriod?: DatePeriodFilter;
  initialStartDate?: string;
  initialEndDate?: string;
}

export const CaisseReportModal: React.FC<CaisseReportModalProps> = ({
  isOpen,
  onClose,
  caisse,
  caisses,
  transactions,
  initialPeriod = 'all',
  initialStartDate = '',
  initialEndDate = '',
}) => {
  // State for caisse and period filtering
  const [selectedCaisseId, setSelectedCaisseId] = useState<string>(
    caisse?.id || 'all'
  );
  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriodFilter>(
    initialPeriod || 'all'
  );
  const [customStartDate, setCustomStartDate] = useState<string>(
    initialStartDate || ''
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    initialEndDate || ''
  );
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Sync state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setSelectedCaisseId(caisse ? caisse.id : 'all');
      setSelectedPeriod(initialPeriod || 'all');
      setCustomStartDate(initialStartDate || '');
      setCustomEndDate(initialEndDate || '');
    }
  }, [isOpen, caisse, initialPeriod, initialStartDate, initialEndDate]);

  // Active caisse object or null (for all)
  const currentCaisse = useMemo(() => {
    if (selectedCaisseId === 'all') return null;
    return caisses.find((c) => c.id === selectedCaisseId) || null;
  }, [caisses, selectedCaisseId]);

  // Compute date range details based on selected period
  const periodInfo = useMemo(() => {
    return getPeriodDateRange(selectedPeriod, customStartDate, customEndDate);
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Base caisses to consider
  const baseCaisses = useMemo(() => {
    return currentCaisse ? [currentCaisse] : caisses;
  }, [currentCaisse, caisses]);

  // Initial sum configured at caisse creation
  const baseInitialBalance = useMemo(() => {
    return baseCaisses.reduce((sum, c) => sum + (c.soldeInitial || 0), 0);
  }, [baseCaisses]);

  // All transactions matching the caisse selection
  const allCaisseTxs = useMemo(() => {
    if (currentCaisse) {
      return transactions.filter((t) => t.caisseId === currentCaisse.id);
    }
    return transactions;
  }, [currentCaisse, transactions]);

  // Prior transactions (strictly before the period start date) to compute starting balance
  const priorTxs = useMemo(() => {
    if (!periodInfo.start) return [];
    const startTime = periodInfo.start.getTime();
    return allCaisseTxs.filter((t) => parseTxDate(t.date).getTime() < startTime);
  }, [allCaisseTxs, periodInfo.start]);

  const priorEntrees = useMemo(() => {
    return priorTxs
      .filter((t) => t.type === 'entree')
      .reduce((sum, t) => sum + t.montant, 0);
  }, [priorTxs]);

  const priorSorties = useMemo(() => {
    return priorTxs
      .filter((t) => t.type === 'sortie')
      .reduce((sum, t) => sum + t.montant, 0);
  }, [priorTxs]);

  // Balance at the beginning of the selected period (Report à nouveau)
  const soldeDebutPeriode = baseInitialBalance + priorEntrees - priorSorties;

  // Transactions within the selected period, sorted chronologically ascending
  const targetTransactions = useMemo(() => {
    const filtered = allCaisseTxs.filter((t) => {
      const time = parseTxDate(t.date).getTime();
      if (periodInfo.start && time < periodInfo.start.getTime()) return false;
      if (periodInfo.end && time > periodInfo.end.getTime()) return false;
      return true;
    });

    return filtered.sort(
      (a, b) => parseTxDate(a.date).getTime() - parseTxDate(b.date).getTime()
    );
  }, [allCaisseTxs, periodInfo.start, periodInfo.end]);

  // Inflows & Outflows for the period
  const totalEntrees = useMemo(() => {
    return targetTransactions
      .filter((t) => t.type === 'entree')
      .reduce((sum, t) => sum + t.montant, 0);
  }, [targetTransactions]);

  const totalSorties = useMemo(() => {
    return targetTransactions
      .filter((t) => t.type === 'sortie')
      .reduce((sum, t) => sum + t.montant, 0);
  }, [targetTransactions]);

  const net = totalEntrees - totalSorties;
  const soldeFinPeriode = soldeDebutPeriode + net;

  // Transactions with running balance
  const txWithProgressiveBalance = useMemo(() => {
    let current = soldeDebutPeriode;
    return targetTransactions.map((tx) => {
      if (tx.type === 'entree') {
        current += tx.montant;
      } else {
        current -= tx.montant;
      }
      return {
        ...tx,
        soldeApres: current,
      };
    });
  }, [targetTransactions, soldeDebutPeriode]);

  // Format currency with non-breaking spaces so numbers and 'AR' never break onto multiple lines
  const formatAr = (val: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(val)
      .replace(/\s/g, '\u00A0');
    return `${formatted}\u00A0AR`;
  };

  const todayStr = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="caisse-report-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn print:p-0 print:bg-white print:static print:block">
      {/* Print & PDF Layout Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 ${orientation};
            margin: 8mm 8mm 10mm 8mm !important;
          }

          /* CRITICAL: Hide #root and all non-modal body children completely so Page 1 is NEVER empty */
          #root,
          body > *:not(.caisse-report-modal-overlay) {
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

          /* Hide app shell and modal controls completely so they take ZERO space */
          .print\\:hidden, .no-print, .caisse-app-shell, aside, nav, header {
            display: none !important;
          }

          /* Clean static non-floating container for the printable report */
          .caisse-report-modal-overlay {
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

          .printable-report {
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

          .report-doc-body {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          .report-header-block {
            margin-bottom: 10px !important;
            padding-bottom: 8px !important;
            border-bottom: 2px solid #111827 !important;
          }

          .report-summary-grid {
            display: grid !important;
            grid-template-columns: repeat(5, 1fr) !important;
            gap: 6px !important;
            margin-bottom: 12px !important;
          }

          .report-summary-card {
            border: 1px solid #cbd5e1 !important;
            background-color: #f8fafc !important;
            padding: 6px 8px !important;
            border-radius: 4px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .report-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 14px !important;
            font-size: 7.5pt !important;
          }

          .report-table thead {
            display: table-header-group !important;
          }

          .report-table thead tr {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .report-table th, .report-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            vertical-align: middle !important;
          }

          /* CRITICAL: Force tfoot to behave as table-row-group so it appears ONLY ON THE LAST PAGE, NOT repeated on every page */
          .report-table tfoot, tfoot {
            display: table-row-group !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .report-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .page-break-inside-avoid, .print-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="printable-report bg-white rounded-2xl shadow-2xl w-full max-w-5xl text-gray-900 border border-gray-100 max-h-[94vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        {/* Modal Controls Bar (Screen only, hidden on print) */}
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50/90 print:hidden shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
                <Filter className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-gray-900 leading-tight">
                  Aperçu avant impression & Export PDF Caisse
                </h2>
                <p className="text-[11px] text-gray-500">
                  Sélectionnez la période et la caisse avant d'imprimer ou de sauvegarder en PDF
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
                title="Imprimer ou enregistrer en PDF via le navigateur"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer / Sauvegarder PDF</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition cursor-pointer"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Interactive Filters Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200/60 text-xs">
            {/* Caisse Selector */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-600">Caisse :</span>
              <select
                value={selectedCaisseId}
                onChange={(e) => setSelectedCaisseId(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="all">Toutes les caisses</option>
                {caisses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-600 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                Période :
              </span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as DatePeriodFilter)}
                className="bg-white border border-teal-600/60 text-teal-900 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="all">Toutes les dates</option>
                <option value="today">Aujourd'hui</option>
                <option value="yesterday">Hier</option>
                <option value="this_week">Cette semaine</option>
                <option value="last_week">Semaine dernière</option>
                <option value="this_month">Ce mois-ci</option>
                <option value="last_month">Mois dernier</option>
                <option value="this_year">Cette année</option>
                <option value="custom">Période personnalisée...</option>
              </select>
            </div>

            {/* Quick Period Buttons */}
            <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-gray-200">
              <button
                onClick={() => setSelectedPeriod('this_month')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  selectedPeriod === 'this_month'
                    ? 'bg-teal-700 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Ce mois-ci
              </button>
              <button
                onClick={() => setSelectedPeriod('last_month')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  selectedPeriod === 'last_month'
                    ? 'bg-teal-700 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Mois dernier
              </button>
              <button
                onClick={() => setSelectedPeriod('this_week')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  selectedPeriod === 'this_week'
                    ? 'bg-teal-700 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Cette semaine
              </button>
              <button
                onClick={() => setSelectedPeriod('today')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  selectedPeriod === 'today'
                    ? 'bg-teal-700 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setSelectedPeriod('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  selectedPeriod === 'all'
                    ? 'bg-teal-700 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Toutes
              </button>
            </div>

            {/* Custom Dates Inputs */}
            {selectedPeriod === 'custom' && (
              <div className="flex items-center gap-2 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                <span className="text-[11px] text-teal-800 font-semibold">Du:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs text-gray-800 focus:outline-none"
                />
                <span className="text-[11px] text-teal-800 font-semibold">Au:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs text-gray-800 focus:outline-none"
                />
              </div>
            )}

            {/* Orientation Toggle */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="font-semibold text-gray-600">Orientation :</span>
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`px-2.5 py-1 rounded font-semibold text-[11px] transition cursor-pointer ${
                    orientation === 'portrait'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Portrait (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`px-2.5 py-1 rounded font-semibold text-[11px] transition cursor-pointer ${
                    orientation === 'landscape'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Paysage
                </button>
              </div>
            </div>

            <div className="text-[11px] font-medium text-gray-500">
              {targetTransactions.length} écriture(s) trouvée(s)
            </div>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="report-doc-body p-6 sm:p-10 overflow-y-auto flex-1 font-sans text-xs print:p-0">
          {/* Header */}
          <div className="report-header-block border-b-2 border-gray-900 pb-3 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Rapport de Caisse — {currentCaisse ? currentCaisse.nom : 'Toutes les Caisses'}
                </h1>
                {/* Prominent Period Mention */}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-bold text-xs text-teal-900 bg-teal-50 border border-teal-300 px-2.5 py-0.5 rounded-md print:border-gray-800 print:text-black">
                    <Calendar className="w-3.5 h-3.5 print:hidden" />
                    PÉRIODE : {periodInfo.label.toUpperCase()} ({periodInfo.rangeText})
                  </span>
                  {currentCaisse && (
                    <span className="text-[11px] text-gray-500">
                      Devise : {currentCaisse.devise || 'AR'}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 mt-1 text-[11px]">
                  Généré le {todayStr} | {targetTransactions.length} écriture(s) sur la période | Gestion de Caisse & AFB160
                </p>
              </div>
              <div className="text-right text-xs font-bold text-gray-600 uppercase tracking-widest print:text-gray-900 shrink-0">
                <span className="block text-sm font-black text-gray-900">RAPPORT OFFICIEL</span>
                <span className="text-[10px] text-gray-500 font-normal">État comptable</span>
              </div>
            </div>
          </div>

          {/* 5 Summary Cards: Solde Début, Entrées, Sorties, Net, Solde Fin */}
          <div className="report-summary-grid grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5 print-break-inside-avoid">
            {/* 1. Solde Début Période */}
            <div className="report-summary-card border border-slate-300 bg-slate-50 p-2.5 rounded-xl">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700 block mb-0.5">
                SOLDE DÉBUT PÉRIODE
              </span>
              <span className="text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">
                {formatAr(soldeDebutPeriode)}
              </span>
              <span className="text-[9px] text-gray-400 block mt-0.5">Report à nouveau</span>
            </div>

            {/* 2. Total Entrées */}
            <div className="report-summary-card border border-emerald-200 bg-emerald-50/70 p-2.5 rounded-xl">
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-900 block mb-0.5">
                TOTAL ENTRÉES
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-700 whitespace-nowrap">
                +{formatAr(totalEntrees)}
              </span>
              <span className="text-[9px] text-emerald-600/70 block mt-0.5">Sur la période</span>
            </div>

            {/* 3. Total Sorties */}
            <div className="report-summary-card border border-orange-200 bg-orange-50/70 p-2.5 rounded-xl">
              <span className="text-[9px] font-bold uppercase tracking-wider text-orange-900 block mb-0.5">
                TOTAL SORTIES
              </span>
              <span className="text-xs sm:text-sm font-black text-orange-700 whitespace-nowrap">
                -{formatAr(totalSorties)}
              </span>
              <span className="text-[9px] text-orange-600/70 block mt-0.5">Sur la période</span>
            </div>

            {/* 4. Net de la Période */}
            <div className="report-summary-card border border-indigo-200 bg-indigo-50/70 p-2.5 rounded-xl">
              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-900 block mb-0.5">
                NET PÉRIODE
              </span>
              <span
                className={`text-xs sm:text-sm font-black whitespace-nowrap ${
                  net >= 0 ? 'text-indigo-800' : 'text-red-700'
                }`}
              >
                {net >= 0 ? '+' : ''}
                {formatAr(net)}
              </span>
              <span className="text-[9px] text-indigo-600/70 block mt-0.5">Entrées - Sorties</span>
            </div>

            {/* 5. Solde Fin Période */}
            <div className="report-summary-card border border-teal-300 bg-teal-50 p-2.5 rounded-xl col-span-2 sm:col-span-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-teal-950 block mb-0.5">
                SOLDE FIN PÉRIODE
              </span>
              <span className="text-xs sm:text-sm font-black text-teal-800 whitespace-nowrap">
                {formatAr(soldeFinPeriode)}
              </span>
              <span className="text-[9px] text-teal-700/70 block mt-0.5">Solde de clôture</span>
            </div>
          </div>

          {/* Transactions Table */}
          <table className="report-table w-full text-left text-xs border-collapse mb-5">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-100 text-gray-800 font-bold uppercase text-[9px] tracking-wider">
                <th className="py-2 px-2 text-left w-24 whitespace-nowrap">DATE</th>
                <th className="py-2 px-2 text-center w-18 whitespace-nowrap">TYPE</th>
                {!currentCaisse && <th className="py-2 px-2 text-left w-24 whitespace-nowrap">CAISSE</th>}
                <th className="py-2 px-2 text-left">MOTIF</th>
                <th className="py-2 px-2 text-right w-28 whitespace-nowrap">MONTANT</th>
                <th className="py-2 px-2 text-right w-28 whitespace-nowrap">SOLDE CUMULÉ</th>
                <th className="py-2 px-2 text-left w-28 whitespace-nowrap">RESPONSABLE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {txWithProgressiveBalance.length === 0 ? (
                <tr>
                  <td
                    colSpan={currentCaisse ? 6 : 7}
                    className="py-8 text-center text-gray-400 italic bg-gray-50/50"
                  >
                    Aucune transaction enregistrée pour cette période ({periodInfo.label} — {periodInfo.rangeText}).
                  </td>
                </tr>
              ) : (
                txWithProgressiveBalance.map((tx) => {
                  const isEntree = tx.type === 'entree';
                  const caisseName =
                    caisses.find((c) => c.id === tx.caisseId)?.nom || '';
                  const cleanResp =
                    tx.responsable && tx.responsable.trim() !== '.' && tx.responsable.trim() !== ''
                      ? tx.responsable.trim()
                      : '—';

                  return (
                    <tr key={tx.id} className="even:bg-gray-50/60 hover:bg-gray-100/50 print-break-inside-avoid">
                      <td className="py-1.5 px-2 text-gray-800 font-mono whitespace-nowrap text-[10px]">
                        {tx.date}
                      </td>
                      <td className="py-1.5 px-2 text-center whitespace-nowrap">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            isEntree
                              ? 'text-emerald-800 bg-emerald-50 print:bg-transparent'
                              : 'text-orange-800 bg-orange-50 print:bg-transparent'
                          }`}
                        >
                          {isEntree ? 'Entrée' : 'Sortie'}
                        </span>
                      </td>
                      {!currentCaisse && (
                        <td className="py-1.5 px-2 text-gray-700 whitespace-nowrap text-[10px] font-medium">
                          {caisseName}
                        </td>
                      )}
                      <td className="py-1.5 px-2 text-gray-900 font-medium break-words">
                        {tx.motif || '—'}
                      </td>
                      <td
                        className={`py-1.5 px-2 text-right font-mono font-bold whitespace-nowrap ${
                          isEntree ? 'text-emerald-700' : 'text-orange-700'
                        }`}
                      >
                        {isEntree ? '+' : '-'}
                        {formatAr(tx.montant)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-semibold text-gray-700 whitespace-nowrap">
                        {formatAr(tx.soldeApres)}
                      </td>
                      <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap text-[10px]">
                        {cleanResp}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer Totals - Rendered only at the bottom on the last page */}
            <tfoot style={{ display: 'table-row-group' }} className="print:table-row-group">
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-400 text-gray-900 print-break-inside-avoid">
                <td
                  colSpan={currentCaisse ? 3 : 4}
                  className="py-2.5 px-3 uppercase text-[10px] tracking-wider whitespace-nowrap"
                >
                  TOTAUX DE LA PÉRIODE ({periodInfo.label.toUpperCase()})
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono text-xs whitespace-nowrap">
                  <div className="text-emerald-800 font-bold">+{formatAr(totalEntrees)}</div>
                  <div className="text-orange-800 font-bold">-{formatAr(totalSorties)}</div>
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono font-black text-xs whitespace-nowrap text-teal-900">
                  <span className="text-[9px] uppercase text-gray-500 block font-normal">Solde Clôture</span>
                  <span>{formatAr(soldeFinPeriode)}</span>
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono font-bold text-xs whitespace-nowrap">
                  <span className="text-[9px] uppercase text-gray-500 block font-normal">Net Période</span>
                  <span className={net >= 0 ? 'text-indigo-800' : 'text-red-700'}>
                    {net >= 0 ? '+' : ''}{formatAr(net)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Official Signatures Section - Always positioned on the final page after the totals */}
          <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-300 grid grid-cols-2 gap-12 text-xs page-break-inside-avoid print-break-inside-avoid">
            <div className="space-y-10">
              <div>
                <p className="font-bold text-gray-900 uppercase tracking-wide">
                  Le Responsable / Caissier
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Visa et signature pour la période arrêtée au {periodInfo.rangeText} :
                </p>
              </div>
              <div className="pt-10 border-b border-gray-400 w-52"></div>
            </div>

            <div className="space-y-10 text-right">
              <div>
                <p className="font-bold text-gray-900 uppercase tracking-wide">
                  L'Administrateur / Direction
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Approbation et vérification des soldes de clôture :
                </p>
              </div>
              <div className="pt-10 border-b border-gray-400 w-52 ml-auto"></div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
