import React from 'react';
import {
  LayoutDashboard,
  WalletCards,
  ArrowLeftRight,
  Landmark,
  Users,
  Database,
  LogOut,
  Wallet,
  Menu,
  X,
  Ticket,
  History,
} from 'lucide-react';
import { User } from '../types/caisse';

export type NavigationTab =
  | 'dashboard'
  | 'caisses'
  | 'transactions'
  | 'afb160'
  | 'billets'
  | 'activite'
  | 'users'
  | 'backup';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  currentUser: User;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onLogout,
  isOpenMobile,
  onCloseMobile,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      adminOnly: false,
      visible: true,
    },
    {
      id: 'caisses' as NavigationTab,
      label: 'Caisses',
      icon: WalletCards,
      adminOnly: false,
      visible: true,
    },
    {
      id: 'transactions' as NavigationTab,
      label: 'Transactions',
      icon: ArrowLeftRight,
      adminOnly: false,
      visible: true,
    },
    {
      id: 'afb160' as NavigationTab,
      label: 'Générateur AFB160',
      icon: Landmark,
      adminOnly: false,
      visible: isAdmin || Boolean(currentUser.canAccessAfb160),
    },
    {
      id: 'billets' as NavigationTab,
      label: 'Gestion des Billets',
      icon: Ticket,
      adminOnly: false,
      visible: isAdmin || (currentUser.billetsPermission !== undefined ? currentUser.billetsPermission !== 'none' : false),
    },
    {
      id: 'activite' as NavigationTab,
      label: "Suivi d'Activité",
      icon: History,
      adminOnly: false,
      visible: isAdmin || Boolean(currentUser.canAccessActivite),
    },
    {
      id: 'users' as NavigationTab,
      label: 'Utilisateurs',
      icon: Users,
      adminOnly: true,
      visible: isAdmin,
    },
    {
      id: 'backup' as NavigationTab,
      label: 'Sauvegarde & Drive',
      icon: Database,
      adminOnly: false,
      visible: isAdmin || Boolean(currentUser.canBackupDrive),
    },
  ];

  const handleNavClick = (tabId: NavigationTab) => {
    onSelectTab(tabId);
    onCloseMobile();
  };

  const userInitial = (currentUser.fullName || currentUser.username || 'A')
    .charAt(0)
    .toUpperCase();

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-[#0b1329] text-gray-200 select-none">
      {/* Top Header & Branding */}
      <div>
        <div className="p-5 flex items-center justify-between border-b border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-300 shadow-inner">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white leading-tight">
                Caisse & Billet-dot
              </h2>
              <span className="text-[11px] text-teal-400/90 font-medium">
                Multicaisse & Billetterie
              </span>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#15233e] text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-emerald-400' : 'text-gray-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  )}
                </button>
              );
            })}
        </nav>
      </div>

      {/* Bottom User Profile Card */}
      <div className="p-4 border-t border-gray-800/80 bg-[#080e1e]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-teal-700/50 border border-teal-500/40 flex items-center justify-center font-bold text-teal-200 text-sm shadow-xs">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {currentUser.fullName || currentUser.username}
            </p>
            <p className="text-[11px] text-teal-400/90 truncate flex items-center gap-1">
              <span>{isAdmin ? 'Administrateur' : 'Utilisateur caissier'}</span>
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-300 hover:text-red-100 bg-red-950/30 hover:bg-red-900/50 border border-red-800/30 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:block w-64 h-screen shrink-0 sticky top-0 border-r border-gray-800/80 shadow-2xl z-30">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop and sidebar */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-slideRight">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
