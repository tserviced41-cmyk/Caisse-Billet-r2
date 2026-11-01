import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  Users,
  Plus,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  XCircle,
  Layers,
  DollarSign,
  User as UserIcon,
  Phone,
  Shield,
  Eye,
  RotateCcw,
  RefreshCw,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Download,
  CheckCheck,
} from 'lucide-react';
import { Caisse, User, BilletsPermissionLevel } from '../types/caisse';
import { api } from '../utils/api';
import { TicketPrintModal } from './TicketPrintModal';
import { BilletsReportModal } from './BilletsReportModal';
import { BilletsExcelImportModal, ImportMergeMode, isNonAttribueText } from './BilletsExcelImportModal';
import { BilletsExportModal } from './BilletsExportModal';
import { exportTicketsToExcel, TicketExportFilter } from '../utils/billetExportUtils';

import type { TicketItem } from '../types/caisse';
export type { TicketItem };

interface BilletsViewProps {
  currentUser: User;
  caisses?: Caisse[];
  showToast: (msg: string) => void;
}

export const BilletsView: React.FC<BilletsViewProps> = ({
  currentUser,
  showToast,
}) => {
  // Permission calculation
  const isAdmin = currentUser.role === 'admin';
  const permission: BilletsPermissionLevel = isAdmin ? 'write' : (currentUser.billetsPermission || 'none');
  const canWrite = isAdmin || permission === 'write';
  const canDeleteOrModify = isAdmin;
  const isReadOnly = !isAdmin && permission === 'read';
  const canPrintBillets = isAdmin || Boolean(currentUser.canPrintBillets);

  // State for tickets (pure server-side source of truth, no stale localStorage override)
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Load from server with offline cache fallback
  const loadTickets = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const data = await api.getTickets();
      if (Array.isArray(data)) {
        setTickets(data);
        try {
          localStorage.setItem('caisse_tickets_offline_backup', JSON.stringify({ timestamp: Date.now(), tickets: data }));
        } catch {}
      }
    } catch (err) {
      console.warn('Erreur chargement billets, tentative cache hors ligne:', err);
      try {
        const cached = localStorage.getItem('caisse_tickets_offline_backup');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.tickets) && parsed.tickets.length > 0) {
            setTickets(parsed.tickets);
          }
        }
      } catch {}
    } finally {
      setIsLoading(false);
      if (showSpinner) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Purge legacy storage key
    try {
      localStorage.removeItem('gestion_caisse_billets');
    } catch {}

    loadTickets(false);

    // Auto-sync listener for multi-device updates
    const handleSync = () => {
      loadTickets(false);
    };

    window.addEventListener('caisse:data-synced', handleSync);
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      window.removeEventListener('caisse:data-synced', handleSync);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [loadTickets]);

  // Helper to update tickets locally and on server
  const updateAndSyncTickets = async (newTickets: TicketItem[], reason?: string) => {
    setTickets(newTickets);
    try {
      localStorage.setItem('caisse_tickets_offline_backup', JSON.stringify({ timestamp: Date.now(), tickets: newTickets }));
    } catch {}
    try {
      await api.syncTickets(newTickets, reason);
    } catch (err: any) {
      console.warn('Erreur lors de la synchronisation serveur des billets:', err);
      if (showToast) showToast('Erreur de synchronisation avec le serveur');
      // Reload freshest tickets from server on failure
      loadTickets(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'liste' | 'lots' | 'personnes' | 'groupes' | 'rapport'>('liste');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCampagne, setFilterCampagne] = useState('Tous');
  const [filterGroupe, setFilterGroupe] = useState('Tous');
  const [filterStatut, setFilterStatut] = useState<'tous' | 'paye' | 'impaye' | 'attribue' | 'non_attribue'>('tous');

  // Multi-selection state
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);

  // New Campaign / Batch Generation Modal state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [genCampagne, setGenCampagne] = useState('Opération Soupe 2026');
  const [genStartNum, setGenStartNum] = useState(1);
  const [genEndNum, setGenEndNum] = useState(500);
  const [genPrix, setGenPrix] = useState(10000);
  const [genGroupe, setGenGroupe] = useState('Groupe Général');

  // Edit / Assign Modal state
  const [selectedTicketForEdit, setSelectedTicketForEdit] = useState<TicketItem | null>(null);
  const [editBeneficiaire, setEditBeneficiaire] = useState('');
  const [editGroupe, setEditGroupe] = useState('');
  const [editTelephone, setEditTelephone] = useState('');
  const [editPaye, setEditPaye] = useState(false);

  // Batch Assignment Modal
  const [isBatchAssignOpen, setIsBatchAssignOpen] = useState(false);
  const [batchStart, setBatchStart] = useState(1);
  const [batchEnd, setBatchEnd] = useState(50);
  const [batchGroupe, setBatchGroupe] = useState('Groupe 1');
  const [batchBeneficiaire, setBatchBeneficiaire] = useState('');
  const [batchTelephone, setBatchTelephone] = useState('');
  const [batchPaye, setBatchPaye] = useState(false);
  const [isTicketPrintModalOpen, setIsTicketPrintModalOpen] = useState(false);
  const [isBilletsReportModalOpen, setIsBilletsReportModalOpen] = useState(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [reportModalStatut, setReportModalStatut] = useState<'tous' | 'paye' | 'impaye' | 'attribue' | 'non_attribue' | 'selection'>('tous');
  const [reportModalCampagne, setReportModalCampagne] = useState<string>('Tous');

  const handleOpenExportModal = (statut?: TicketExportFilter) => {
    if (statut) {
      setReportModalStatut(statut as any);
    } else {
      setReportModalStatut(filterStatut);
    }
    setIsExportModalOpen(true);
  };

  const handleOpenPdfReport = (
    _filteredList: TicketItem[],
    statut: TicketExportFilter,
    campagne: string
  ) => {
    setReportModalStatut(statut as any);
    setReportModalCampagne(campagne);
    setIsBilletsReportModalOpen(true);
  };

  const handleDirectExportExcel = (statut?: TicketExportFilter) => {
    const targetStatut = statut || (selectedTicketIds.length > 0 ? 'selection' : (filterStatut as any));
    exportTicketsToExcel(tickets, {
      filterStatut: targetStatut,
      filterCampagne: filterCampagne,
      filterGroupe: filterGroupe,
      selectedTicketIds,
    });
    if (showToast) showToast('Exportation Excel générée avec succès.');
  };

  const handleExcelImportConfirm = async (
    importedTickets: TicketItem[],
    mode: ImportMergeMode,
    stats: {
      total: number;
      payes: number;
      impayes: number;
      distribues: number;
      nonDistribues: number;
    }
  ) => {
    let updated = [...tickets];
    const existingMap = new Map<string, TicketItem>();
    updated.forEach((t) => {
      existingMap.set(`${t.numero}_${t.campagne.trim().toLowerCase()}`, t);
    });

    let addedCount = 0;
    let updatedCount = 0;

    importedTickets.forEach((imp) => {
      const key = `${imp.numero}_${imp.campagne.trim().toLowerCase()}`;
      if (existingMap.has(key)) {
        const existing = existingMap.get(key)!;
        if (mode === 'overwrite') {
          const idx = updated.findIndex((t) => t.id === existing.id);
          if (idx >= 0) {
            updated[idx] = {
              ...existing,
              ...imp,
              id: existing.id,
              // Strictly enforce imported values
              paye: Boolean(imp.paye),
              beneficiaire: imp.beneficiaire ? imp.beneficiaire.trim() : '',
              telephone: imp.beneficiaire ? imp.telephone.trim() : '',
              dateAttribution: imp.beneficiaire
                ? imp.dateAttribution || existing.dateAttribution || new Date().toISOString().split('T')[0]
                : '',
              groupe: imp.groupe || existing.groupe,
              prix: imp.prix || existing.prix,
              session: imp.session || existing.session,
            };
            updatedCount++;
          }
        } else if (mode === 'status_only') {
          const idx = updated.findIndex((t) => t.id === existing.id);
          if (idx >= 0) {
            updated[idx] = {
              ...existing,
              // Strictly update payment and distribution status
              paye: Boolean(imp.paye),
              beneficiaire: imp.beneficiaire ? imp.beneficiaire.trim() : '',
              telephone: imp.beneficiaire ? imp.telephone.trim() : '',
              dateAttribution: imp.beneficiaire
                ? imp.dateAttribution || existing.dateAttribution || new Date().toISOString().split('T')[0]
                : '',
            };
            updatedCount++;
          }
        }
        // if mode === 'skip', do not modify existing tickets
      } else {
        updated.push(imp);
        addedCount++;
      }
    });

    await updateAndSyncTickets(
      updated,
      `Import Excel : ${updatedCount} mis à jour, ${addedCount} créés (${stats.payes} payés, ${stats.distribues} distribués)`
    );
    showToast(
      `Importation réussie : ${updatedCount} mis à jour, ${addedCount} créés (${stats.payes} payés, ${stats.distribues} distribués).`
    );
  };

  const [selectedPersonForDetail, setSelectedPersonForDetail] = useState<{
    name: string;
    groupe: string;
    telephone: string;
    billets: TicketItem[];
    totalDu: number;
    totalPaye: number;
  } | null>(null);
  const [expandedPersonNames, setExpandedPersonNames] = useState<Set<string>>(new Set());

  const toggleExpandPerson = (personName: string) => {
    setExpandedPersonNames((prev) => {
      const next = new Set(prev);
      if (next.has(personName)) {
        next.delete(personName);
      } else {
        next.add(personName);
      }
      return next;
    });
  };


  // If user has 'none' permission, display Access Denied
  if (!isAdmin && permission === 'none') {
    return (
      <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center max-w-lg mx-auto shadow-xs space-y-3">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <Ticket className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Accès restreint</h2>
        <p className="text-xs text-gray-500">
          Vous n'avez pas l'autorisation d'accéder au module de Gestion des Billets. Veuillez contacter un administrateur pour configurer vos droits.
        </p>
      </div>
    );
  }

  // Check if a ticket is genuinely attributed/distributed (not empty and not a placeholder)
  const isTicketAttribue = (t: TicketItem) => {
    return Boolean(t.beneficiaire && t.beneficiaire.trim() !== '' && !isNonAttribueText(t.beneficiaire));
  };

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.beneficiaire.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.groupe.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.numero.toString().includes(searchTerm) ||
      t.telephone.includes(searchTerm);
    const matchesCampagne = filterCampagne === 'Tous' || t.campagne === filterCampagne;
    const matchesGroupe = filterGroupe === 'Tous' || t.groupe === filterGroupe;
    const isAttr = isTicketAttribue(t);
    const matchesStatut =
      filterStatut === 'tous' ||
      (filterStatut === 'paye' && t.paye) ||
      (filterStatut === 'impaye' && !t.paye) ||
      (filterStatut === 'attribue' && isAttr) ||
      (filterStatut === 'non_attribue' && !isAttr);
    return matchesSearch && matchesCampagne && matchesGroupe && matchesStatut;
  });

  const campagnes = Array.from(new Set(tickets.map((t) => t.campagne)));
  const groupes = Array.from(
    new Set(tickets.map((t) => (t.campagne === filterCampagne || filterCampagne === 'Tous' ? t.groupe : '')))
  );

  // Statistics
  const totalBilletsCount = tickets.length;
  const totalAttribues = tickets.filter(isTicketAttribue).length;
  const totalPayes = tickets.filter((t) => t.paye).length;
  const totalMontantAttendu = tickets.reduce((sum, t) => sum + (isTicketAttribue(t) ? t.prix : 0), 0);
  const totalMontantEncaisse = tickets.filter((t) => t.paye).reduce((sum, t) => sum + t.prix, 0);

  // Selection handlers (Admin only)
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canDeleteOrModify) return;
    if (e.target.checked) {
      setSelectedTicketIds(filteredTickets.map((t) => t.id));
    } else {
      setSelectedTicketIds([]);
    }
  };

  const handleToggleSelectTicket = (id: string) => {
    if (!canDeleteOrModify) return;
    setSelectedTicketIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchDeleteSelected = async () => {
    if (!canDeleteOrModify) {
      alert('Action réservée à l’administrateur.');
      return;
    }
    if (selectedTicketIds.length === 0) return;
    if (confirm(`Voulez-vous vraiment supprimer les ${selectedTicketIds.length} billets sélectionnés ?`)) {
      try {
        const count = await api.batchDeleteTickets(selectedTicketIds);
        const idsSet = new Set(selectedTicketIds);
        setTickets((prev) => prev.filter((t) => !idsSet.has(t.id)));
        setSelectedTicketIds([]);
        showToast(`${count} billet(s) supprimé(s) avec succès.`);
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression groupée');
      }
    }
  };

  // Atomic batch toggle payment for selected tickets
  const handleBatchToggleSelectedPaye = async (paye: boolean) => {
    if (!canWrite) return;
    if (selectedTicketIds.length === 0) return;
    setIsProcessingBatch(true);
    const idsSet = new Set(selectedTicketIds);
    // Optimistic local update
    setTickets((prev) => {
      const updated = prev.map((t) => (idsSet.has(t.id) ? { ...t, paye } : t));
      try {
        localStorage.setItem('caisse_tickets_offline_backup', JSON.stringify({ timestamp: Date.now(), tickets: updated }));
      } catch {}
      return updated;
    });

    try {
      const res = await api.batchToggleTicketsPaye(selectedTicketIds, paye);
      showToast(
        `${res.updatedCount} billet(s) marqués comme ${paye ? 'Payés' : 'Impayés'}. Total : ${res.totalPaid} payés (${res.totalAmount.toLocaleString('fr-FR')} Ar).`
      );
      setSelectedTicketIds([]);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la mise à jour groupée');
      await loadTickets(false);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Generation handler
  const handleGenerateTickets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    if (genStartNum > genEndNum) {
      alert('Le numéro de début doit être inférieur ou égal au numéro de fin.');
      return;
    }
    try {
      const res = await api.generateTickets({
        campagne: genCampagne,
        startNum: genStartNum,
        endNum: genEndNum,
        prix: genPrix,
        groupe: genGroupe,
      });
      await loadTickets(false);
      setIsGenerateModalOpen(false);
      showToast(`${res.count} billet(s) généré(s) avec succès.`);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la génération des billets');
    }
  };

  // Batch assign handler
  const handleBatchAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    try {
      const res = await api.batchAssignTickets({
        start: batchStart,
        end: batchEnd,
        groupe: batchGroupe,
        beneficiaire: batchBeneficiaire,
        telephone: batchTelephone,
        paye: batchPaye,
        campagne: filterCampagne,
      });
      await loadTickets(false);
      setIsBatchAssignOpen(false);
      showToast(`${res.updatedCount} billet(s) mis à jour avec succès.`);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’attribution groupée');
    }
  };

  // Save single ticket edit
  const handleSaveSingleTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !selectedTicketForEdit) return;
    try {
      const res = await api.updateTicket(selectedTicketForEdit.id, {
        beneficiaire: editBeneficiaire,
        groupe: editGroupe,
        telephone: editTelephone,
        paye: editPaye,
      });
      if (res?.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketForEdit.id ? res.ticket : t))
        );
      }
      setSelectedTicketForEdit(null);
      showToast('Billet mis à jour avec succès.');
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la modification du billet');
    }
  };

  // Delete ticket (Admin only)
  const handleDeleteTicket = async (id: string) => {
    if (!canDeleteOrModify) {
      alert('La suppression des billets est réservée à l’administrateur.');
      return;
    }
    if (confirm('Voulez-vous vraiment supprimer ce billet ?')) {
      try {
        await api.deleteTicket(id);
        setTickets((prev) => prev.filter((t) => t.id !== id));
        setSelectedTicketIds((prev) => prev.filter((item) => item !== id));
        showToast('Billet supprimé avec succès.');
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression');
      }
    }
  };

  // Toggle paye (Tickets and Caisses are strictly distinct - no transaction created)
  const handleTogglePaye = async (id: string) => {
    if (!canWrite) return;
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;
    const newPaye = !ticket.paye;

    // Optimistic local update
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, paye: newPaye } : t))
    );

    try {
      const res = await api.updateTicket(id, { paye: newPaye });
      if (res?.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === id ? res.ticket : t))
        );
      }
      showToast(newPaye ? `Billet n°${ticket.numero} marqué comme payé` : `Billet n°${ticket.numero} marqué comme impayé`);
    } catch (err: any) {
      // Revert if request failed
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, paye: !newPaye } : t))
      );
      showToast(err.message || 'Erreur lors de la mise à jour du billet');
    }
  };

  // Group by Person
  const personsMap = new Map<
    string,
    { name: string; groupe: string; telephone: string; billets: TicketItem[]; totalDu: number; totalPaye: number }
  >();
  tickets.forEach((t) => {
    if (!isTicketAttribue(t)) return;
    const key = t.beneficiaire.trim().toLowerCase();
    if (!personsMap.has(key)) {
      personsMap.set(key, {
        name: t.beneficiaire.trim(),
        groupe: t.groupe || '—',
        telephone: t.telephone || '',
        billets: [],
        totalDu: 0,
        totalPaye: 0,
      });
    }
    const p = personsMap.get(key)!;
    p.billets.push(t);
    p.totalDu += t.prix;
    if (t.paye) p.totalPaye += t.prix;
  });
  const allPersonsList = Array.from(personsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  // Filtered persons list using search (matches name, group, phone, or ticket number)
  const personsList = allPersonsList.filter((p) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.groupe.toLowerCase().includes(q) ||
      p.telephone.includes(q) ||
      p.billets.some((b) => b.numero.toString().includes(q))
    );
  });

  // Group by Group name
  const groupesMap = new Map<
    string,
    { groupe: string; totalBillets: number; attribues: number; payes: number; montantTotal: number; montantPaye: number }
  >();
  tickets.forEach((t) => {
    const gName = t.groupe || 'Indéfini';
    if (!groupesMap.has(gName)) {
      groupesMap.set(gName, {
        groupe: gName,
        totalBillets: 0,
        attribues: 0,
        payes: 0,
        montantTotal: 0,
        montantPaye: 0,
      });
    }
    const g = groupesMap.get(gName)!;
    g.totalBillets += 1;
    if (isTicketAttribue(t)) g.attribues += 1;
    if (t.paye) {
      g.payes += 1;
      g.montantPaye += t.prix;
    }
    g.montantTotal += t.prix;
  });
  const allGroupesList = Array.from(groupesMap.values()).sort((a, b) => a.groupe.localeCompare(b.groupe, 'fr'));
  const groupesList = allGroupesList.filter((g) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return g.groupe.toLowerCase().includes(q);
  });

  const formatAr = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(val) + ' Ar';
  };

  const handlePrintReport = () => {
    setIsBilletsReportModalOpen(true);
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0">


      {/* Permission Notices */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs no-print shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded">
              Lecture seule
            </span>
            <span>
              Vous consultez les billets en mode lecture. La génération, modification, distribution et suppression sont restreintes.
            </span>
          </div>
        </div>
      )}

      {canWrite && !canDeleteOrModify && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs no-print shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded">
              Lecture & Distribution
            </span>
            <span>
              Vous pouvez générer des billets, faire la distribution par lot et pointer les paiements. La modification structurelle et la suppression sont réservées à l'administrateur.
            </span>
          </div>
        </div>
      )}

      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-gray-100 no-print">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">Gestion des Billets & Opérations</h1>
              <p className="text-sm text-gray-500">
                Impression, distribution par lot/groupe, suivi des paiements et rapports détaillés par personne.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canWrite && (
            <>
              <button
                onClick={() => setIsGenerateModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Générer des Billets</span>
              </button>
              <button
                onClick={() => setIsBatchAssignOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Distribution par Lot</span>
              </button>
              <button
                onClick={() => setIsExcelImportModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importer Excel</span>
              </button>
            </>
          )}
          {canPrintBillets && (
            <button
              onClick={() => setIsTicketPrintModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
              title="Exporter / Imprimer les billets (Tailles au choix, portrait/paysage, nombre par page)"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer Billets</span>
            </button>
          )}
          {/* Exporter Billets (Excel ou PDF) */}
          <button
            onClick={() => handleOpenExportModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
            title="Choisir l'exportation Excel ou PDF (vendus, non vendus, distribués ou non)"
          >
            <Download className="w-4 h-4" />
            <span>Exporter Billets (Excel/PDF)</span>
          </button>

          <button
            onClick={() => loadTickets(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold rounded-xl transition cursor-pointer"
            title="Synchroniser immédiatement les billets avec le serveur et les autres appareils"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
            <span>{isRefreshing ? 'Synchro...' : 'Actualiser'}</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer Rapport</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 no-print">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Total Billets
          </span>
          <span className="text-xl font-black text-gray-900">{totalBilletsCount}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
            Attribués
          </span>
          <span className="text-xl font-black text-blue-700">{totalAttribues}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">
            Payés
          </span>
          <span className="text-xl font-black text-emerald-700">{totalPayes}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 block mb-1">
            Encaissé
          </span>
          <span className="text-base sm:text-lg font-black text-teal-700">{formatAr(totalMontantEncaisse)}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 block mb-1">
            Reste / Attendu
          </span>
          <span className="text-base sm:text-lg font-black text-orange-700">
            {formatAr(totalMontantAttendu - totalMontantEncaisse)}
          </span>
        </div>
      </div>

      {/* Tabs Navigation & Search Bar (aligned as requested in UI) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-gray-200 gap-3 pb-2 no-print">
        <div className="flex gap-4 sm:gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('liste')}
            className={`pb-2.5 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'liste'
                ? 'border-[#00897b] text-[#00897b]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Liste de tous les Billets ({filteredTickets.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('personnes')}
            className={`pb-2.5 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'personnes'
                ? 'border-[#00897b] text-[#00897b]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Rapport par Personne ({personsList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('groupes')}
            className={`pb-2.5 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'groupes'
                ? 'border-[#00897b] text-[#00897b]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Rapport par Groupe ({groupesList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('rapport')}
            className={`pb-2.5 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'rapport'
                ? 'border-[#00897b] text-[#00897b]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Compte Rendu & Bilan</span>
          </button>
        </div>

        {/* Search Bar directly aligned with the tabs */}
        <div className="relative min-w-[260px] sm:min-w-[320px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              activeTab === 'personnes'
                ? "Rechercher personne, n° billet, groupe, tél..."
                : activeTab === 'groupes'
                ? "Rechercher un groupe..."
                : "Rechercher par numéro, nom, groupe, tél..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00897b] shadow-2xs font-medium placeholder-gray-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
              title="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar for List */}
      {activeTab === 'liste' && (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center gap-3 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Campagne:</span>
            <select
              value={filterCampagne}
              onChange={(e) => setFilterCampagne(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-medium"
            >
              <option value="Tous">Toutes</option>
              {campagnes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>


          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Groupe:</span>
            <select
              value={filterGroupe}
              onChange={(e) => setFilterGroupe(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-medium"
            >
              <option value="Tous">Tous les groupes</option>
              {groupes.filter(Boolean).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Statut:</span>
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-medium"
            >
              <option value="tous">Tous les billets</option>
              <option value="paye">Payés uniquement</option>
              <option value="impaye">Impayés (Non payés)</option>
              <option value="attribue">Attribués / Distribués</option>
              <option value="non_attribue">Non attribués / Non distribués</option>
            </select>
          </div>

          {/* Quick Export buttons for filtered list */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => handleDirectExportExcel()}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
              title="Télécharger directement la liste affichée en Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Export Excel ({filteredTickets.length})</span>
            </button>
            <button
              onClick={() => {
                setReportModalStatut(filterStatut);
                setReportModalCampagne(filterCampagne);
                setIsBilletsReportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
              title="Générer le rapport PDF pour la liste filtrée"
            >
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: LISTE */}
      {activeTab === 'liste' && (
        <div className="space-y-4">
          {selectedTicketIds.length > 0 && (
            <div className="bg-teal-50 border border-teal-200 p-3 px-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 no-print shadow-xs animate-fadeIn">
              <span className="text-xs font-bold text-teal-900">
                {selectedTicketIds.length} billet(s) sélectionné(s)
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {canWrite && (
                  <>
                    <button
                      onClick={() => handleBatchToggleSelectedPaye(true)}
                      disabled={isProcessingBatch}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                      title={`Valider les ${selectedTicketIds.length} billets sélectionnés comme payés`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Marquer Payés ({selectedTicketIds.length})</span>
                    </button>
                    <button
                      onClick={() => handleBatchToggleSelectedPaye(false)}
                      disabled={isProcessingBatch}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                      title={`Marquer les ${selectedTicketIds.length} billets sélectionnés comme impayés`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Marquer Impayés ({selectedTicketIds.length})</span>
                    </button>
                  </>
                )}

                {/* Export Excel for Selected */}
                <button
                  onClick={() => handleDirectExportExcel('selection')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
                  title="Exporter les billets sélectionnés en Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exporter Excel ({selectedTicketIds.length})</span>
                </button>

                {/* Export PDF for Selected */}
                <button
                  onClick={() => {
                    setReportModalStatut('selection');
                    setIsBilletsReportModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
                  title="Générer le rapport PDF pour les billets sélectionnés"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Rapport PDF ({selectedTicketIds.length})</span>
                </button>

                {canPrintBillets && (
                  <button
                    onClick={() => setIsTicketPrintModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
                    title="Imprimer les billets sélectionnés (10cm x 5.5cm, 10 par page A4)"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimer Billets ({selectedTicketIds.length})</span>
                  </button>
                )}
                {canDeleteOrModify && (
                  <button
                    onClick={handleBatchDeleteSelected}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden printable-billets-report">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">
                Liste des Billets ({filteredTickets.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                    {canDeleteOrModify && (
                      <th className="py-3 px-3 w-10 text-center no-print">
                        <input
                          type="checkbox"
                          checked={filteredTickets.length > 0 && selectedTicketIds.length === filteredTickets.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-[#00897b] rounded-sm cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4">N° Billet</th>
                    <th className="py-3 px-4">Campagne</th>
                    <th className="py-3 px-4">Prix</th>
                    <th className="py-3 px-4">Groupe</th>
                    <th className="py-3 px-4">Bénéficiaire / Acheteur</th>
                    <th className="py-3 px-4">Téléphone</th>
                    <th className="py-3 px-4 text-center">Paiement</th>
                    <th className="py-3 px-4 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={canDeleteOrModify ? 9 : 8} className="py-8 text-center text-gray-400 italic">
                        Aucun billet trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((t) => {
                      const isSelected = selectedTicketIds.includes(t.id);
                      return (
                        <tr key={t.id} className={`hover:bg-gray-50/80 transition ${isSelected ? 'bg-teal-50/40' : ''}`}>
                          {canDeleteOrModify && (
                            <td className="py-3 px-3 text-center no-print">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectTicket(t.id)}
                                className="w-4 h-4 text-[#00897b] rounded-sm cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="py-3 px-4 font-black text-gray-900">
                            <span className="px-2.5 py-1 bg-teal-50 text-teal-800 rounded-lg font-mono">
                              #{t.numero.toString().padStart(4, '0')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-medium">{t.campagne}</td>
                          <td className="py-3 px-4 font-mono font-bold text-gray-900">{formatAr(t.prix)}</td>
                          <td className="py-3 px-4 text-gray-700 font-semibold">{t.groupe || '—'}</td>
                          <td className="py-3 px-4 text-gray-900 font-bold">
                            {t.beneficiaire ? (
                              <span className="flex items-center gap-1.5">
                                <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                                {t.beneficiaire}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">Non attribué</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {t.telephone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-gray-400" />
                                {t.telephone}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {canWrite ? (
                              <button
                                onClick={() => handleTogglePaye(t.id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                                  t.paye
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                }`}
                                title="Cliquer pour basculer le statut payé/impayé"
                              >
                                {t.paye ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Payé
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5" /> Impayé
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  t.paye ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {t.paye ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Payé
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5" /> Impayé
                                  </>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right no-print">
                            <div className="flex items-center justify-end gap-1.5">
                              {canWrite && (
                                <button
                                  onClick={() => {
                                    setSelectedTicketForEdit(t);
                                    setEditBeneficiaire(t.beneficiaire);
                                    setEditGroupe(t.groupe);
                                    setEditTelephone(t.telephone);
                                    setEditPaye(t.paye);
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-[#00897b] hover:bg-teal-50 rounded-lg transition cursor-pointer"
                                  title="Attribuer / Modifier bénéficiaire"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                              )}
                              {canDeleteOrModify ? (
                                <button
                                  onClick={() => handleDeleteTicket(t.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Supprimer le billet (Admin)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : isReadOnly ? (
                                <span className="p-1.5 text-gray-300" title="Lecture seule">
                                  <Eye className="w-4 h-4" />
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PERSONNES (Rapport par Personne) */}
      {activeTab === 'personnes' && (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden printable-billets-report">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">
              Rapport par Personne / Bénéficiaire ({personsList.length})
            </h2>
            <p className="text-xs text-gray-500 no-print">Détail des billets possédés par chaque personne avec numéros exacts.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                  <th className="py-3 px-4">Bénéficiaire</th>
                  <th className="py-3 px-4">Groupe</th>
                  <th className="py-3 px-4">Téléphone</th>
                  <th className="py-3 px-4">Billets Détenus (Numéros)</th>
                  <th className="py-3 px-4 text-center">Total Billets</th>
                  <th className="py-3 px-4 text-right">Montant Total</th>
                  <th className="py-3 px-4 text-right">Payé / Restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {personsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                      Aucune attribution de billet enregistrée.
                    </td>
                  </tr>
                ) : (
                  personsList.map((p, idx) => {
                    const billetNums = p.billets.map((b) => b.numero).sort((a, b) => a - b);
                    const isAllPaid = p.totalPaye >= p.totalDu;
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-black text-gray-900">{p.name}</td>
                        <td className="py-3 px-4 text-gray-700 font-semibold">{p.groupe || '—'}</td>
                        <td className="py-3 px-4 text-gray-600">{p.telephone || '—'}</td>
                        <td className="py-3 px-4 font-mono text-gray-800">

                          {(() => {
                            const isExpanded = expandedPersonNames.has(p.name);
                            if (billetNums.length <= 8) {
                              return <span className="text-xs leading-relaxed">{billetNums.join(', ')}</span>;
                            }
                            return (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs leading-relaxed">
                                  {isExpanded
                                    ? billetNums.join(', ')
                                    : billetNums.slice(0, 8).join(', ') + ', ...'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPersonForDetail(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-50 hover:bg-teal-100 text-[#00897b] font-bold text-xs rounded-lg border border-teal-200 transition cursor-pointer shadow-2xs shrink-0"
                                  title={`Voir tous les ${billetNums.length} billets détenus par ${p.name}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Voir ({billetNums.length})</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleExpandPerson(p.name)}
                                  className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 underline cursor-pointer shrink-0 ml-0.5"
                                >
                                  {isExpanded ? 'Réduire' : 'Déplier'}
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-teal-700">{p.billets.length}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                          {formatAr(p.totalDu)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isAllPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.totalPaye > 0
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {formatAr(p.totalPaye)} / {formatAr(p.totalDu - p.totalPaye)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: GROUPES */}
      {activeTab === 'groupes' && (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden printable-billets-report">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">
              Rapport par Groupe / Lot ({groupesList.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                  <th className="py-3 px-4">Nom du Groupe</th>
                  <th className="py-3 px-4 text-center">Total Billets</th>
                  <th className="py-3 px-4 text-center">Attribués</th>
                  <th className="py-3 px-4 text-center">Payés</th>
                  <th className="py-3 px-4 text-right">Montant Attendu</th>
                  <th className="py-3 px-4 text-right">Montant Encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupesList.map((g, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-black text-gray-900">{g.groupe}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-800">{g.totalBillets}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-700">{g.attribues}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-700">{g.payes}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">{formatAr(g.montantTotal)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-teal-700">{formatAr(g.montantPaye)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: RAPPORT / BILAN GLOBAL */}
      {activeTab === 'rapport' && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-gray-100 space-y-6 printable-billets-report">
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-lg font-black text-gray-900">Compte Rendu & Bilan Financier des Billets</h2>
            <p className="text-xs text-gray-500 mt-1">
              Généré le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs font-bold text-gray-500 block mb-1 uppercase">Total Billets Imprimés</span>
              <span className="text-2xl font-black text-gray-900">{totalBilletsCount}</span>
            </div>
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200">
              <span className="text-xs font-bold text-blue-800 block mb-1 uppercase">Billets Attribués / Distribués</span>
              <span className="text-2xl font-black text-blue-700">{totalAttribues} / {totalBilletsCount}</span>
            </div>
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <span className="text-xs font-bold text-emerald-800 block mb-1 uppercase">Taux de Recouvrement</span>
              <span className="text-2xl font-black text-emerald-700">
                {totalBilletsCount > 0 ? Math.round((totalPayes / totalBilletsCount) * 100) : 0}%
              </span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Synthèse des Recettes</h3>
            <div className="flex justify-between py-2 border-b border-gray-100 text-xs">
              <span className="text-gray-600">Montant total potentiel (tous billets)</span>
              <span className="font-mono font-bold text-gray-900">{formatAr(totalBilletsCount * (tickets[0]?.prix || 10000))}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 text-xs">
              <span className="text-gray-600">Montant total attribué</span>
              <span className="font-mono font-bold text-gray-900">{formatAr(totalMontantAttendu)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 text-xs">
              <span className="text-emerald-700 font-bold">Montant encaissé et versé</span>
              <span className="font-mono font-bold text-emerald-700">{formatAr(totalMontantEncaisse)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 text-xs">
              <span className="text-orange-700 font-bold">Reste à recouvrer / Impayés</span>
              <span className="font-mono font-bold text-orange-700">{formatAr(totalMontantAttendu - totalMontantEncaisse)}</span>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-300 grid grid-cols-2 gap-12 text-xs">
            <div>
              <p className="font-bold text-gray-900 uppercase">Le Responsable des Billets / Trésorier</p>
              <div className="pt-16 border-b border-gray-400 w-56"></div>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900 uppercase">L'Administration / Direction</p>
              <div className="pt-16 border-b border-gray-400 w-56 ml-auto"></div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GENERATE TICKETS */}
      {isGenerateModalOpen && canWrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-gray-900 border border-gray-100 space-y-4">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-[#00897b]" />
              Générer des Billets (ex: Opération Soupe)
            </h3>
            <form onSubmit={handleGenerateTickets} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nom de la Campagne / Opération</label>
                <input
                  type="text"
                  required
                  value={genCampagne}
                  onChange={(e) => setGenCampagne(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Numéro de début</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={genStartNum}
                    onChange={(e) => setGenStartNum(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Numéro de fin</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={genEndNum}
                    onChange={(e) => setGenEndNum(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Prix unitaire (Ar)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={genPrix}
                    onChange={(e) => setGenPrix(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Groupe par défaut</label>
                  <input
                    type="text"
                    value={genGroupe}
                    onChange={(e) => setGenGroupe(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00897b] hover:bg-[#00796b] text-white font-semibold rounded-xl cursor-pointer"
                >
                  Générer les Billets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BATCH ASSIGNMENT */}
      {isBatchAssignOpen && canWrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-gray-900 border border-gray-100 space-y-4">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#00897b]" />
              Distribution par Lot (Groupe ou Plage de numéros)
            </h3>
            <form onSubmit={handleBatchAssign} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Du billet n°</label>
                  <input
                    type="number"
                    required
                    value={batchStart}
                    onChange={(e) => setBatchStart(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Au billet n°</label>
                  <input
                    type="number"
                    required
                    value={batchEnd}
                    onChange={(e) => setBatchEnd(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nom du Groupe</label>
                <input
                  type="text"
                  required
                  value={batchGroupe}
                  onChange={(e) => setBatchGroupe(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Bénéficiaire / Responsable du lot (optionnel)</label>
                <input
                  type="text"
                  value={batchBeneficiaire}
                  onChange={(e) => setBatchBeneficiaire(e.target.value)}
                  placeholder="ex: Chef de Groupe Jean"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Téléphone</label>
                <input
                  type="text"
                  value={batchTelephone}
                  onChange={(e) => setBatchTelephone(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="batchPaye"
                  checked={batchPaye}
                  onChange={(e) => setBatchPaye(e.target.checked)}
                  className="w-4 h-4 text-[#00897b] rounded-sm"
                />
                <label htmlFor="batchPaye" className="font-bold text-gray-700">
                  Marquer tous ces billets comme Payés
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsBatchAssignOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00897b] hover:bg-[#00796b] text-white font-semibold rounded-xl cursor-pointer"
                >
                  Appliquer le Lot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SINGLE TICKET */}
      {selectedTicketForEdit && canWrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-gray-900 border border-gray-100 space-y-4">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-[#00897b]" />
              Attribuer / Modifier Billet #{selectedTicketForEdit.numero}
            </h3>
            <form onSubmit={handleSaveSingleTicket} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Bénéficiaire / Acheteur</label>
                <input
                  type="text"
                  value={editBeneficiaire}
                  onChange={(e) => setEditBeneficiaire(e.target.value)}
                  placeholder="Nom de la personne"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Groupe</label>
                <input
                  type="text"
                  value={editGroupe}
                  onChange={(e) => setEditGroupe(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Téléphone</label>
                <input
                  type="text"
                  value={editTelephone}
                  onChange={(e) => setEditTelephone(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editPaye"
                  checked={editPaye}
                  onChange={(e) => setEditPaye(e.target.checked)}
                  className="w-4 h-4 text-[#00897b] rounded-sm"
                />
                <label htmlFor="editPaye" className="font-bold text-gray-700">
                  Billet Payé
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedTicketForEdit(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00897b] hover:bg-[#00796b] text-white font-semibold rounded-xl cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Physical Ticket Print Modal (10cm x 5.5cm, cadre bleu, 10/page A4) */}
      {canPrintBillets && (
        <TicketPrintModal
          isOpen={isTicketPrintModalOpen}
          onClose={() => setIsTicketPrintModalOpen(false)}
          tickets={filteredTickets}
          selectedTicketIds={selectedTicketIds}
          campagnes={campagnes}
        />
      )}

      {/* Printable Billets Report Modal (Portal-based to eliminate any blank print preview) */}
      <BilletsReportModal
        isOpen={isBilletsReportModalOpen}
        onClose={() => setIsBilletsReportModalOpen(false)}
        tickets={tickets}
        initialReportType={
          activeTab === 'personnes'
            ? 'personnes'
            : activeTab === 'groupes'
            ? 'groupes'
            : activeTab === 'rapport'
            ? 'bilan'
            : 'personnes'
        }
        filterCampagne={reportModalCampagne !== 'Tous' ? reportModalCampagne : filterCampagne}
        initialFilterStatut={reportModalStatut}
        selectedTicketIds={selectedTicketIds}
      />

      {/* Billets Export Modal (Excel or PDF: vendus, non vendus, distribués, non distribués) */}
      <BilletsExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        tickets={tickets}
        selectedTicketIds={selectedTicketIds}
        initialStatut={filterStatut as any}
        initialCampagne={filterCampagne}
        initialGroupe={filterGroupe}
        onOpenPdfReport={handleOpenPdfReport}
        showToast={showToast}
      />

      {/* MODAL: DETAIL COMPLET DES BILLETS D'UNE PERSONNE ("Voir ici") */}
      {selectedPersonForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 text-gray-900">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between bg-teal-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center font-black shadow-xs">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    {selectedPersonForDetail.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>Groupe : <strong>{selectedPersonForDetail.groupe || 'Indéfini'}</strong></span>
                    {selectedPersonForDetail.telephone && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {selectedPersonForDetail.telephone}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPersonForDetail(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Metrics */}
            <div className="grid grid-cols-4 gap-2.5 p-3.5 bg-gray-50 border-b border-gray-100 text-xs">
              <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Total Billets</span>
                <span className="text-base sm:text-lg font-black text-gray-900">{selectedPersonForDetail.billets.length}</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Montant Total</span>
                <span className="text-xs sm:text-sm font-black text-gray-900">{formatAr(selectedPersonForDetail.totalDu)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Payé</span>
                <span className="text-xs sm:text-sm font-black text-emerald-700">{formatAr(selectedPersonForDetail.totalPaye)}</span>
              </div>
              <div className="p-2.5 bg-orange-50 rounded-xl border border-orange-200">
                <span className="text-[10px] uppercase font-bold text-orange-800 block">Reste Dû</span>
                <span className="text-xs sm:text-sm font-black text-orange-700">
                  {formatAr(selectedPersonForDetail.totalDu - selectedPersonForDetail.totalPaye)}
                </span>
              </div>
            </div>

            {/* Actions Bar inside Modal */}
            <div className="p-3 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                onClick={() => {
                  const nums = selectedPersonForDetail.billets
                    .map((b) => b.numero)
                    .sort((a, b) => a - b)
                    .join(', ');
                  navigator.clipboard.writeText(nums);
                  showToast(`${selectedPersonForDetail.billets.length} numéros copiés dans le presse-papier !`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-semibold transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
                <span>Copier tous les {selectedPersonForDetail.billets.length} numéros</span>
              </button>

              {canWrite && selectedPersonForDetail.totalPaye < selectedPersonForDetail.totalDu && (
                <button
                  onClick={async () => {
                    if (
                      confirm(
                        `Marquer tous les ${selectedPersonForDetail.billets.length} billets de ${selectedPersonForDetail.name} comme payés ?`
                      )
                    ) {
                      const unpaid = selectedPersonForDetail.billets.filter((b) => !b.paye);
                      const unpaidIds = unpaid.map((b) => b.id);
                      if (unpaidIds.length > 0) {
                        try {
                          await api.batchToggleTicketsPaye(unpaidIds, true);
                          const unpaidSet = new Set(unpaidIds);
                          setTickets((prev) =>
                            prev.map((t) => (unpaidSet.has(t.id) ? { ...t, paye: true } : t))
                          );
                          showToast(`Tous les ${unpaidIds.length} billets de ${selectedPersonForDetail.name} ont été validés comme payés.`);
                          setSelectedPersonForDetail(null);
                        } catch (err: any) {
                          showToast(err.message || 'Erreur lors de la validation groupée');
                          loadTickets(false);
                        }
                      }
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tout marquer comme payé</span>
                </button>
              )}
            </div>

            {/* Scrollable list of tickets */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
                Liste complète des billets attribués ({selectedPersonForDetail.billets.length}) :
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {selectedPersonForDetail.billets
                  .sort((a, b) => a.numero - b.numero)
                  .map((t) => (
                    <div
                      key={t.id}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between transition ${
                        t.paye
                          ? 'bg-emerald-50/70 border-emerald-200'
                          : 'bg-white border-gray-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-black text-sm text-gray-900">
                          #{t.numero.toString().padStart(4, '0')}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {formatAr(t.prix)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                        {canWrite ? (
                          <button
                            onClick={async () => {
                              await handleTogglePaye(t.id);
                              setSelectedPersonForDetail((prev) => {
                                if (!prev) return null;
                                const updatedBillets = prev.billets.map((b) =>
                                  b.id === t.id ? { ...b, paye: !b.paye } : b
                                );
                                const totalPaye = updatedBillets.reduce(
                                  (sum, b) => sum + (b.paye ? b.prix : 0),
                                  0
                                );
                                return {
                                  ...prev,
                                  billets: updatedBillets,
                                  totalPaye,
                                };
                              });
                            }}
                            className={`w-full py-1 rounded text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                              t.paye
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                            }`}
                          >
                            {t.paye ? 'Payé ✓' : 'Impayé'}
                          </button>
                        ) : (
                          <span
                            className={`w-full py-0.5 rounded text-[10px] font-bold text-center ${
                              t.paye
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {t.paye ? 'Payé' : 'Impayé'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedPersonForDetail(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <BilletsExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        existingTickets={tickets}
        onImportConfirm={handleExcelImportConfirm}
      />
    </div>
  );
};

