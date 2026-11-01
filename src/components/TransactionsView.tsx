import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Wallet,
  Plus,
  Upload,
  FileText,
  FileSpreadsheet,
  Search,
  Calendar,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Caisse, Transaction, User } from '../types/caisse';
import {
  DatePeriodFilter,
  getPeriodDateRange,
  parseTxDate,
} from '../utils/dateUtils';

export type { DatePeriodFilter };
export type TransactionSortField = 'date' | 'type' | 'caisse' | 'motif' | 'montant' | 'responsable';
export type SortDirection = 'asc' | 'desc';

interface TransactionsViewProps {
  caisses: Caisse[];
  transactions: Transaction[];
  selectedCaisseId: string | null;
  onClearSelectedCaisse: () => void;
  currentUser: User;
  onOpenNewTransactionModal: (preselectedCaisseId?: string) => void;
  onOpenEditTransactionModal: (tx: Transaction) => void;
  onOpenExcelImportModal: (caisseId: string) => void;
  onOpenReportModal: (
    caisseId?: string,
    period?: DatePeriodFilter,
    startDate?: string,
    endDate?: string
  ) => void;
  onExportExcel: (
    caisseId?: string,
    period?: DatePeriodFilter,
    startDate?: string,
    endDate?: string,
    filteredTxs?: Transaction[]
  ) => void;
  onDeleteTransaction: (id: string) => void;
  onBatchDeleteTransactions: (ids: string[]) => Promise<void>;
}


