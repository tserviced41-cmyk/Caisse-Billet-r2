import React, { useState, useEffect, useCallback } from 'react';
import { DonneurOrdre, OperationVirement } from './types/afb160';
import { generateAFB160Content } from './utils/afb160Generator';
import { downloadExcelTemplate, exportOperationsToExcel } from './utils/excelHandler';
import { Header } from './components/Header';
import { DonneurOrdreCard } from './components/DonneurOrdreCard';
import { OperationsTable } from './components/OperationsTable';
import { OperationModal } from './components/OperationModal';
import { HelpModal } from './components/HelpModal';
import { PreviewModal } from './components/PreviewModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { AfbImportModal } from './components/AfbImportModal';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar, NavigationTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CaissesView } from './components/CaissesView';
import { TransactionsView } from './components/TransactionsView';
import { UsersManagementView } from './components/UsersManagementView';
import { BackupView } from './components/BackupView';
import { NewTransactionModal } from './components/NewTransactionModal';
import { NewCaisseModal } from './components/NewCaisseModal';
import { CaisseReportModal } from './components/CaisseReportModal';
import { CaisseExcelImportModal } from './components/CaisseExcelImportModal';
import { BilletsView } from './components/BilletsView';
import { ActivityLogView } from './components/ActivityLogView';
import { api, getStoredUser, setStoredUser } from './utils/api';
import { Caisse, Transaction, User } from './types/caisse';
import {
  DatePeriodFilter,
  getPeriodDateRange,
  parseTxDate,
} from './utils/dateUtils';
import { CheckCircle2, Menu, RotateCcw, RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';

const emptyDonneur: DonneurOrdre = {
  nom: '',
  banque: '',
  guichet: '',
  compte: '',
  cle: '',
  dateExecution: new Date().toISOString().slice(0, 10),
  libelle: '',
  referenceEmetteur: '000000000000',
};

export default function App() {
  // Current authenticated user
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Multicaisse Data states
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCaisseId, setSelectedCaisseId] = useState<string | null>(null);

  // Multi-device sync states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('caisse_auto_sync_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const lastRevisionRef = React.useRef<number>(0);

  const handleToggleAutoSync = () => {
    setIsAutoSyncEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('caisse_auto_sync_enabled', String(next));
      showToast(
        next
          ? 'Synchronisation multi-appareil automatique activée.'
          : 'Synchronisation multi-appareil automatique désactivée (mode manuel).'
      );
      return next;
    });
  };

  // Multicaisse Modals
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [preselectedTxCaisseId, setPreselectedTxCaisseId] = useState<string | undefined>(undefined);
  const [isNewCaisseModalOpen, setIsNewCaisseModalOpen] = useState(false);
  const [editingCaisse, setEditingCaisse] = useState<Caisse | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportFilter, setReportFilter] = useState<{
    caisseId?: string;
    period?: DatePeriodFilter;
    startDate?: string;
    endDate?: string;
  }>({ period: 'all' });
  const [isCaisseExcelModalOpen, setIsCaisseExcelModalOpen] = useState(false);
  const [excelImportCaisseId, setExcelImportCaisseId] = useState<string | undefined>(undefined);

  // AFB160 Generator state (Default empty)
  const [donneur, setDonneur] = useState<DonneurOrdre>(emptyDonneur);
  const [afbOperations, setAfbOperations] = useState<OperationVirement[]>([]);
  const [isAfbOperationModalOpen, setIsAfbOperationModalOpen] = useState(false);
  const [editingAfbOperation, setEditingAfbOperation] = useState<OperationVirement | null>(null);
  const [isAfbHelpOpen, setIsAfbHelpOpen] = useState(false);
  const [isAfbPreviewOpen, setIsAfbPreviewOpen] = useState(false);
  const [isAfbExcelImportOpen, setIsAfbExcelImportOpen] = useState(false);
  const [isAfbFileImportOpen, setIsAfbFileImportOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Logout handler forward declaration
  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setStoredUser(null);
    setSelectedCaisseId(null);
    setCurrentTab('dashboard');
  }, []);

  // Load multicaisse data from backend
  const loadData = useCallback(async (isManual = false) => {
    if (!currentUser) return;
    if (isManual) setIsSyncing(true);
    try {
      const [loadedCaisses, loadedTransactions] = await Promise.all([
        api.getCaisses(),
        api.getTransactions(),
      ]);
      setCaisses(loadedCaisses);
      setTransactions(loadedTransactions);

      // Verify user permissions or profile update from server
      try {
        const freshUser = await api.getMe();
        if (freshUser) {
          // If role or permissions changed, update user state with stable reference
          setCurrentUser((prev) => {
            if (!prev) return freshUser;
            if (
              prev.id === freshUser.id &&
              prev.username === freshUser.username &&
              prev.fullName === freshUser.fullName &&
              prev.role === freshUser.role &&
              prev.canAccessAfb160 === freshUser.canAccessAfb160 &&
              prev.canAccessActivite === freshUser.canAccessActivite &&
              prev.billetsPermission === freshUser.billetsPermission &&
              prev.canPrintBillets === freshUser.canPrintBillets &&
              prev.canBackupDrive === freshUser.canBackupDrive &&
              JSON.stringify(prev.caissePermissions) === JSON.stringify(freshUser.caissePermissions)
            ) {
              return prev;
            }
            return {
              ...prev,
              ...freshUser,
            };
          });
        }
      } catch (errAuth: any) {
        if (errAuth.message?.includes('expirée') || errAuth.message?.includes('introuvable')) {
          handleLogout();
          return;
        }
      }

      if (currentUser.role === 'admin') {
        const loadedUsers = await api.getUsers().catch(() => []);
        setUsers(loadedUsers);
      }

      // Record current server revision so we know we have the freshest snapshot
      try {
        const status = await api.getSyncStatus();
        if (status?.revision) {
          lastRevisionRef.current = status.revision;
        }
      } catch {}

      setIsOnline(true);
      setLastSyncTime(new Date());
      if (isManual) {
        showToast('Données synchronisées en direct avec succès.');
      }
    } catch (err) {
      console.error('Failed to load caisses data', err);
      setIsOnline(false);
    } finally {
      if (isManual) setIsSyncing(false);
    }
  }, [currentUser, handleLogout, showToast]);

  // Active Multi-Device Background Sync Engine
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    let isChecking = false;

    // Same-device multi-tab BroadcastChannel for zero-latency sync
    let syncChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        syncChannel = new BroadcastChannel('caisse_multi_device_sync');
        syncChannel.onmessage = (event) => {
          if (!isMounted) return;
          if (event.data?.type === 'DATA_MUTATED') {
            loadData();
            window.dispatchEvent(new CustomEvent('caisse:data-synced', { detail: event.data }));
          }
        };
      }
    } catch {}

    // Check server revision for any mutations by other devices
    const checkSyncStatus = async () => {
      if (!isAutoSyncEnabled || isChecking || !currentUser) return;
      isChecking = true;
      try {
        const status = await api.getSyncStatus();
        if (!isMounted) return;

        setIsOnline(true);
        if (status.revision !== lastRevisionRef.current) {
          lastRevisionRef.current = status.revision;
          await loadData();
          // Notify child views (BilletsView, ActivityLogView)
          window.dispatchEvent(new CustomEvent('caisse:data-synced', { detail: status }));
        }
      } catch (err) {
        if (isMounted) setIsOnline(false);
      } finally {
        isChecking = false;
      }
    };

    // Immediate initial sync on mount or user change
    loadData();

    // If auto sync is disabled by user, do not start interval polling
    if (!isAutoSyncEnabled) {
      return () => {
        isMounted = false;
        syncChannel?.close();
      };
    }

    // Fast polling interval: poll status every 2 seconds for instant multi-device sync
    const interval = setInterval(checkSyncStatus, 2000);

    // Sync immediately on focus, visibility change, or network reconnect
    const handleForeground = () => {
      checkSyncStatus();
    };

    window.addEventListener('focus', handleForeground);
    window.addEventListener('online', handleForeground);
    document.addEventListener('visibilitychange', handleForeground);

    return () => {
      isMounted = false;
      clearInterval(interval);
      syncChannel?.close();
      window.removeEventListener('focus', handleForeground);
      window.removeEventListener('online', handleForeground);
      document.removeEventListener('visibilitychange', handleForeground);
    };
  }, [currentUser, loadData, isAutoSyncEnabled]);

  // Guard tab access based on user permissions
  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.role === 'admin';
    const canSeeAfb = isAdmin || Boolean(currentUser.canAccessAfb160);
    const canSeeBillets =
      isAdmin ||
      (currentUser.billetsPermission !== undefined ? currentUser.billetsPermission !== 'none' : false);
    const canSeeActivite = isAdmin || Boolean(currentUser.canAccessActivite);

    if (currentTab === 'activite' && !canSeeActivite) {
      setCurrentTab('dashboard');
    } else if (currentTab === 'billets' && !canSeeBillets) {
      setCurrentTab('dashboard');
    } else if (currentTab === 'afb160' && !canSeeAfb) {
      setCurrentTab('dashboard');
    } else if ((currentTab === 'users' || currentTab === 'backup') && !isAdmin) {
      setCurrentTab('dashboard');
    }
  }, [currentUser, currentTab]);

  // Helper to notify other tabs and update local revision immediately
  const notifyLocalMutation = useCallback((revision?: number) => {
    if (typeof revision === 'number' && revision > 0) {
      lastRevisionRef.current = revision;
    }
    setLastSyncTime(new Date());
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('caisse_multi_device_sync');
        ch.postMessage({ type: 'DATA_MUTATED', revision });
        ch.close();
      }
    } catch {}
  }, []);

  // Auth Handlers
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setStoredUser(user);
    showToast(`Bienvenue, ${user.fullName || user.username} !`);
  };

  // If not logged in, render the secure Login screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }


  // --- MULTICAISSE ACTIONS ---
  const handleSaveTransaction = async (txData: {
    id?: string;
    caisseId: string;
    type: 'entree' | 'sortie';
    montant: number;
    date: string;
    motif?: string;
    responsable?: string;
  }) => {
    try {
      if (txData.id) {
        const updated = await api.updateTransaction(txData.id, txData);
        setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        notifyLocalMutation((updated as any)._revision);
        showToast('Transaction modifiée avec succès.');
      } else {
        const created = await api.createTransaction(txData as any);
        setTransactions((prev) => [created, ...prev]);
        notifyLocalMutation((created as any)._revision);
        showToast('Transaction enregistrée avec succès.');
      }
      setEditingTransaction(null);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’enregistrement');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const res = (await api.deleteTransaction(id)) as any;
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      notifyLocalMutation(res?._revision);
      showToast('Transaction supprimée.');
    } catch (err: any) {
      alert(err.message || 'Erreur de suppression');
    }
  };

  const handleBatchDeleteTransactions = async (ids: string[]) => {
    try {
      const count = await api.batchDeleteTransactions(ids);
      const idsSet = new Set(ids);
      setTransactions((prev) => prev.filter((t) => !idsSet.has(t.id)));
      notifyLocalMutation();
      showToast(`${count} transaction(s) supprimée(s) avec succès.`);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression groupée');
    }
  };

  const handleCreateOrUpdateCaisse = async (data: Partial<Caisse>) => {
    try {
      if (editingCaisse) {
        const updated = await api.updateCaisse(editingCaisse.id, data);
        setCaisses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        notifyLocalMutation((updated as any)._revision);
        showToast(`Caisse "${updated.nom}" mise à jour.`);
      } else {
        const created = await api.createCaisse(data);
        setCaisses((prev) => [...prev, created]);
        notifyLocalMutation((created as any)._revision);
        showToast(`Caisse "${created.nom}" créée.`);
      }
      setEditingCaisse(null);
    } catch (err: any) {
      alert(err.message || 'Erreur caisse');
    }
  };

  const handleDeleteCaisse = async (id: string) => {
    const toDelete = caisses.find((c) => c.id === id);
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir supprimer la caisse "${toDelete?.nom}" ainsi que toutes ses transactions ?`
      )
    ) {
      try {
        const res = (await api.deleteCaisse(id)) as any;
        setCaisses((prev) => prev.filter((c) => c.id !== id));
        setTransactions((prev) => prev.filter((t) => t.caisseId !== id));
        notifyLocalMutation(res?._revision);
        showToast(`Caisse "${toDelete?.nom}" supprimée.`);
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression');
      }
    }
  };

  const handleImportCaisseExcel = async (caisseId: string, rows: any[]) => {
    try {
      const count = await api.batchImportTransactions(caisseId, rows);
      await loadData();
      showToast(`${count} écriture(s) importée(s) avec succès dans la caisse.`);
    } catch (err: any) {
      alert(err.message || 'Erreur d’importation');
    }
  };

  const handleExportCaisseExcel = (
    caisseId?: string,
    period: DatePeriodFilter = 'all',
    startDate?: string,
    endDate?: string,
    customFilteredTxs?: Transaction[]
  ) => {
    let targetTxs = customFilteredTxs;
    const periodInfo = getPeriodDateRange(period, startDate, endDate);
    if (!targetTxs) {
      const caisseTxs = caisseId
        ? transactions.filter((t) => t.caisseId === caisseId)
        : transactions;
      targetTxs = caisseTxs.filter((t) => {
        const time = parseTxDate(t.date).getTime();
        if (periodInfo.start && time < periodInfo.start.getTime()) return false;
        if (periodInfo.end && time > periodInfo.end.getTime()) return false;
        return true;
      });
    }
    const targetCaisse = caisses.find((c) => c.id === caisseId);
    const periodSuffix = period !== 'all' ? `_${period}` : '';

    const wsData: any[][] = [
      ['Date', 'Type', 'Caisse', 'Motif', 'Montant_AR', 'Responsable'],
    ];

    targetTxs.forEach((t) => {
      const cName = caisses.find((c) => c.id === t.caisseId)?.nom || '';
      wsData.push([
        t.date,
        t.type === 'entree' ? 'Entrée' : 'Sortie',
        cName,
        t.motif || '',
        t.montant,
        t.responsable || '',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    const fileName = `transactions_${targetCaisse ? targetCaisse.nom.replace(/\s+/g, '_') : 'toutes_caisses'}${periodSuffix}.xlsx`;
    XLSX.writeFile(wb, fileName);

    api.logActivity(
      'REPORT_EXPORT',
      `Exportation Excel des écritures (${targetTxs.length} lignes - ${periodInfo.label})${targetCaisse ? ` pour la caisse "${targetCaisse.nom}"` : ''}`
    ).catch(() => {});
  };

  // User management actions
  const handleAddUser = async (userData: Partial<User>) => {
    const created = await api.createUser(userData);
    setUsers((prev) => [...prev, created]);
    showToast(`Utilisateur "${created.username}" créé.`);
  };

  const handleUpdateUser = async (id: string, userData: Partial<User>) => {
    const updated = await api.updateUser(id, userData);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    if (currentUser?.id === id) {
      setCurrentUser(updated);
      setStoredUser(updated);
    }
    showToast(`Utilisateur "${updated.username}" mis à jour.`);
  };

  const handleDeleteUser = async (id: string) => {
    await api.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    showToast('Utilisateur supprimé.');
  };

  // --- AFB160 ACTIONS ---
  const afbTotalAmount = afbOperations.reduce(
    (sum, op) => sum + (Number(op.montant) || 0),
    0
  );

  const afbNextRang = (() => {
    if (afbOperations.length === 0) return '000001';
    let maxNum = 0;
    afbOperations.forEach((op) => {
      const parsed = parseInt(op.rang, 10);
      if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
    });
    return String(maxNum + 1).padStart(6, '0');
  })();

  const handleSaveAfbOperation = (op: OperationVirement) => {
    if (editingAfbOperation) {
      setAfbOperations((prev) => prev.map((i) => (i.id === op.id ? op : i)));
      showToast(`Opération ${op.rang} mise à jour.`);
    } else {
      setAfbOperations((prev) => [...prev, op]);
      showToast(`Opération ${op.rang} ajoutée.`);
    }
    setEditingAfbOperation(null);
  };

  const handleDeleteAfbOperation = (id: string) => {
    setAfbOperations((prev) => prev.filter((i) => i.id !== id));
    showToast('Opération retirée.');
  };

  const handleGenerateAndDownloadAFB160 = () => {
    if (afbOperations.length === 0) {
      alert('Veuillez ajouter au moins une opération de virement avant de générer le fichier.');
      return;
    }
    if (!donneur.nom.trim()) {
      alert("Veuillez renseigner le nom ou raison sociale du donneur d'ordre.");
      return;
    }
    const { content, lines } = generateAFB160Content(donneur, afbOperations);
    const blob = new Blob([content], { type: 'text/plain;charset=windows-1252' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const sanitizedName = donneur.nom.replace(/[^a-zA-Z0-9]/g, '_') || 'VIREMENTS';
    const dateStr = donneur.dateExecution.replace(/[^0-9]/g, '').slice(-6) || '250926';
    a.href = url;
    a.download = `AFB160_${sanitizedName}_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Fichier AFB160 généré (${lines.length} lignes à 160 caractères).`);

    api.logActivity(
      'AFB160_GENERATE',
      `Génération du fichier de virement bancaire AFB160 (${afbOperations.length} opération(s))`,
      `Donneur d'ordre: ${donneur.nom} | Date d'exécution: ${donneur.dateExecution}`
    ).catch(() => {});
  };

  const afbPreviewData = generateAFB160Content(donneur, afbOperations);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 flex flex-col lg:flex-row font-sans selection:bg-teal-300 selection:text-teal-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#15803d] text-white px-4 py-2.5 rounded-xl shadow-xl border border-green-400/50 flex items-center gap-2 text-xs sm:text-sm animate-fadeIn print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main App Shell (hidden when printing any modal report to avoid blank pages) */}
      <div className="caisse-app-shell flex-1 flex flex-col lg:flex-row min-w-0 min-h-screen print:hidden">
        {/* Sidebar Navigation */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            if (tab !== 'transactions') setSelectedCaisseId(null);
          }}
          currentUser={currentUser}
          onLogout={handleLogout}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          {/* Mobile Top Header */}
          <div className="lg:hidden bg-[#0b1329] text-white p-3.5 flex items-center justify-between border-b border-gray-800">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm tracking-tight truncate max-w-[170px]">
                Gestion de Caisse & AFB160
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline
                    ? isAutoSyncEnabled
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handleToggleAutoSync}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition ${
                  isAutoSyncEnabled
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                }`}
                title={
                  isAutoSyncEnabled
                    ? 'Désactiver la synchronisation automatique'
                    : 'Activer la synchronisation automatique'
                }
              >
                {isAutoSyncEnabled ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-bold">{isAutoSyncEnabled ? 'AUTO' : 'MANUEL'}</span>
              </button>
              <button
                onClick={() => loadData(true)}
                disabled={isSyncing}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-teal-300 hover:text-white cursor-pointer"
                title="Synchroniser immédiatement"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-teal-700/50 flex items-center justify-center font-bold text-teal-200 text-xs">
                {(currentUser.fullName || currentUser.username).charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Global Live Sync Status Bar (Desktop) */}
          <div className="hidden lg:flex items-center justify-between px-8 py-2.5 bg-white border-b border-gray-200 text-xs text-gray-600 select-none">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline
                      ? isAutoSyncEnabled
                        ? 'bg-emerald-500 shadow-xs shadow-emerald-400 animate-pulse'
                        : 'bg-amber-500 shadow-xs shadow-amber-400'
                      : 'bg-red-500'
                  }`}
                />
                <span className="font-semibold text-gray-800">
                  {isOnline
                    ? isAutoSyncEnabled
                      ? 'Synchronisation multi-appareil active (temps réel)'
                      : 'Synchronisation automatique en pause (mode manuel)'
                    : 'Hors ligne (tentative de reconnexion...)'}
                </span>
              </div>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Dernière mise à jour : {lastSyncTime.toLocaleTimeString('fr-FR')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleAutoSync}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium text-xs border transition cursor-pointer shadow-2xs ${
                  isAutoSyncEnabled
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                }`}
                title={
                  isAutoSyncEnabled
                    ? 'Cliquer pour désactiver la synchronisation automatique en arrière-plan'
                    : 'Cliquer pour réactiver la synchronisation automatique en arrière-plan'
                }
              >
                {isAutoSyncEnabled ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Synchro auto : Activée</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                    <span>Synchro auto : Désactivée</span>
                  </>
                )}
              </button>

              <button
                onClick={() => loadData(true)}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 hover:bg-teal-50 hover:text-teal-800 text-gray-700 border border-gray-200 hover:border-teal-300 rounded-lg font-medium transition cursor-pointer shadow-2xs"
                title="Forcer la synchronisation avec le serveur"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-600' : 'text-gray-500'}`} />
                <span>{isSyncing ? 'Synchronisation...' : 'Actualiser'}</span>
              </button>
            </div>
          </div>

        {/* Dynamic View Content */}
        <div
          className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto ${
            currentTab === 'afb160'
              ? 'bg-[#084b54] text-white'
              : currentTab === 'activite'
              ? 'bg-[#070e1b] text-gray-100'
              : 'bg-[#f8fafc]'
          }`}
        >
          {/* TAB 1: Tableau de bord */}
          {currentTab === 'dashboard' && (
            <DashboardView
              caisses={caisses}
              transactions={transactions}
              currentUser={currentUser}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onSelectCaisseForTransactions={(cId) => {
                setSelectedCaisseId(cId);
                setCurrentTab('transactions');
              }}
              onOpenNewCaisseModal={() => {
                setEditingCaisse(null);
                setIsNewCaisseModalOpen(true);
              }}
            />
          )}

          {/* TAB 2: Caisses */}
          {currentTab === 'caisses' && (
            <CaissesView
              caisses={caisses}
              transactions={transactions}
              currentUser={currentUser}
              onOpenNewCaisseModal={() => {
                setEditingCaisse(null);
                setIsNewCaisseModalOpen(true);
              }}
              onOpenEditCaisseModal={(c) => {
                setEditingCaisse(c);
                setIsNewCaisseModalOpen(true);
              }}
              onDeleteCaisse={handleDeleteCaisse}
              onSelectCaisseForTransactions={(cId) => {
                setSelectedCaisseId(cId);
                setCurrentTab('transactions');
              }}
            />
          )}

          {/* TAB 3: Transactions */}
          {currentTab === 'transactions' && (
            <TransactionsView
              caisses={caisses}
              transactions={transactions}
              selectedCaisseId={selectedCaisseId}
              onClearSelectedCaisse={() => setSelectedCaisseId(null)}
              currentUser={currentUser}
              onOpenNewTransactionModal={(cId) => {
                setEditingTransaction(null);
                setPreselectedTxCaisseId(cId);
                setIsNewTxModalOpen(true);
              }}
              onOpenEditTransactionModal={(tx) => {
                setEditingTransaction(tx);
                setIsNewTxModalOpen(true);
              }}
              onOpenExcelImportModal={(cId) => {
                setExcelImportCaisseId(cId);
                setIsCaisseExcelModalOpen(true);
              }}
              onOpenReportModal={(cId, period, start, end) => {
                setReportFilter({
                  caisseId: cId,
                  period: period || 'all',
                  startDate: start,
                  endDate: end,
                });
                setIsReportModalOpen(true);
              }}
              onExportExcel={handleExportCaisseExcel}
              onDeleteTransaction={handleDeleteTransaction}
              onBatchDeleteTransactions={handleBatchDeleteTransactions}
            />
          )}

          {/* TAB 4: Générateur AFB160 */}
          {currentTab === 'afb160' && (
            <div className="max-w-7xl mx-auto space-y-4">
              <Header
                onOpenHelp={() => setIsAfbHelpOpen(true)}
                onOpenExcelImport={() => setIsAfbExcelImportOpen(true)}
                onOpenAfbImport={() => setIsAfbFileImportOpen(true)}
                onGenerateAfb={handleGenerateAndDownloadAFB160}
                onPreview={() => setIsAfbPreviewOpen(true)}
                onDownloadTemplate={() => downloadExcelTemplate(donneur)}
                operationsCount={afbOperations.length}
                onLogout={handleLogout}
              />

              <DonneurOrdreCard
                donneur={donneur}
                onChange={setDonneur}
                totalAmount={afbTotalAmount}
              />

              <div className="bg-white/10 backdrop-blur-xs border border-teal-500/30 rounded-lg p-4 sm:p-5 shadow-md">
                <OperationsTable
                  operations={afbOperations}
                  onAdd={() => {
                    setEditingAfbOperation(null);
                    setIsAfbOperationModalOpen(true);
                  }}
                  onEdit={(op) => {
                    setEditingAfbOperation(op);
                    setIsAfbOperationModalOpen(true);
                  }}
                  onDelete={handleDeleteAfbOperation}
                  onClearAll={() => {
                    if (window.confirm('Vider toutes les opérations du fichier AFB160 ?')) {
                      setAfbOperations([]);
                      showToast('Liste des opérations AFB160 vidée.');
                    }
                  }}
                  onExportExcel={() => exportOperationsToExcel(donneur, afbOperations)}
                />
              </div>
            </div>
          )}

          {/* TAB: Billets & Opérations (Billets et Caisses sont strictement distincts) */}
          {currentTab === 'billets' && (
            <BilletsView
              currentUser={currentUser}
              caisses={caisses}
              showToast={showToast}
            />
          )}

          {/* TAB 5: Billets (handled above in original layout) */}

          {/* TAB 6: Suivi d'Activité */}
          {currentTab === 'activite' && (currentUser.role === 'admin' || Boolean(currentUser.canAccessActivite)) && (
            <ActivityLogView currentUser={currentUser} showToast={showToast} />
          )}

          {/* TAB 7: Utilisateurs & Droits (Admin only) */}
          {currentTab === 'users' && currentUser.role === 'admin' && (
            <UsersManagementView
              users={users}
              caisses={caisses}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {/* TAB 8: Sauvegarde & Google Drive (Admin ou utilisateur autorisé) */}
          {currentTab === 'backup' && (currentUser.role === 'admin' || Boolean(currentUser.canBackupDrive)) && (
            <BackupView currentUser={currentUser} onRefreshData={loadData} showToast={showToast} />
          )}
        </div>
      </div>
      </div>

      {/* --- MODALS --- */}
      {/* Multicaisse: Nouvelle / Modifier Transaction Modal */}
      <NewTransactionModal
        isOpen={isNewTxModalOpen}
        onClose={() => {
          setIsNewTxModalOpen(false);
          setEditingTransaction(null);
        }}
        caisses={caisses}
        currentUser={currentUser}
        editingTransaction={editingTransaction}
        preselectedCaisseId={preselectedTxCaisseId}
        onSubmit={handleSaveTransaction}
      />

      {/* Multicaisse: Nouvelle / Modifier Caisse Modal */}
      <NewCaisseModal
        isOpen={isNewCaisseModalOpen}
        onClose={() => {
          setIsNewCaisseModalOpen(false);
          setEditingCaisse(null);
        }}
        editingCaisse={editingCaisse}
        onSubmit={handleCreateOrUpdateCaisse}
      />

      {/* Multicaisse: Rapport Imprimable Modal */}
      <CaisseReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        caisse={caisses.find((c) => c.id === reportFilter.caisseId)}
        caisses={caisses}
        transactions={transactions}
        initialPeriod={reportFilter.period}
        initialStartDate={reportFilter.startDate}
        initialEndDate={reportFilter.endDate}
      />

      {/* Multicaisse: Import Excel Caisse Modal */}
      <CaisseExcelImportModal
        isOpen={isCaisseExcelModalOpen}
        onClose={() => setIsCaisseExcelModalOpen(false)}
        caisse={caisses.find((c) => c.id === excelImportCaisseId) || caisses[0]}
        onImport={handleImportCaisseExcel}
      />

      {/* AFB160 Modals */}
      <OperationModal
        isOpen={isAfbOperationModalOpen}
        onClose={() => {
          setIsAfbOperationModalOpen(false);
          setEditingAfbOperation(null);
        }}
        onSave={handleSaveAfbOperation}
        editingOperation={editingAfbOperation}
        nextRang={afbNextRang}
        defaultLibelle={donneur.libelle || 'SALAIRE MOIS DE SEPTEMBRE 2026'}
      />

      <HelpModal
        isOpen={isAfbHelpOpen}
        onClose={() => setIsAfbHelpOpen(false)}
        onDownloadTemplate={() => downloadExcelTemplate(donneur)}
      />

      <PreviewModal
        isOpen={isAfbPreviewOpen}
        onClose={() => setIsAfbPreviewOpen(false)}
        lines={afbPreviewData.lines}
        totalAmount={afbPreviewData.totalAmount}
        onDownload={handleGenerateAndDownloadAFB160}
        fileName={`AFB160_${donneur.nom.replace(/[^a-zA-Z0-9]/g, '_') || 'VIREMENTS'}.txt`}
      />

      <ExcelImportModal
        isOpen={isAfbExcelImportOpen}
        onClose={() => setIsAfbExcelImportOpen(false)}
        onImportSuccess={(newOps, detectedDonneur, replaceExisting) => {
          if (detectedDonneur) {
            setDonneur((prev) => ({
              ...prev,
              banque: detectedDonneur.banque || prev.banque,
              guichet: detectedDonneur.guichet || prev.guichet,
              compte: detectedDonneur.compte || prev.compte,
              cle: detectedDonneur.cle || prev.cle,
              libelle: detectedDonneur.libelle || prev.libelle,
            }));
          }
          if (replaceExisting) {
            setAfbOperations(newOps);
            showToast(`${newOps.length} opération(s) importée(s).`);
          } else {
            setAfbOperations((prev) => [...prev, ...newOps]);
            showToast(`${newOps.length} opération(s) ajoutée(s).`);
          }
        }}
        onDownloadTemplate={() => downloadExcelTemplate(donneur)}
      />

      <AfbImportModal
        isOpen={isAfbFileImportOpen}
        onClose={() => setIsAfbFileImportOpen(false)}
        onImportSuccess={(newOps, newDonneur, replaceExisting) => {
          if (newDonneur && replaceExisting) setDonneur(newDonneur);
          if (replaceExisting) {
            setAfbOperations(newOps);
            showToast(`Fichier AFB160 importé : ${newOps.length} opération(s).`);
          } else {
            setAfbOperations((prev) => [...prev, ...newOps]);
            showToast(`${newOps.length} opération(s) ajoutée(s).`);
          }
        }}
      />
    </div>
  );
}
