import React from 'react';
import { Wallet, Plus, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { Caisse, Transaction, User } from '../types/caisse';

interface CaissesViewProps {
  caisses: Caisse[];
  transactions: Transaction[];
  currentUser: User;
  onOpenNewCaisseModal: () => void;
  onOpenEditCaisseModal: (caisse: Caisse) => void;
  onDeleteCaisse: (caisseId: string) => void;
  onSelectCaisseForTransactions: (caisseId: string) => void;
}

export const CaissesView: React.FC<CaissesViewProps> = ({
  caisses,
  transactions,
  currentUser,
  onOpenNewCaisseModal,
  onOpenEditCaisseModal,
  onDeleteCaisse,
  onSelectCaisseForTransactions,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const formatAr = (val: number) => {
    return (
      new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val) + ' AR'
    );
  };

  const getBorderColorClass = (index: number) => {
    const colors = [
      'border-t-blue-500',
      'border-t-indigo-600',
      'border-t-amber-500',
      'border-t-emerald-500',
      'border-t-purple-500',
    ];
    return colors[index % colors.length];
  };

  const getIconColorClass = (index: number) => {
    const colors = [
      'bg-blue-100 text-blue-600',
      'bg-indigo-100 text-indigo-600',
      'bg-amber-100 text-amber-600',
      'bg-emerald-100 text-emerald-600',
      'bg-purple-100 text-purple-600',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Caisses
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Gérez vos caisses et leurs soldes
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={onOpenNewCaisseModal}
            className="inline-flex items-center gap-2 bg-[#00897b] hover:bg-[#00796b] text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Caisse</span>
          </button>
        )}
      </div>

      {/* Grid of Caisses */}
      {caisses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <Wallet className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-700">Aucune caisse disponible</h3>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            {isAdmin
              ? 'Cliquez sur "+ Nouvelle Caisse" pour créer votre première caisse.'
              : 'Aucune caisse ne vous a été assignée par l’administrateur.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {caisses.map((caisse, idx) => {
            const caisseTxs = transactions.filter((t) => t.caisseId === caisse.id);
            const totalEntrees = caisseTxs
              .filter((t) => t.type === 'entree')
              .reduce((sum, t) => sum + t.montant, 0);
            const totalSorties = caisseTxs
              .filter((t) => t.type === 'sortie')
              .reduce((sum, t) => sum + t.montant, 0);
            const soldeActuel = (caisse.soldeInitial || 0) + totalEntrees - totalSorties;

            const userPermission = currentUser.role === 'admin'
              ? 'write'
              : currentUser.caissePermissions?.[caisse.id] || 'none';

            return (
              <div
                key={caisse.id}
                className={`bg-white rounded-2xl border border-gray-100 shadow-xs border-t-4 ${getBorderColorClass(
                  idx
                )} p-5 flex flex-col justify-between hover:shadow-md transition`}
              >
                <div>
                  {/* Top Caisse Info */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${getIconColorClass(
                          idx
                        )}`}
                      >
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 leading-snug">
                            {caisse.nom}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                          <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {caisse.devise || 'AR'}
                          </span>
                          {userPermission === 'read' && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              Lecture seule
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onOpenEditCaisseModal(caisse)}
                          title="Modifier la caisse"
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteCaisse(caisse.id)}
                          title="Supprimer la caisse"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mb-4 min-h-[18px]">
                    {caisse.description || caisse.nom}
                  </p>

                  {/* Financial Stats */}
                  <div className="space-y-2 pt-3 border-t border-gray-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 font-semibold">Solde actuel</span>
                      <span className="font-extrabold text-gray-900 text-base">
                        {formatAr(soldeActuel)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-500">
                      <span>Solde initial</span>
                      <span className="font-medium text-gray-700">
                        {formatAr(caisse.soldeInitial || 0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-500">
                      <span>Total entrées</span>
                      <span className="font-medium text-emerald-600">
                        +{formatAr(totalEntrees)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-500">
                      <span>Total sorties</span>
                      <span className="font-medium text-orange-600">
                        -{formatAr(totalSorties)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-500 pt-1 border-t border-gray-50">
                      <span>Transactions</span>
                      <span className="font-semibold text-gray-800">
                        {caisseTxs.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Button matching screenshot */}
                <div className="pt-5 mt-4">
                  <button
                    onClick={() => onSelectCaisseForTransactions(caisse.id)}
                    className="w-full py-2.5 px-4 bg-gray-50 hover:bg-teal-50 text-gray-700 hover:text-teal-800 text-xs font-semibold rounded-xl transition text-center cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Voir les transactions</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
