import React from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Plus,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { Caisse, Transaction, User } from '../types/caisse';

interface DashboardViewProps {
  caisses: Caisse[];
  transactions: Transaction[];
  currentUser: User;
  onNavigateTab: (tab: any) => void;
  onSelectCaisseForTransactions: (caisseId: string) => void;
  onOpenNewCaisseModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  caisses,
  transactions,
  currentUser,
  onNavigateTab,
  onSelectCaisseForTransactions,
  onOpenNewCaisseModal,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [selectedDashboardCaisseId, setSelectedDashboardCaisseId] = React.useState<string>('all');

  // Calculate balances per caisse
  const caisseStats = caisses.map((caisse) => {
    const caisseTxs = transactions.filter((t) => t.caisseId === caisse.id);
    const totalEntrees = caisseTxs
      .filter((t) => t.type === 'entree')
      .reduce((sum, t) => sum + t.montant, 0);
    const totalSorties = caisseTxs
      .filter((t) => t.type === 'sortie')
      .reduce((sum, t) => sum + t.montant, 0);
    const soldeInitial = caisse.soldeInitial || 0;
    const soldeActuel = soldeInitial + totalEntrees - totalSorties;
    const fluxNet = totalEntrees - totalSorties;
    return {
      caisse,
      soldeInitial,
      soldeActuel,
      totalEntrees,
      totalSorties,
      fluxNet,
      count: caisseTxs.length,
    };
  });

  const activeCaisseStat = selectedDashboardCaisseId !== 'all'
    ? caisseStats.find((cs) => cs.caisse.id === selectedDashboardCaisseId)
    : null;

  // Active / Selected calculations
  const displaySoldeTotal = activeCaisseStat
    ? activeCaisseStat.soldeActuel
    : caisseStats.reduce((sum, cs) => sum + cs.soldeActuel, 0);

  const displaySoldeInitial = activeCaisseStat
    ? activeCaisseStat.soldeInitial
    : caisseStats.reduce((sum, cs) => sum + cs.soldeInitial, 0);

  const displayEntrees = activeCaisseStat
    ? activeCaisseStat.totalEntrees
    : transactions.filter((t) => t.type === 'entree').reduce((sum, t) => sum + t.montant, 0);

  const displaySorties = activeCaisseStat
    ? activeCaisseStat.totalSorties
    : transactions.filter((t) => t.type === 'sortie').reduce((sum, t) => sum + t.montant, 0);

  const displayFluxNet = displayEntrees - displaySorties;

  const activeCaissesCount = caisses.filter((c) => c.statut === 'active').length;

