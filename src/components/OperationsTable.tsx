import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, ArrowUpDown, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { OperationVirement } from '../types/afb160';
import { formatRib } from '../utils/ribValidator';

interface OperationsTableProps {
  operations: OperationVirement[];
  onAdd: () => void;
  onEdit: (op: OperationVirement) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onExportExcel: () => void;
}

export const OperationsTable: React.FC<OperationsTableProps> = ({
  operations,
  onAdd,
  onEdit,
  onDelete,
  onClearAll,
  onExportExcel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<'rang' | 'nom' | 'montant'>('rang');
  const [sortAsc, setSortAsc] = useState(true);

  // Filtering
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return operations;
    const term = searchTerm.toLowerCase();
    return operations.filter((op) => {
      const fullRib = `${op.banque}${op.guichet}${op.compte}${op.cle}`.toLowerCase();
      const formatted = formatRib(op.banque, op.guichet, op.compte, op.cle).toLowerCase();
      return (
        op.nom.toLowerCase().includes(term) ||
        op.rang.toLowerCase().includes(term) ||
        fullRib.includes(term) ||
        formatted.includes(term) ||
        (op.libelle && op.libelle.toLowerCase().includes(term)) ||
        String(op.montant).includes(term)
      );
    });
  }, [operations, searchTerm]);

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortField === 'rang') {
        const diff = a.rang.localeCompare(b.rang, undefined, { numeric: true });
        return sortAsc ? diff : -diff;
      }
      if (sortField === 'montant') {
        return sortAsc ? a.montant - b.montant : b.montant - a.montant;
      }
      if (sortField === 'nom') {
        return sortAsc ? a.nom.localeCompare(b.nom) : b.nom.localeCompare(a.nom);
      }
      return 0;
    });
  }, [filtered, sortField, sortAsc]);

  // Pagination
  const totalPages = pageSize === -1 ? 1 : Math.ceil(sorted.length / pageSize) || 1;
  const paginated = useMemo(() => {
    if (pageSize === -1) return sorted;
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const toggleSort = (field: 'rang' | 'nom' | 'montant') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="mt-4">
      {/* Table Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 pb-2 border-b border-teal-600/50">
        <div className="flex items-center gap-2">
          <span className="text-white text-base sm:text-lg font-bold flex items-center gap-2">
            🗂️ Liste des opérations demandées
          </span>
          <span className="bg-white/20 text-teal-100 text-xs px-2 py-0.5 rounded-full font-semibold">
            {operations.length} {operations.length > 1 ? 'opérations' : 'opération'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {operations.length > 0 && (
            <>
              <button
                onClick={onExportExcel}
                className="text-xs bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                title="Exporter la liste actuelle en fichier Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-200" />
                <span>Exporter Excel</span>
              </button>

              <button
                onClick={onClearAll}
                className="text-xs bg-red-900/40 hover:bg-red-800/60 text-red-100 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                title="Vider la liste des opérations"
              >
                Vider tout
              </button>
            </>
          )}

          {/* + Ajouter button as in screenshot */}
          <button
            onClick={onAdd}
            className="flex items-center gap-1 font-bold text-white hover:text-teal-200 text-sm bg-teal-800/90 hover:bg-teal-700/90 px-3 py-1.5 rounded transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 font-bold" />
            <span>Ajouter</span>
          </button>
        </div>
      </div>

      {/* Filter and Page Size Controls */}
      {operations.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs text-teal-100">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-teal-300" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Rechercher par nom, RIB, montant..."
              className="w-full bg-white/10 border border-teal-500/30 text-white placeholder-teal-200/60 pl-8 pr-3 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-teal-300"
            />
          </div>

          <div className="flex items-center gap-2">
            <span>Afficher :</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white text-gray-800 rounded px-2 py-1 text-xs border border-teal-400 focus:outline-none"
            >
              <option value={15}>15 lignes</option>
              <option value={25}>25 lignes</option>
              <option value={50}>50 lignes</option>
              <option value={100}>100 lignes</option>
              <option value={-1}>Toutes</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-x-auto rounded-md shadow border border-teal-700/40 bg-white">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-[#007684] text-white select-none">
              <th
                onClick={() => toggleSort('rang')}
                className="py-2.5 px-3 font-semibold border-r border-teal-600/40 cursor-pointer hover:bg-[#006571] w-20 text-center"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Rang</span>
                  <ArrowUpDown className="w-3 h-3 opacity-70" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold border-r border-teal-600/40">
                N° RIB Bénéficiaire
              </th>
              <th
                onClick={() => toggleSort('nom')}
                className="py-2.5 px-3 font-semibold border-r border-teal-600/40 cursor-pointer hover:bg-[#006571]"
              >
                <div className="flex items-center gap-1">
                  <span>Noms</span>
                  <ArrowUpDown className="w-3 h-3 opacity-70" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold border-r border-teal-600/40">
                Libellé de l'opération
              </th>
              <th
                onClick={() => toggleSort('montant')}
                className="py-2.5 px-3 font-semibold border-r border-teal-600/40 text-right cursor-pointer hover:bg-[#006571] w-36"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Montant (MGA)</span>
                  <ArrowUpDown className="w-3 h-3 opacity-70" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold text-center w-28">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {operations.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 italic bg-white">
                  Veuillez cliquer sur le lien "
                  <button
                    onClick={onAdd}
                    className="text-teal-700 font-semibold hover:underline cursor-pointer"
                  >
                    + Ajouter
                  </button>
                  " pour ajouter une opération...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 italic bg-white">
                  Aucun résultat ne correspond à votre recherche "{searchTerm}".
                </td>
              </tr>
            ) : (
              paginated.map((op, idx) => {
                const formattedRib = formatRib(op.banque, op.guichet, op.compte, op.cle);
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={op.id}
                    className={`transition-colors hover:bg-teal-50/80 ${
                      isEven ? 'bg-[#f0f9fa]' : 'bg-white'
                    }`}
                  >
                    {/* Rang */}
                    <td className="py-2 px-3 text-center font-mono font-medium text-gray-700 border-r border-gray-100">
                      {op.rang}
                    </td>

                    {/* RIB */}
                    <td className="py-2 px-3 font-mono font-medium text-gray-800 border-r border-gray-100 whitespace-nowrap">
                      {formattedRib}
                    </td>

                    {/* Nom */}
                    <td className="py-2 px-3 font-medium text-gray-900 border-r border-gray-100">
                      {op.nom}
                    </td>

                    {/* Libelle */}
                    <td className="py-2 px-3 text-gray-700 border-r border-gray-100 max-w-xs truncate">
                      {op.libelle}
                    </td>

                    {/* Montant */}
                    <td className="py-2 px-3 text-right font-mono font-bold text-gray-900 border-r border-gray-100 whitespace-nowrap">
                      {formatAmount(op.montant)}
                    </td>

                    {/* Actions Edit | Del matching Screenshot 2 */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-teal-700 font-medium">
                        <button
                          onClick={() => onEdit(op)}
                          className="flex items-center gap-0.5 hover:text-teal-900 hover:underline cursor-pointer"
                          title="Modifier cette opération"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => onDelete(op.id)}
                          className="flex items-center gap-0.5 text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                          title="Supprimer cette opération"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Del</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-teal-100">
          <div>
            Affichage de {(currentPage - 1) * pageSize + 1} à{' '}
            {Math.min(currentPage * pageSize, sorted.length)} sur {sorted.length} opérations
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
