import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Download,
  Printer,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Calendar,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Ticket,
  Lock,
  Layers,
  Database,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';
import { ActivityItem, ActivityActionType, User } from '../types/caisse';
import { api } from '../utils/api';

interface ActivityLogViewProps {
  currentUser: User;
  showToast?: (message: string) => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({
  currentUser,
  showToast,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);

  const isFetchingRef = React.useRef(false);
  const showToastRef = React.useRef(showToast);
  showToastRef.current = showToast;

  // Fetch activities from API
  const fetchActivities = useCallback(async (silent = false) => {
    if (!isAdmin && !currentUser.canAccessActivite) {
      setIsLoading(false);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!silent) {
      setIsLoading(true);
    }
    try {
      const data = await api.getActivities();
      if (Array.isArray(data)) {
        setActivities((prev) => {
          if (
            prev.length === data.length &&
            prev[0]?.id === data[0]?.id &&
            prev[prev.length - 1]?.id === data[data.length - 1]?.id
          ) {
            return prev;
          }
          return data;
        });
      }
    } catch (err: any) {
      console.error('Failed to load activity logs', err);
      if (showToastRef.current && !silent) {
        showToastRef.current(err.message || 'Impossible de charger le journal d’activité');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [isAdmin, currentUser.canAccessActivite]);

  useEffect(() => {
    fetchActivities(false);

    let debounceTimer: any = null;
    const handleSync = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchActivities(true); // silent fetch debounced
      }, 500);
    };

    window.addEventListener('caisse:data-synced', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('caisse:data-synced', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [fetchActivities]);

  // Handle Reset by Admin
  const handleResetActivities = async () => {
    if (!isAdmin) {
      if (showToast) showToast('Seul l’administrateur peut réinitialiser l’activité');
      return;
    }

    setIsResetting(true);
    try {
      await api.clearActivities();
      await fetchActivities();
      setIsResetModalOpen(false);
      if (showToast) showToast('Journal d’activité réinitialisé avec succès');
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Erreur lors de la réinitialisation');
    } finally {
      setIsResetting(false);
    }
  };

  // Distinct users for dropdown
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach((act) => {
      if (act.userName) {
        map.set(act.userName, act.userName);
      }
    });
    return Array.from(map.values()).sort();
  }, [activities]);

  // Category classifier helper
  const matchesCategory = (action: ActivityActionType, cat: string): boolean => {
    if (cat === 'ALL') return true;
    if (cat === 'AUTH') return action === 'LOGIN' || action === 'LOGOUT';
    if (cat === 'TRANSACTIONS') return action.startsWith('TRANSACTION_');
    if (cat === 'TICKETS') return action.startsWith('TICKET_');
    if (cat === 'CAISSES') return action.startsWith('CAISSE_');
    if (cat === 'USERS') return action.startsWith('USER_');
    if (cat === 'BACKUP_AFB') {
      return (
        action.startsWith('BACKUP_') ||
        action === 'AFB160_GENERATE' ||
        action === 'REPORT_EXPORT'
      );
    }
    if (cat === 'SENSITIVE') {
      return (
        action.includes('DELETE') ||
        action === 'ACTIVITY_CLEAR' ||
        action === 'BACKUP_RESTORE' ||
        action === 'USER_DELETE'
      );
    }
    return true;
  };

  // Period matcher
  const matchesPeriod = (timestamp: string, period: string): boolean => {
    if (period === 'ALL') return true;
    const actDate = new Date(timestamp);
    const now = new Date();
    if (period === 'TODAY') {
      return actDate.toDateString() === now.toDateString();
    }
    if (period === '7DAYS') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return actDate >= sevenDaysAgo;
    }
    if (period === '30DAYS') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return actDate >= thirtyDaysAgo;
    }
    return true;
  };