export const TransactionsView: React.FC<TransactionsViewProps> = ({
  caisses,
  transactions,
  selectedCaisseId,
  onClearSelectedCaisse,
  currentUser,
  onOpenNewTransactionModal,
  onOpenEditTransactionModal,
  onOpenExcelImportModal,
  onOpenReportModal,
  onExportExcel,
  onDeleteTransaction,
  onBatchDeleteTransactions,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [filterType, setFilterType] = useState<'all' | 'entree' | 'sortie'>('all');
  const [filterCaisseId, setFilterCaisseId] = useState<string>(selectedCaisseId || 'all');
  const [filterPeriod, setFilterPeriod] = useState<DatePeriodFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Sorting state (default: most recent transactions first)
  const [sortField, setSortField] = useState<TransactionSortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: TransactionSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection(
        field === 'motif' || field === 'responsable' || field === 'caisse' ? 'asc' : 'desc'
      );
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: TransactionSortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
      );
    }
    return sortDirection === 'desc' ? (
      <ArrowDown className="w-3.5 h-3.5 text-teal-600 font-bold" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-teal-600 font-bold" />
    );
  };

  // Selected transactions set for batch deletion
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // Sync state if selectedCaisseId prop changes
  React.useEffect(() => {
    if (selectedCaisseId) {
      setFilterCaisseId(selectedCaisseId);
    }
  }, [selectedCaisseId]);

  const activeCaisse = caisses.find((c) => c.id === filterCaisseId);

  // Check write permission
  const canWriteCurrentCaisse = useMemo(() => {
    if (isAdmin) return true;
    if (filterCaisseId !== 'all') {
      return currentUser.caissePermissions?.[filterCaisseId] === 'write';
    }
    return Object.values(currentUser.caissePermissions || {}).some((p) => p === 'write');
  }, [isAdmin, currentUser, filterCaisseId]);

  // Date filtering logic using shared getPeriodDateRange
  const periodInfo = useMemo(() => {
    return getPeriodDateRange(filterPeriod, customStartDate, customEndDate);
  }, [filterPeriod, customStartDate, customEndDate]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Caisse filter
      if (filterCaisseId !== 'all' && tx.caisseId !== filterCaisseId) {
        return false;
      }
      // Type filter
      if (filterType !== 'all' && tx.type !== filterType) {
        return false;
      }

      // Date Period filter
      if (filterPeriod !== 'all') {
        const txTime = parseTxDate(tx.date).getTime();
        if (periodInfo.start && txTime < periodInfo.start.getTime()) return false;
        if (periodInfo.end && txTime > periodInfo.end.getTime()) return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesMotif = (tx.motif || '').toLowerCase().includes(term);
        const matchesResp = (tx.responsable || '').toLowerCase().includes(term);
        const matchesAmount = String(tx.montant).includes(term);
        if (!matchesMotif && !matchesResp && !matchesAmount) return false;
      }

      return true;
    });
  }, [
    transactions,
    filterCaisseId,
    filterType,
    filterPeriod,
    periodInfo,
    searchTerm,
  ]);

  // Sort filtered transactions
  const sortedTransactions = useMemo(() => {
    const list = [...filteredTransactions];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        const timeA = parseTxDate(a.date).getTime();
        const timeB = parseTxDate(b.date).getTime();
        cmp = timeA - timeB;
        if (cmp === 0) {
          const createA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          cmp = createA - createB;
        }
        if (cmp === 0) {
          cmp = (a.id || '').localeCompare(b.id || '');
        }
      } else if (sortField === 'montant') {
        cmp = (a.montant || 0) - (b.montant || 0);
      } else if (sortField === 'motif') {
        cmp = (a.motif || '').localeCompare(b.motif || '', 'fr', { sensitivity: 'base' });
      } else if (sortField === 'type') {
        cmp = (a.type || '').localeCompare(b.type || '', 'fr');
      } else if (sortField === 'responsable') {
        cmp = (a.responsable || '').localeCompare(b.responsable || '', 'fr', { sensitivity: 'base' });
      } else if (sortField === 'caisse') {
        const caisseA = caisses.find((c) => c.id === a.caisseId)?.nom || '';
        const caisseB = caisses.find((c) => c.id === b.caisseId)?.nom || '';
        cmp = caisseA.localeCompare(caisseB, 'fr', { sensitivity: 'base' });
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredTransactions, sortField, sortDirection, caisses]);

  // Financial metrics
  const totalEntrees = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'entree')
      .reduce((sum, t) => sum + t.montant, 0);
  }, [filteredTransactions]);

  const totalSorties = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'sortie')
      .reduce((sum, t) => sum + t.montant, 0);
  }, [filteredTransactions]);

  const net = totalEntrees - totalSorties;

  // Pagination
  const totalPages = Math.ceil(sortedTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTransactions.slice(start, start + pageSize);
  }, [sortedTransactions, currentPage, pageSize]);

  // Selection handlers
  const isAllPaginatedSelected =
    paginatedTransactions.length > 0 &&
    paginatedTransactions.every((tx) => selectedTxIds.has(tx.id));

  const toggleSelectAllPaginated = () => {
    const next = new Set(selectedTxIds);
    if (isAllPaginatedSelected) {
      paginatedTransactions.forEach((tx) => next.delete(tx.id));
    } else {
      paginatedTransactions.forEach((tx) => next.add(tx.id));
    }
    setSelectedTxIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTxIds(next);
  };

  const handleBatchDelete = async () => {
    if (!isAdmin || selectedTxIds.size === 0) return;
    const count = selectedTxIds.size;
    if (window.confirm(`Confirmer la suppression de ${count} transaction(s) sélectionnée(s) ?`)) {
      await onBatchDeleteTransactions(Array.from(selectedTxIds));
      setSelectedTxIds(new Set());
    }
  };

  const formatAr = (val: number) => {
    return (
      new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val) + ' AR'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {filterCaisseId !== 'all' && (
            <button
              onClick={() => {
                setFilterCaisseId('all');
                onClearSelectedCaisse();
              }}
              className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition cursor-pointer"
              title="Retour à toutes les caisses"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {activeCaisse ? `Transactions - ${activeCaisse.nom}` : 'Transactions'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {activeCaisse
                ? `Solde actuel : ${formatAr(
                    (activeCaisse.soldeInitial || 0) + totalEntrees - totalSorties
                  )} • Solde initial : ${formatAr(activeCaisse.soldeInitial || 0)}`
                : 'Toutes les entrées et sorties des caisses'}
            </p>
          </div>
        </div>

        {/* Action Buttons matching Screenshots 3 & 5 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Import Excel */}
          {canWriteCurrentCaisse && (
            <button
              onClick={() =>
                onOpenExcelImportModal(
                  filterCaisseId !== 'all' ? filterCaisseId : caisses[0]?.id
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-gray-500" />
              <span>Import Excel</span>
            </button>
          )}

          {/* Export PDF / Rapport */}
          <button
            onClick={() =>
              onOpenReportModal(
                filterCaisseId !== 'all' ? filterCaisseId : undefined,
                filterPeriod,
                customStartDate,
                customEndDate
              )
            }
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <span>Export PDF</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={() =>
              onExportExcel(
                filterCaisseId !== 'all' ? filterCaisseId : undefined,
                filterPeriod,
                customStartDate,
                customEndDate,
                sortedTransactions
              )
            }
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-gray-500" />
            <span>Export Excel</span>
          </button>

          {/* Nouvelle Transaction */}
          {canWriteCurrentCaisse && (
            <button
              onClick={() =>
                onOpenNewTransactionModal(
                  filterCaisseId !== 'all' ? filterCaisseId : undefined
                )
              }
              className="flex items-center gap-1.5 px-4 py-2 bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Transaction</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Metric Cards: Total Entrées, Total Sorties, Net Flux, Solde Actuel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Entrees */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              TOTAL ENTRÉES
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 tracking-tight">
              {formatAr(totalEntrees)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* Total Sorties */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              TOTAL SORTIES
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-orange-600 tracking-tight">
              {formatAr(totalSorties)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>

        {/* Net (Flux) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              NET (FLUX)
            </p>
            <p className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
              net >= 0 ? 'text-gray-900' : 'text-red-600'
            }`}>
              {formatAr(net)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
        </div>

        {/* Solde Actuel */}
        <div className="bg-white p-5 rounded-2xl border border-teal-100 shadow-xs flex items-center justify-between bg-teal-50/20">
          <div>
            <p className="text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">
              {activeCaisse ? 'SOLDE ACTUEL' : 'SOLDE TOTAL'}
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-teal-900 tracking-tight">
              {formatAr(
                activeCaisse
                  ? (activeCaisse.soldeInitial || 0) + totalEntrees - totalSorties
                  : caisses.reduce(
                      (sum, c) =>
                        sum +
                        (c.soldeInitial || 0) +
                        transactions
                          .filter((t) => t.caisseId === c.id && t.type === 'entree')
                          .reduce((s, t) => s + t.montant, 0) -
                        transactions
                          .filter((t) => t.caisseId === c.id && t.type === 'sortie')
                          .reduce((s, t) => s + t.montant, 0),
                      0
                    )
              )}
            </p>
            {activeCaisse && (
              <p className="text-[10px] text-teal-600 font-medium mt-0.5">
                Solde initial : {formatAr(activeCaisse.soldeInitial || 0)}
              </p>
            )}
          </div>
          <div className="p-2.5 rounded-xl bg-teal-600 text-white shadow-xs">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Bar with Date Period & Multi-selection Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Type dropdown */}
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-gray-50 border border-gray-200 text-gray-700 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
            >
              <option value="all">Tous les types</option>
              <option value="entree">Entrée</option>
              <option value="sortie">Sortie</option>
            </select>

            {/* Caisse dropdown */}
            <select
              value={filterCaisseId}
              onChange={(e) => {
                setFilterCaisseId(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-gray-50 border border-teal-500/60 text-teal-900 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold"
            >
              <option value="all">Toutes les caisses</option>
              {caisses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>

            {/* Date Period dropdown requested by user */}
            <select
              value={filterPeriod}
              onChange={(e) => {
                setFilterPeriod(e.target.value as DatePeriodFilter);
                setCurrentPage(1);
              }}
              className="bg-gray-50 border border-gray-200 text-gray-700 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
            >
              <option value="all">Toutes les périodes</option>
              <option value="today">Aujourd'hui</option>
              <option value="yesterday">Hier</option>
              <option value="this_week">Cette semaine</option>
              <option value="last_week">Semaine dernière</option>
              <option value="this_month">Ce mois-ci</option>
              <option value="last_month">Mois dernier</option>
              <option value="this_year">Cette année</option>
              <option value="custom">Période personnalisée...</option>
            </select>

            {/* Search box matching Screenshot */}
            <div className="relative min-w-[180px] max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Rechercher motif, montant..."
                className="w-full bg-gray-50 border border-gray-200 text-gray-700 pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
            </div>

            {/* Quick Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-xl hover:border-teal-400 transition-colors">
              <span className="text-[11px] font-semibold text-gray-500 uppercase flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="hidden sm:inline">Tri :</span>
              </span>
              <select
                value={`${sortField}-${sortDirection}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split('-') as [
                    TransactionSortField,
                    SortDirection,
                  ];
                  setSortField(field);
                  setSortDirection(dir);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-gray-700 font-medium focus:outline-none cursor-pointer text-xs"
                title="Trier les transactions"
              >
                <option value="date-desc">Date (récent d'abord)</option>
                <option value="date-asc">Date (ancien d'abord)</option>
                <option value="montant-desc">Montant (décroissant)</option>
                <option value="montant-asc">Montant (croissant)</option>
                <option value="motif-asc">Motif (A à Z)</option>
                <option value="motif-desc">Motif (Z à A)</option>
                <option value="type-asc">Type (Entrées d'abord)</option>
                <option value="type-desc">Type (Sorties d'abord)</option>
                <option value="responsable-asc">Responsable (A à Z)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium text-xs">
              {sortedTransactions.length} transaction
              {sortedTransactions.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Custom date range picker if custom selected */}
        {filterPeriod === 'custom' && (
          <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-3 bg-teal-50/40 p-2.5 rounded-xl">
            <span className="font-semibold text-teal-900 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              Période personnalisée :
            </span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Du</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Au</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-xs text-teal-700 hover:underline cursor-pointer ml-auto"
              >
                Effacer les dates
              </button>
            )}
          </div>
        )}

        {/* Multi-selection Bar (Admin only) */}
        {isAdmin && selectedTxIds.size > 0 && (
          <div className="bg-teal-900 text-white p-2.5 rounded-xl flex items-center justify-between gap-3 shadow-md animate-fadeIn">
            <div className="flex items-center gap-2 font-medium">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>
                <strong>{selectedTxIds.size}</strong> transaction{selectedTxIds.size > 1 ? 's' : ''} sélectionnée{selectedTxIds.size > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTxIds(new Set())}
                className="px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition cursor-pointer"
              >
                Désélectionner tout
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer la sélection</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table matching Screenshot image_11c7cd01.png */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[11px] font-semibold tracking-wider bg-gray-50/50">
                {/* Select All Checkbox - Admin only */}
                {isAdmin && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllPaginatedSelected}
                      onChange={toggleSelectAllPaginated}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 border-gray-300 cursor-pointer"
                      title="Tout sélectionner / désélectionner"
                    />
                  </th>
                )}
                {/* DATE Column - Sortable */}
                <th
                  onClick={() => handleSort('date')}
                  className="py-3 px-4 cursor-pointer select-none group hover:bg-teal-50/60 transition-colors"
                  title="Cliquer pour trier par date"
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span
                      className={
                        sortField === 'date'
                          ? 'text-teal-900 font-extrabold'
                          : 'text-gray-500 group-hover:text-gray-900 font-semibold'
                      }
                    >
                      DATE
                    </span>
                    {renderSortIcon('date')}
                  </div>
                </th>

                {/* TYPE Column - Sortable */}
                <th
                  onClick={() => handleSort('type')}
                  className="py-3 px-4 cursor-pointer select-none group hover:bg-teal-50/60 transition-colors"
                  title="Cliquer pour trier par type"
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span
                      className={
                        sortField === 'type'
                          ? 'text-teal-900 font-extrabold'
                          : 'text-gray-500 group-hover:text-gray-900 font-semibold'
                      }
                    >
                      TYPE
                    </span>
                    {renderSortIcon('type')}
                  </div>
                </th>

                {/* CAISSE Column - Sortable when 'all' */}
                {filterCaisseId === 'all' && (
                  <th
                    onClick={() => handleSort('caisse')}
                    className="py-3 px-4 cursor-pointer select-none group hover:bg-teal-50/60 transition-colors"
                    title="Cliquer pour trier par caisse"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span
                        className={
                          sortField === 'caisse'
                            ? 'text-teal-900 font-extrabold'
                            : 'text-gray-500 group-hover:text-gray-900 font-semibold'
                        }
                      >
                        CAISSE
                      </span>
                      {renderSortIcon('caisse')}
                    </div>
                  </th>
                )}

                {/* MOTIF Column - Sortable */}
                <th
                  onClick={() => handleSort('motif')}
                  className="py-3 px-4 cursor-pointer select-none group hover:bg-teal-50/60 transition-colors"
                  title="Cliquer pour trier par motif"
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span
                      className={
                        sortField === 'motif'
                          ? 'text-teal-900 font-extrabold'
                          : 'text-gray-500 group-hover:text-gray-900 font-semibold'
                      }
                    >
                      MOTIF
                    </span>
                    {renderSortIcon('motif')}
                  </div>
                </th>

                {/* MONTANT Column - Sortable */}
                <th
                  onClick={() => handleSort('montant')}
                  className="py-3 px-4 text-right cursor-pointer select-none group hover:bg-teal-50/60 transition-colors"
                  title="Cliquer pour trier par montant"
                >
                  <div className="inline-flex items-center justify-end gap-1.5 w-full">
                    <span
                      className={
                        sortField === 'montant'
                          ? 'text-teal-900 font-extrabold'
                          : 'text-gray-500 group-hover:text-gray-900 font-semibold'
                      }
                    >
                      MONTANT
                    </span>
                    {renderSortIcon('montant')}
                  </div>
                </th>

                {/* RESPONSABLE Column - Sortable */}
                <th
                  onClick={() => handleSort('responsable')}
                  className="py-3 px-4 cursor-pointer select-none group hover:bg-teal-50/60 transition-colors"
                  title="Cliquer pour trier par responsable"
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span
                      className={
                        sortField === 'responsable'
                          ? 'text-teal-900 font-extrabold'
                          : 'text-gray-500 group-hover:text-gray-900 font-semibold'
                      }
                    >
                      RESPONSABLE
                    </span>
                    {renderSortIcon('responsable')}
                  </div>
                </th>

                {isAdmin && <th className="py-3 px-4 text-center">ACTION</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={(filterCaisseId === 'all' ? 6 : 5) + (isAdmin ? 2 : 0)}
                    className="py-12 text-center text-gray-400 italic"
                  >
                    Aucune transaction trouvée pour ces critères.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const caisse = caisses.find((c) => c.id === tx.caisseId);
                  const isEntree = tx.type === 'entree';
                  const isSelected = selectedTxIds.has(tx.id);

                  return (
                    <tr
                      key={tx.id}
                      className={`transition ${
                        isSelected ? 'bg-teal-50/70' : 'hover:bg-gray-50/70'
                      }`}
                    >
                      {/* Checkbox - Admin only */}
                      {isAdmin && (
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(tx.id)}
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 border-gray-300 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Date */}
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {tx.date}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isEntree
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-orange-50 text-orange-600'
                          }`}
                        >
                          {isEntree ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          <span>{isEntree ? 'Entrée' : 'Sortie'}</span>
                        </span>
                      </td>

                      {/* Caisse (if all) */}
                      {filterCaisseId === 'all' && (
                        <td className="py-3 px-4 text-gray-700 font-medium whitespace-nowrap">
                          {caisse?.nom || 'Caisse'}
                        </td>
                      )}

                      {/* Motif */}
                      <td className="py-3 px-4 font-medium text-gray-900 max-w-xs truncate">
                        {tx.motif || '—'}
                      </td>

                      {/* Montant */}
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                          isEntree ? 'text-emerald-600' : 'text-orange-600'
                        }`}
                      >
                        {isEntree ? '+' : '-'}
                        {formatAr(tx.montant)}
                      </td>

                      {/* Responsable */}
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {tx.responsable || ''}
                      </td>

                      {/* Action buttons (Admin only: Edit and Delete) */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onOpenEditTransactionModal(tx)}
                              className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded transition cursor-pointer"
                              title="Modifier la transaction (Administrateur)"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm('Supprimer cette transaction ?')) {
                                  onDeleteTransaction(tx.id);
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                              title="Supprimer la transaction (Administrateur)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div>
              Affichage de {(currentPage - 1) * pageSize + 1} à{' '}
              {Math.min(currentPage * pageSize, filteredTransactions.length)} sur{' '}
              {filteredTransactions.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
