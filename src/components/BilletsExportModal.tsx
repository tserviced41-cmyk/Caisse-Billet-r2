import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  XCircle,
  Users,
  Layers,
  Filter,
  CheckSquare,
  Ticket,
} from 'lucide-react';
import { TicketItem } from '../types/caisse';
import {
  TicketExportFilter,
  filterTicketsForExport,
  exportTicketsToExcel,
  isTicketAttribue,
  getExportFilterLabel,
} from '../utils/billetExportUtils';

interface BilletsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: TicketItem[];
  selectedTicketIds?: string[];
  initialStatut?: TicketExportFilter;
  initialCampagne?: string;
  initialGroupe?: string;
  onOpenPdfReport: (filteredTickets: TicketItem[], filterStatut: TicketExportFilter, campagne: string) => void;
  showToast: (msg: string) => void;
}

export const BilletsExportModal: React.FC<BilletsExportModalProps> = ({
  isOpen,
  onClose,
  tickets,
  selectedTicketIds = [],
  initialStatut = 'tous',
  initialCampagne = 'Tous',
  initialGroupe = 'Tous',
  onOpenPdfReport,
  showToast,
}) => {
  const [selectedStatut, setSelectedStatut] = useState<TicketExportFilter>(
    selectedTicketIds.length > 0 ? 'selection' : (initialStatut as TicketExportFilter) || 'tous'
  );
  const [selectedCampagne, setSelectedCampagne] = useState<string>(initialCampagne || 'Tous');
  const [selectedGroupe, setSelectedGroupe] = useState<string>(initialGroupe || 'Tous');

  // Unique campaigns and groups
  const campagnes = useMemo(() => {
    return Array.from(new Set(tickets.map((t) => t.campagne).filter(Boolean)));
  }, [tickets]);

  const groupes = useMemo(() => {
    return Array.from(
      new Set(
        tickets
          .filter((t) => selectedCampagne === 'Tous' || t.campagne === selectedCampagne)
          .map((t) => t.groupe)
          .filter(Boolean)
      )
    );
  }, [tickets, selectedCampagne]);

  // Compute filtered tickets based on choices
  const exportTickets = useMemo(() => {
    return filterTicketsForExport(tickets, {
      filterStatut: selectedStatut,
      filterCampagne: selectedCampagne,
      filterGroupe: selectedGroupe,
      selectedTicketIds,
    });
  }, [tickets, selectedStatut, selectedCampagne, selectedGroupe, selectedTicketIds]);

  // Counts for each filter option
  const counts = useMemo(() => {
    const base = tickets.filter(
      (t) =>
        (selectedCampagne === 'Tous' || t.campagne === selectedCampagne) &&
        (selectedGroupe === 'Tous' || t.groupe === selectedGroupe)
    );
    return {
      all: base.length,
      payes: base.filter((t) => t.paye).length,
      impayes: base.filter((t) => !t.paye).length,
      attribues: base.filter(isTicketAttribue).length,
      nonAttribues: base.filter((t) => !isTicketAttribue(t)).length,
      selected: selectedTicketIds.length,
    };
  }, [tickets, selectedCampagne, selectedGroupe, selectedTicketIds]);

  // Financial summary of export scope
  const totalBillets = exportTickets.length;
  const montantAttendu = exportTickets.reduce((sum, t) => sum + (isTicketAttribue(t) ? t.prix : 0), 0);
  const montantEncaisse = exportTickets.filter((t) => t.paye).reduce((sum, t) => sum + t.prix, 0);
  const resteARecouvrer = montantAttendu - montantEncaisse;

  const formatAr = (val: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 })
      .format(val)
      .replace(/\s/g, '\u00A0');
    return `${formatted}\u00A0Ar`;
  };

  if (!isOpen) return null;

  const handleExportExcel = () => {
    if (exportTickets.length === 0) {
      alert('Aucun billet ne correspond aux critères sélectionnés.');
      return;
    }
    exportTicketsToExcel(tickets, {
      filterStatut: selectedStatut,
      filterCampagne: selectedCampagne,
      filterGroupe: selectedGroupe,
      selectedTicketIds,
    });
    showToast(`Exportation Excel de ${exportTickets.length} billet(s) effectuée avec succès.`);
    onClose();
  };

  const handleExportPdf = () => {
    if (exportTickets.length === 0) {
      alert('Aucun billet ne correspond aux critères sélectionnés.');
      return;
    }
    onOpenPdfReport(exportTickets, selectedStatut, selectedCampagne);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 text-gray-900">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between bg-teal-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center font-black shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900">
                Exporter les Billets (Excel ou PDF)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Choisissez le statut précis des billets à exporter : vendus, non vendus, distribués ou non
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* Section 1: Choose Ticket Status / Scope */}
          <div>
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2.5">
              1. Choisir les billets à exporter :
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Vendus / Payés uniquement */}
              <button
                type="button"
                onClick={() => setSelectedStatut('paye')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedStatut === 'paye'
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-400/40'
                    : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block">Vendus (Payés)</span>
                    <span className="text-[11px] text-gray-500">Uniquement payés</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800">
                  {counts.payes}
                </span>
              </button>

              {/* Non vendus / Impayés uniquement */}
              <button
                type="button"
                onClick={() => setSelectedStatut('impaye')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedStatut === 'impaye'
                    ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-400/40'
                    : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block">Non vendus (Impayés)</span>
                    <span className="text-[11px] text-gray-500">En attente de paiement</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-orange-100 text-orange-800">
                  {counts.impayes}
                </span>
              </button>

              {/* Distribués / Attribués uniquement */}
              <button
                type="button"
                onClick={() => setSelectedStatut('attribue')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedStatut === 'attribue'
                    ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-400/40'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block">Distribués uniquement</span>
                    <span className="text-[11px] text-gray-500">Attribués aux personnes</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800">
                  {counts.attribues}
                </span>
              </button>

              {/* Non distribués / Disponibles */}
              <button
                type="button"
                onClick={() => setSelectedStatut('non_attribue')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedStatut === 'non_attribue'
                    ? 'border-gray-500 bg-gray-100 ring-2 ring-gray-400/40'
                    : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center shrink-0">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block">Non distribués</span>
                    <span className="text-[11px] text-gray-500">Disponibles en stock</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-gray-200 text-gray-800">
                  {counts.nonAttribues}
                </span>
              </button>

              {/* Tous les billets */}
              <button
                type="button"
                onClick={() => setSelectedStatut('tous')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedStatut === 'tous'
                    ? 'border-teal-500 bg-teal-50/70 ring-2 ring-teal-400/40'
                    : 'border-gray-200 hover:border-teal-300 hover:bg-teal-50/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block">Tous les billets</span>
                    <span className="text-[11px] text-gray-500">Ensemble complet</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-teal-100 text-teal-800">
                  {counts.all}
                </span>
              </button>

              {/* Billets sélectionnés (si sélection active) */}
              {selectedTicketIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedStatut('selection')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedStatut === 'selection'
                      ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-400/40'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block">Sélection en cours</span>
                      <span className="text-[11px] text-gray-500">Cochés à l'écran</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800">
                    {counts.selected}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Secondary Filters (Campagne & Groupe) */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <span className="font-bold text-gray-700 block text-xs">
              2. Filtrer par campagne ou groupe (facultatif) :
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Campagne :
                </label>
                <select
                  value={selectedCampagne}
                  onChange={(e) => setSelectedCampagne(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 font-medium"
                >
                  <option value="Tous">Toutes les campagnes ({campagnes.length})</option>
                  {campagnes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Groupe :
                </label>
                <select
                  value={selectedGroupe}
                  onChange={(e) => setSelectedGroupe(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 font-medium"
                >
                  <option value="Tous">Tous les groupes ({groupes.length})</option>
                  {groupes.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Summary of Selected Export */}
          <div className="bg-teal-50/50 rounded-xl border border-teal-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-teal-900">
                Périmètre retenu : {getExportFilterLabel(selectedStatut)}
              </span>
              <span className="font-extrabold text-sm text-teal-800 bg-white px-2.5 py-0.5 rounded-lg border border-teal-200 shadow-2xs">
                {totalBillets} billet(s)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-teal-100 text-[11px]">
              <div>
                <span className="text-gray-500 block">Attendu :</span>
                <span className="font-bold text-gray-800">{formatAr(montantAttendu)}</span>
              </div>
              <div>
                <span className="text-emerald-700 block">Encaissé :</span>
                <span className="font-bold text-emerald-800">+{formatAr(montantEncaisse)}</span>
              </div>
              <div>
                <span className="text-orange-700 block">Reste dû :</span>
                <span className="font-bold text-orange-800">{formatAr(resteARecouvrer)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with the 2 Primary Export Options */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* EXCEL EXPORT BUTTON */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={totalBillets === 0}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer ${
                totalBillets === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Exporter les billets sélectionnés vers un classeur Excel complet"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exporter en Excel (.xlsx)</span>
            </button>

            {/* PDF EXPORT BUTTON */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={totalBillets === 0}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer ${
                totalBillets === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Générer le rapport PDF imprimable avec mise en page soignée"
            >
              <Printer className="w-4 h-4" />
              <span>Exporter en PDF / Imprimer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