  // Filtered activities
  const filteredActivities = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return activities.filter((act) => {
      // Category filter
      if (!matchesCategory(act.action, selectedCategory)) return false;

      // User filter
      if (selectedUser !== 'ALL' && act.userName !== selectedUser) return false;

      // Period filter
      if (!matchesPeriod(act.timestamp, selectedPeriod)) return false;

      // Search Query
      if (q) {
        const inUser = (act.userName || '').toLowerCase().includes(q);
        const inDesc = (act.description || '').toLowerCase().includes(q);
        const inDetails = (act.details || '').toLowerCase().includes(q);
        const inAction = (act.action || '').toLowerCase().includes(q);
        if (!inUser && !inDesc && !inDetails && !inAction) return false;
      }

      return true;
    });
  }, [activities, searchQuery, selectedCategory, selectedUser, selectedPeriod]);

  // Statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayCount = activities.filter(
      (a) => new Date(a.timestamp).toDateString() === todayStr
    ).length;

    const userCount = new Set(activities.map((a) => a.userName)).size;

    const sensitiveCount = activities.filter(
      (a) =>
        a.action.includes('DELETE') ||
        a.action === 'ACTIVITY_CLEAR' ||
        a.action === 'BACKUP_RESTORE'
    ).length;

    return {
      total: activities.length,
      today: todayCount,
      activeUsers: userCount,
      sensitive: sensitiveCount,
    };
  }, [activities]);

  // Visual meta for each action type
  const getActionMeta = (action: ActivityActionType) => {
    switch (action) {
      case 'LOGIN':
        return {
          label: 'Connexion',
          color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          dot: 'bg-blue-400',
          icon: UserIcon,
        };
      case 'TRANSACTION_CREATE':
        return {
          label: 'Ajout Écriture',
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-400',
          icon: ArrowDownLeft,
        };
      case 'TRANSACTION_EDIT':
        return {
          label: 'Modif. Écriture',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          dot: 'bg-amber-400',
          icon: ArrowUpRight,
        };
      case 'TRANSACTION_DELETE':
        return {
          label: 'Suppr. Écriture',
          color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          dot: 'bg-rose-400',
          icon: Trash2,
        };
      case 'CAISSE_CREATE':
      case 'CAISSE_EDIT':
      case 'CAISSE_DELETE':
        return {
          label: 'Caisse',
          color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
          dot: 'bg-teal-400',
          icon: Layers,
        };
      case 'TICKET_CREATE':
      case 'TICKET_ASSIGN':
      case 'TICKET_PAY':
      case 'TICKET_DELETE':
      case 'TICKET_BATCH_DELETE':
        return {
          label: 'Billets',
          color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          dot: 'bg-indigo-400',
          icon: Ticket,
        };
      case 'USER_CREATE':
      case 'USER_EDIT':
      case 'USER_DELETE':
        return {
          label: 'Utilisateurs',
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          dot: 'bg-purple-400',
          icon: ShieldAlert,
        };
      case 'BACKUP_EXPORT':
      case 'BACKUP_RESTORE':
        return {
          label: 'Sauvegarde',
          color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
          dot: 'bg-cyan-400',
          icon: Database,
        };
      case 'AFB160_GENERATE':
      case 'REPORT_EXPORT':
        return {
          label: 'Exportation',
          color: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          dot: 'bg-sky-400',
          icon: FileSpreadsheet,
        };
      case 'ACTIVITY_CLEAR':
        return {
          label: 'Réinitialisation',
          color: 'bg-red-500/20 text-red-300 border-red-500/40',
          dot: 'bg-red-500',
          icon: AlertTriangle,
        };
      default:
        return {
          label: 'Système',
          color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
          dot: 'bg-slate-400',
          icon: Activity,
        };
    }
  };

  // Helper date formatter
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const secs = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} à ${hours}:${mins}:${secs}`;
    } catch {
      return isoStr;
    }
  };

  // Relative time helper
  const getRelativeTime = (isoStr: string) => {
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 60) return "À l'instant";
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Il y a ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Hier';
      if (diffDays < 7) return `Il y a ${diffDays} j`;
      return '';
    } catch {
      return '';
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredActivities.length === 0) return;
    const headers = ['Date & Heure', 'Utilisateur', 'Rôle', 'Action', 'Description', 'Détails'];
    const rows = filteredActivities.map((act) => [
      formatDate(act.timestamp),
      act.userName,
      act.userRole,
      act.action,
      `"${(act.description || '').replace(/"/g, '""')}"`,
      `"${(act.details || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `journal_activite_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (showToast) showToast('Journal exporté au format CSV');
  };

  const hasAccess = isAdmin || Boolean(currentUser.canAccessActivite);

  if (!hasAccess) {
    return (
      <div className="bg-[#0d1627] border border-gray-800 rounded-2xl p-8 text-center max-w-lg mx-auto mt-12 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Accès non autorisé</h3>
        <p className="text-sm text-gray-400 leading-relaxed mb-4">
          Vous ne disposez pas de l’autorisation nécessaire pour consulter le suivi d’activité des utilisateurs.
        </p>
        <p className="text-xs text-gray-500">
          Veuillez contacter l’administrateur principal pour vous accorder les droits d'accès au module "Suivi d'Activité".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d1627] border border-gray-800/80 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Suivi d’Activité & Audit Trail
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                {activities.length} événements
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Historique complet et chronologique des actions effectuées sur le système.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => fetchActivities(false)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-200 text-xs font-medium border border-gray-700/60 transition-all disabled:opacity-50"
            title="Rafraîchir les données"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredActivities.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-200 text-xs font-medium border border-gray-700/60 transition-all disabled:opacity-50"
            title="Exporter la liste filtrée en CSV"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Export CSV</span>
          </button>

          {/* Reset Activity Button: ADMIN ONLY */}
          {isAdmin ? (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-semibold border border-rose-500/30 transition-all shadow-sm"
              title="Réinitialiser l'historique complet (Action administrateur)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Réinitialiser l’activité</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800/40 text-gray-500 text-xs border border-gray-800 cursor-not-allowed select-none"
              title="Seul l’administrateur peut réinitialiser le journal d’activité"
            >
              <Lock className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Admin seul autorisé à réinitialiser</span>
              <span className="sm:hidden">Réinitialisation verrouillée</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Total Actions
            </p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.total}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Événements enregistrés</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Aujourd'hui
            </p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{stats.today}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Actions sur 24h</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Utilisateurs
            </p>
            <h3 className="text-2xl font-bold text-blue-400 mt-1">{stats.activeUsers}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Ayant effectué des actions</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <UserIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Actions Sensibles
            </p>
            <h3 className="text-2xl font-bold text-rose-400 mt-1">{stats.sensitive}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Suppressions / Restorations</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0d1627] border border-gray-800/80 rounded-2xl p-4 space-y-4 shadow-md">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par utilisateur, action, description ou détails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900/90 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                Effacer
              </button>
            )}
          </div>

          {/* User Filter Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900/90 border border-gray-700/80 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">Tous les utilisateurs ({uniqueUsers.length})</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Period Dropdown */}
          <div className="w-full md:w-44">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900/90 border border-gray-700/80 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">Toutes les dates</option>
              <option value="TODAY">Aujourd'hui</option>
              <option value="7DAYS">7 derniers jours</option>
              <option value="30DAYS">30 derniers jours</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-800/60">
          {[
            { id: 'ALL', label: 'Toutes les actions' },
            { id: 'AUTH', label: 'Connexions' },
            { id: 'TRANSACTIONS', label: 'Transactions Caisse' },
            { id: 'TICKETS', label: 'Billets & Tombola' },
            { id: 'CAISSES', label: 'Paramètres Caisses' },
            { id: 'USERS', label: 'Gestion Utilisateurs' },
            { id: 'BACKUP_AFB', label: 'Sauvegardes & AFB160' },
            { id: 'SENSITIVE', label: 'Actions Sensibles' },
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-gray-800/60 hover:bg-gray-800 text-gray-300 border border-gray-700/40'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activities Table */}
      <div className="bg-[#0d1627] border border-gray-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#111c33] text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th scope="col" className="px-5 py-3.5">
                  Date & Heure
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Utilisateur
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Action
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Description de l'activité
                </th>
                <th scope="col" className="px-5 py-3.5 text-right">
                  Détails
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
                    Chargement du journal d’activité...
                  </td>
                </tr>
              ) : filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-gray-500">
                    <Activity className="w-10 h-10 mx-auto mb-3 text-gray-600 opacity-60" />
                    <p className="text-gray-300 font-medium">Aucun événement trouvé</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {searchQuery || selectedCategory !== 'ALL' || selectedUser !== 'ALL'
                        ? 'Essayez de modifier vos critères de recherche ou vos filtres.'
                        : 'Aucune activité n’a encore été enregistrée.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredActivities.map((act) => {
                  const meta = getActionMeta(act.action);
                  const IconComp = meta.icon;
                  const relativeTime = getRelativeTime(act.timestamp);
                  const isExpanded = expandedDetailsId === act.id;

                  return (
                    <React.Fragment key={act.id}>
                      <tr className="hover:bg-gray-800/30 transition-colors">
                        {/* Timestamp */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-300">
                          <div className="font-semibold text-gray-200">
                            {formatDate(act.timestamp)}
                          </div>
                          {relativeTime && (
                            <span className="text-[11px] text-teal-400/90 font-medium">
                              {relativeTime}
                            </span>
                          )}
                        </td>

                        {/* User */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 text-xs font-bold uppercase shrink-0">
                              {(act.userName || 'U').charAt(0)}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-white">
                                {act.userName}
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  act.userRole === 'admin'
                                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                    : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                                }`}
                              >
                                {act.userRole === 'admin' ? 'Admin' : 'Utilisateur'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Action badge */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.color}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            <IconComp className="w-3 h-3" />
                            <span>{meta.label}</span>
                          </span>
                        </td>

                        {/* Description */}
                        <td className="px-5 py-3.5 text-xs text-gray-200 font-medium">
                          <div className="max-w-xl break-words">{act.description}</div>
                        </td>

                        {/* Details Trigger */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          {act.details ? (
                            <button
                              onClick={() =>
                                setExpandedDetailsId(isExpanded ? null : act.id)
                              }
                              className="text-xs text-teal-400 hover:text-teal-300 font-medium underline inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isExpanded ? 'Masquer' : 'Voir'}</span>
                            </button>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && act.details && (
                        <tr className="bg-[#0b1220] border-t border-b border-gray-800">
                          <td colSpan={5} className="px-7 py-3">
                            <div className="p-3 bg-gray-900/90 rounded-xl border border-gray-800 text-xs font-mono text-gray-300 space-y-1">
                              <span className="text-[11px] text-teal-400 font-sans font-semibold uppercase tracking-wider block">
                                Informations complémentaires :
                              </span>
                              <p className="whitespace-pre-wrap">{act.details}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-[#111c33] border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <div>
            Affichage de <span className="font-semibold text-white">{filteredActivities.length}</span>{' '}
            sur <span className="font-semibold text-white">{activities.length}</span> événement(s)
          </div>
          <div className="text-[11px] text-gray-500">
            Seul l'administrateur peut purger ou réinitialiser le journal d'activité.
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Admin Reset */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Réinitialiser le journal d’activité ?
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Opération d'administration critique
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-200 leading-relaxed space-y-2">
              <p className="font-semibold flex items-center gap-1.5 text-rose-300">
                <Lock className="w-4 h-4" />
                Attention : Action irréversible réservée à l’administrateur.
              </p>
              <p>
                Cette action va effacer définitivement tout l’historique des connexions, ajouts,
                modifications et suppressions. Un unique enregistrement d’audit mentionnant votre
                réinitialisation sera créé.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleResetActivities}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/50 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Réinitialisation...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmer la réinitialisation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