  const formatAr = (val: number) => {
    return (
      new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val) + ' AR'
    );
  };

  const filteredTransactions = selectedDashboardCaisseId === 'all'
    ? transactions
    : transactions.filter((t) => t.caisseId === selectedDashboardCaisseId);

  const recentTransactions = [...filteredTransactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Tableau de bord
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Vue d'ensemble et solde des caisses
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Caisse Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
            <Wallet className="w-4 h-4 text-teal-600 shrink-0" />
            <select
              value={selectedDashboardCaisseId}
              onChange={(e) => setSelectedDashboardCaisseId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Toutes les caisses ({caisses.length})</option>
              {caisses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <button
              onClick={onOpenNewCaisseModal}
              className="inline-flex items-center gap-2 bg-[#00897b] hover:bg-[#00796b] text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle caisse</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Solde Actuel Total */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1.5 rounded-lg bg-teal-600 text-white">
                  <Wallet className="w-4 h-4" />
                </span>
                <span>SOLDE ACTUEL</span>
              </span>
              {activeCaisseStat && (
                <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-medium">
                  {activeCaisseStat.caisse.nom}
                </span>
              )}
            </div>
            <div className="text-2xl font-extrabold text-teal-950 tracking-tight">
              {formatAr(displaySoldeTotal)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-50 text-[11px] text-gray-500 flex items-center justify-between">
            <span>Solde initial :</span>
            <span className="font-semibold text-gray-700">{formatAr(displaySoldeInitial)}</span>
          </div>
        </div>

        {/* Total Entrées */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <span>ENTRÉES</span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">
              {formatAr(displayEntrees)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-50 text-[11px] text-gray-500 flex items-center justify-between">
            <span>Flux brut :</span>
            <span className="font-semibold text-emerald-700">+{formatAr(displayEntrees)}</span>
          </div>
        </div>

        {/* Total Sorties */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
              <div className="p-1.5 rounded-lg bg-orange-100 text-orange-600">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <span>SORTIES</span>
            </div>
            <div className="text-2xl font-extrabold text-orange-600 tracking-tight">
              {formatAr(displaySorties)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-50 text-[11px] text-gray-500 flex items-center justify-between">
            <span>Dépenses :</span>
            <span className="font-semibold text-orange-700">-{formatAr(displaySorties)}</span>
          </div>
        </div>

        {/* Flux Net (Entrées - Sorties) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <span>FLUX NET</span>
            </div>
            <div className={`text-2xl font-extrabold tracking-tight ${
              displayFluxNet >= 0 ? 'text-gray-900' : 'text-red-600'
            }`}>
              {formatAr(displayFluxNet)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-50 text-[11px] text-gray-500 flex items-center justify-between">
            <span>Caisses actives :</span>
            <span className="font-semibold text-gray-800">
              {activeCaissesCount} / {caisses.length}
            </span>
          </div>
        </div>
      </div>

      {/* Two columns: Mes Caisses & Transactions Récentes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Mes Caisses */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h2 className="text-base font-bold text-gray-900">Mes Caisses</h2>
              <button
                onClick={() => onNavigateTab('caisses')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline cursor-pointer"
              >
                Voir tout
              </button>
            </div>

            <div className="space-y-3">
              {caisseStats.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center italic">
                  Aucune caisse assignée pour le moment.
                </p>
              ) : (
                caisseStats.map(({ caisse, soldeInitial, soldeActuel, totalEntrees, totalSorties, count }) => (
                  <div
                    key={caisse.id}
                    onClick={() => {
                      onSelectCaisseForTransactions(caisse.id);
                      onNavigateTab('transactions');
                    }}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group ${
                      selectedDashboardCaisseId === caisse.id
                        ? 'border-teal-400 bg-teal-50/50'
                        : 'border-gray-100 hover:border-teal-200 hover:bg-teal-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 group-hover:bg-teal-100 group-hover:text-teal-700 flex items-center justify-center transition">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-teal-800 transition">
                          {caisse.nom}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1 text-emerald-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                          <span>•</span>
                          <span>{count} transaction{count > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right flex flex-col sm:items-end">
                      <span className="text-sm font-extrabold text-gray-900">
                        {formatAr(soldeActuel)}
                      </span>
                      <div className="text-[10px] text-gray-400 space-x-1.5 mt-0.5">
                        <span>Init: <b className="text-gray-600 font-medium">{formatAr(soldeInitial)}</b></span>
                        <span>•</span>
                        <span className="text-emerald-600">+{formatAr(totalEntrees)}</span>
                        <span>•</span>
                        <span className="text-orange-600">-{formatAr(totalSorties)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Transactions Récentes */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h2 className="text-base font-bold text-gray-900">
                Transactions Recentes
              </h2>
              <button
                onClick={() => onNavigateTab('transactions')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline cursor-pointer"
              >
                Voir tout
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                Aucune transaction enregistree pour le moment.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentTransactions.map((tx) => {
                  const caisse = caisses.find((c) => c.id === tx.caisseId);
                  const isEntree = tx.type === 'entree';
                  return (
                    <div
                      key={tx.id}
                      className="p-2.5 rounded-xl border border-gray-50 hover:bg-gray-50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                            isEntree
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-orange-100 text-orange-600'
                          }`}
                        >
                          {isEntree ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 truncate max-w-[160px] sm:max-w-xs">
                            {tx.motif || (isEntree ? 'Entrée de fonds' : 'Sortie de fonds')}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {caisse?.nom || 'Caisse'} • {tx.date}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`font-mono font-bold ${
                          isEntree ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {isEntree ? '+' : '-'}
                        {formatAr(tx.montant)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 mt-4">
            <button
              onClick={() => onNavigateTab('transactions')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 cursor-pointer"
            >
              <span>Toutes les transactions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
