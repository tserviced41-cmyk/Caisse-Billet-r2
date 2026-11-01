import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Pencil,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  Lock,
  Wallet,
  Ticket,
  Printer,
  History,
  Cloud,
} from 'lucide-react';
import { User, Caisse, CaissePermissionLevel, BilletsPermissionLevel } from '../types/caisse';

interface UsersManagementViewProps {
  users: User[];
  caisses: Caisse[];
  currentUser: User;
  onAddUser: (user: Partial<User>) => Promise<void>;
  onUpdateUser: (id: string, user: Partial<User>) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({
  users,
  caisses,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [permissions, setPermissions] = useState<Record<string, CaissePermissionLevel>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [canAccessAfb160, setCanAccessAfb160] = useState(false);
  const [billetsPermission, setBilletsPermission] = useState<BilletsPermissionLevel>('none');
  const [canPrintBillets, setCanPrintBillets] = useState(false);
  const [canAccessActivite, setCanAccessActivite] = useState(false);
  const [canBackupDrive, setCanBackupDrive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setFullName('');
    setRole('user');
    setCanAccessAfb160(false);
    setBilletsPermission('none');
    setCanPrintBillets(false);
    setCanAccessActivite(false);
    setCanBackupDrive(false);
    // Default: 'none' for all caisses
    const defaultPerms: Record<string, CaissePermissionLevel> = {};
    caisses.forEach((c) => {
      defaultPerms[c.id] = 'none';
    });
    setPermissions(defaultPerms);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setPassword(''); // leave blank if no change
    setFullName(u.fullName);
    setRole(u.role);
    setCanAccessAfb160(u.role === 'admin' ? true : Boolean(u.canAccessAfb160));
    setBilletsPermission(u.role === 'admin' ? 'write' : (u.billetsPermission || 'none'));
    setCanPrintBillets(u.role === 'admin' ? true : Boolean(u.canPrintBillets));
    setCanAccessActivite(u.role === 'admin' ? true : Boolean(u.canAccessActivite));
    setCanBackupDrive(u.role === 'admin' ? true : Boolean(u.canBackupDrive));
    const existingPerms: Record<string, CaissePermissionLevel> = {};
    caisses.forEach((c) => {
      existingPerms[c.id] = u.caissePermissions?.[c.id] || 'none';
    });
    setPermissions(existingPerms);
    setError(null);
    setIsModalOpen(true);
  };

  const handlePermissionChange = (caisseId: string, level: CaissePermissionLevel) => {
    setPermissions((prev) => ({
      ...prev,
      [caisseId]: level,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('L’identifiant est obligatoire.');
      return;
    }

    if (!editingUser && !password.trim()) {
      setError('Le mot de passe est obligatoire pour un nouvel utilisateur.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        const updatePayload: Partial<User> = {
          username: username.trim(),
          fullName: fullName.trim() || username.trim(),
          role,
          caissePermissions: role === 'admin' ? {} : permissions,
          canAccessAfb160: role === 'admin' ? true : canAccessAfb160,
          billetsPermission: role === 'admin' ? 'write' : billetsPermission,
          canPrintBillets: role === 'admin' ? true : (billetsPermission !== 'none' && canPrintBillets),
          canAccessActivite: role === 'admin' ? true : canAccessActivite,
          canBackupDrive: role === 'admin' ? true : canBackupDrive,
        };
        if (password.trim()) {
          updatePayload.password = password.trim();
        }
        await onUpdateUser(editingUser.id, updatePayload);
      } else {
        await onAddUser({
          username: username.trim(),
          password: password.trim(),
          fullName: fullName.trim() || username.trim(),
          role,
          caissePermissions: role === 'admin' ? {} : permissions,
          canAccessAfb160: role === 'admin' ? true : canAccessAfb160,
          billetsPermission: role === 'admin' ? 'write' : billetsPermission,
          canPrintBillets: role === 'admin' ? true : (billetsPermission !== 'none' && canPrintBillets),
          canAccessActivite: role === 'admin' ? true : canAccessActivite,
          canBackupDrive: role === 'admin' ? true : canBackupDrive,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Gestion des Utilisateurs & Autorisations
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Créez les accès de vos collaborateurs et définissez qui peut voir ou modifier chaque caisse.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-[#00897b] hover:bg-[#00796b] text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm hover:shadow transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nouvel utilisateur</span>
        </button>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-3.5 px-4">UTILISATEUR</th>
                <th className="py-3.5 px-4">IDENTIFIANT</th>
                <th className="py-3.5 px-4">RÔLE</th>
                <th className="py-3.5 px-4">ACCÈS AUX CAISSES</th>
                <th className="py-3.5 px-4 text-center">ACTIONS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {users.map((u) => {
                const isSuperAdmin = u.username === 'admin';
                return (
                  <tr key={u.id} className="hover:bg-gray-50/70 transition">
                    {/* Full Name & Avatar */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                          {(u.fullName || u.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{u.fullName}</p>
                          <p className="text-[11px] text-gray-400">Créé le {u.createdAt?.slice(0, 10)}</p>
                        </div>
                      </div>
                    </td>

                    {/* Identifiant / Login */}
                    <td className="py-3.5 px-4 font-mono font-medium text-gray-700 whitespace-nowrap">
                      {u.username}
                    </td>

                    {/* Rôle */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-bold text-[11px]">
                          <Shield className="w-3 h-3" />
                          Administrateur
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-bold text-[11px]">
                          <Users className="w-3 h-3" />
                          Utilisateur
                        </span>
                      )}
                    </td>

                    {/* Droits par caisse */}
                    <td className="py-3.5 px-4">
                      {u.role === 'admin' ? (
                        <span className="text-gray-500 font-medium italic">
                          Accès total à toutes les caisses (Administrateur)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {caisses.map((c) => {
                            const perm = u.caissePermissions?.[c.id] || 'none';
                            if (perm === 'none') {
                              return (
                                <span
                                  key={c.id}
                                  className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded line-through"
                                  title="Aucun accès"
                                >
                                  {c.nom}
                                </span>
                              );
                            }
                            if (perm === 'read') {
                              return (
                                <span
                                  key={c.id}
                                  className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium flex items-center gap-1"
                                  title="Lecture seule"
                                >
                                  <span>{c.nom}</span>
                                  <span className="text-[9px] uppercase font-bold">(Lecture)</span>
                                </span>
                              );
                            }
                            return (
                              <span
                                key={c.id}
                                className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium flex items-center gap-1"
                                title="Lecture & Écriture"
                              >
                                <span>{c.nom}</span>
                                <span className="text-[9px] uppercase font-bold">(Écriture)</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {u.role === 'admin' || u.canAccessAfb160 ? (
                          <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                            Générateur AFB160 : Autorisé
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Générateur AFB160 : Masqué
                          </span>
                        )}

                        {u.role === 'admin' ? (
                          <span className="text-[10px] text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <Ticket className="w-3 h-3 text-purple-600" />
                            Billets : Contrôle total (Admin)
                          </span>
                        ) : u.billetsPermission === 'write' ? (
                          <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <Ticket className="w-3 h-3 text-emerald-600" />
                            Billets : Lecture & Écriture (Sans suppression)
                          </span>
                        ) : u.billetsPermission === 'read' ? (
                          <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                            <Ticket className="w-3 h-3 text-amber-600" />
                            Billets : Lecture seule
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <Ticket className="w-3 h-3 text-gray-400" />
                            Billets : Masqué
                          </span>
                        )}

                        {u.role === 'admin' ? (
                          <span className="text-[10px] text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <Printer className="w-3 h-3 text-blue-600" />
                            Impression Billets : Autorisée (Admin)
                          </span>
                        ) : u.canPrintBillets && u.billetsPermission !== 'none' ? (
                          <span className="text-[10px] text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <Printer className="w-3 h-3 text-blue-600" />
                            Impression Billets : Autorisée
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <Printer className="w-3 h-3 text-gray-400" />
                            Impression Billets : Masquée
                          </span>
                        )}

                        {u.role === 'admin' ? (
                          <span className="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <History className="w-3 h-3 text-indigo-600" />
                            Suivi d'Activité : Contrôle total (Admin)
                          </span>
                        ) : u.canAccessActivite ? (
                          <span className="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <History className="w-3 h-3 text-indigo-600" />
                            Suivi d'Activité : Autorisé (Consultation)
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <History className="w-3 h-3 text-gray-400" />
                            Suivi d'Activité : Masqué
                          </span>
                        )}

                        {u.role === 'admin' ? (
                          <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <Cloud className="w-3 h-3 text-teal-600" />
                            Sauvegarde Drive : Autorisée (Admin)
                          </span>
                        ) : u.canBackupDrive ? (
                          <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <Cloud className="w-3 h-3 text-teal-600" />
                            Sauvegarde Drive : Autorisée
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <Cloud className="w-3 h-3 text-gray-400" />
                            Sauvegarde Drive : Masquée
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                          title="Modifier les droits et le mot de passe"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {!isSuperAdmin && u.id !== currentUser.id && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Supprimer l'utilisateur ${u.username} ?`)) {
                                onDeleteUser(u.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Supprimer l'utilisateur"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden text-gray-900 border border-gray-100 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                    {editingUser ? `Modifier ${editingUser.username}` : 'Créer un nouvel utilisateur'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Définissez l'identifiant, le mot de passe et les caisses autorisées
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {error && (
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-200">
                  {error}
                </div>
              )}

              {/* Login & Password Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Identifiant de connexion (Login)*
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingUser?.username === 'admin'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: caissier1, rabe, etc."
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    {editingUser ? 'Nouveau mot de passe (laisser vide si inchangé)' : 'Mot de passe*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingUser}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={editingUser ? '••••••••' : 'Mot de passe'}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 pr-8 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Full Name & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Nom complet / Fonction
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Jean Paul (Caissier)"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Rôle du compte
                  </label>
                  <select
                    value={role}
                    disabled={editingUser?.username === 'admin'}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    <option value="user">Utilisateur (Droits par caisse)</option>
                    <option value="admin">Administrateur (Accès total)</option>
                  </select>
                </div>
              </div>

              {/* AFB160 Access Toggle */}
              <div className="p-3 bg-teal-50/60 border border-teal-200/70 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={role === 'admin'}
                    checked={role === 'admin' ? true : canAccessAfb160}
                    onChange={(e) => setCanAccessAfb160(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500 border-gray-300"
                  />
                  <div>
                    <span className="font-bold text-gray-800 text-xs block">
                      Accès au module Générateur AFB160 (Virements bancaires)
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      {role === 'admin'
                        ? 'Activé d’office pour l’administrateur'
                        : 'Permet à cet utilisateur d’accéder à l’onglet de génération AFB160'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Suivi Activite Access Toggle */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-200/70 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={role === 'admin'}
                    checked={role === 'admin' ? true : canAccessActivite}
                    onChange={(e) => setCanAccessActivite(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                  />
                  <div>
                    <span className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      Accès au Suivi d'Activité (Journal d'audit des opérations)
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      {role === 'admin'
                        ? 'Activé d’office pour l’administrateur (Seul l’administrateur a le droit de réinitialiser le journal)'
                        : 'Permet à cet utilisateur de voir et exporter l’historique des activités (sans pouvoir le réinitialiser)'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Google Drive Backup Access Toggle */}
              <div className="p-3 bg-teal-50/60 border border-teal-200/70 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={role === 'admin'}
                    checked={role === 'admin' ? true : canBackupDrive}
                    onChange={(e) => setCanBackupDrive(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500 border-gray-300"
                  />
                  <div>
                    <span className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-teal-600" />
                      Autoriser la Sauvegarde vers Google Drive (Compte Google)
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      {role === 'admin'
                        ? 'Activé d’office pour l’administrateur'
                        : 'Permet à cet utilisateur d’accéder à l’onglet Sauvegarde et d’enregistrer des sauvegardes sécurisées sur son propre compte Google Drive'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Billets Module Permissions (When role === 'user') */}
              {role === 'user' && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="mb-2">
                    <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-teal-600" />
                      Autorisation Gestion des Billets (Opération Soupe, Tombola...) :
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Définissez les droits d'accès de l'utilisateur sur le module des billets :
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Option none */}
                    <button
                      type="button"
                      onClick={() => setBilletsPermission('none')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                        billetsPermission === 'none'
                          ? 'border-gray-800 bg-gray-900 text-white shadow-xs'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-bold text-xs">Masqué (Aucun)</div>
                      <div className={`text-[10px] mt-1 ${billetsPermission === 'none' ? 'text-gray-300' : 'text-gray-500'}`}>
                        L'onglet n'apparaît pas dans la barre latérale.
                      </div>
                    </button>

                    {/* Option read */}
                    <button
                      type="button"
                      onClick={() => setBilletsPermission('read')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                        billetsPermission === 'read'
                          ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                          : 'border-amber-200 bg-amber-50/50 text-amber-900 hover:bg-amber-100/50'
                      }`}
                    >
                      <div className="font-bold text-xs">Lecture seule</div>
                      <div className={`text-[10px] mt-1 ${billetsPermission === 'read' ? 'text-amber-100' : 'text-amber-700'}`}>
                        Consultation et impression des rapports uniquement.
                      </div>
                    </button>

                    {/* Option write */}
                    <button
                      type="button"
                      onClick={() => setBilletsPermission('write')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                        billetsPermission === 'write'
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-emerald-200 bg-emerald-50/50 text-emerald-900 hover:bg-emerald-100/50'
                      }`}
                    >
                      <div className="font-bold text-xs">Lecture & Écriture</div>
                      <div className={`text-[10px] mt-1 ${billetsPermission === 'write' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                        Distribution et pointage (sans modification ni suppression).
                      </div>
                    </button>
                  </div>

                  {/* Option: Autoriser l'impression des billets */}
                  <div className="mt-3 p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={billetsPermission === 'none'}
                        checked={billetsPermission !== 'none' && canPrintBillets}
                        onChange={(e) => setCanPrintBillets(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      />
                      <div>
                        <span className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          Autoriser l'impression des billets (Option "Imprimer Billets")
                        </span>
                        <span className="text-[11px] text-gray-500 block">
                          {billetsPermission === 'none'
                            ? 'Activez d’abord l’accès aux billets (Lecture ou Écriture) pour autoriser l’impression'
                            : 'Permet à cet utilisateur de voir et utiliser les boutons d’impression des billets physiques (10x5.5cm, impression par sélection, etc.). Si décoché, l’impression des billets lui sera masquée.'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Specific Caisse Permissions (When role === 'user') */}
              {role === 'user' && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="mb-2">
                    <h4 className="font-bold text-gray-800 text-xs">
                      Autorisations par caisse :
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Choisissez quelles caisses cet utilisateur peut voir ou modifier :
                    </p>
                  </div>

                  <div className="space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                    {caisses.map((caisse) => {
                      const currentPerm = permissions[caisse.id] || 'none';
                      return (
                        <div
                          key={caisse.id}
                          className="p-2.5 rounded-lg bg-white border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-teal-600" />
                            <span className="font-bold text-gray-800">{caisse.nom}</span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px]">
                            {/* Aucun accès */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(caisse.id, 'none')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                                currentPerm === 'none'
                                  ? 'bg-gray-700 text-white shadow-2xs'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              Masqué (Aucun)
                            </button>

                            {/* Lecture seule */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(caisse.id, 'read')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                                currentPerm === 'read'
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              }`}
                            >
                              Lecture seule
                            </button>

                            {/* Écriture */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(caisse.id, 'write')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                                currentPerm === 'write'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              Lecture & Écriture
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 px-4 bg-[#00897b] hover:bg-[#00796b] text-white font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Enregistrement...'
                    : editingUser
                    ? 'Mettre à jour'
                    : 'Créer l’utilisateur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
