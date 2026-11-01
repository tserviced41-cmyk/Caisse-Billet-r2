import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  ShieldAlert,
  Cloud,
  CheckCircle2,
  ExternalLink,
  History,
  RotateCcw,
  AlertCircle,
  FileJson,
  UserCheck,
  LogOut,
} from 'lucide-react';
import { api } from '../utils/api';
import { initialCaisseDb } from '../data/caisseSeed';
import { User as AppUser } from '../types/caisse';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  uploadBackupToGoogleDrive,
  listDriveBackups,
  downloadBackupFromGoogleDrive,
  initGoogleAuth,
  DriveFileItem,
} from '../utils/googleDriveBackup';
import { User as FirebaseUser } from 'firebase/auth';

interface BackupViewProps {
  currentUser?: AppUser;
  onRefreshData: () => Promise<void>;
  showToast: (msg: string) => void;
}

export const BackupView: React.FC<BackupViewProps> = ({
  currentUser,
  onRefreshData,
  showToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [driveBackups, setDriveBackups] = useState<DriveFileItem[]>([]);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<DriveFileItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Listen to Google Auth state
  useEffect(() => {
    const unsubscribe = initGoogleAuth((user, token) => {
      setGoogleUser(user);
      if (user && token) {
        loadDriveFiles();
      } else {
        setDriveBackups([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadDriveFiles = async () => {
    try {
      setDriveError(null);
      const files = await listDriveBackups();
      setDriveBackups(files);
    } catch (err: any) {
      console.warn('Erreur chargement sauvegardes Drive:', err);
      setDriveError(err.message || 'Impossible de lister les fichiers Drive');
    }
  };

  const handleGoogleConnect = async () => {
    try {
      setDriveLoading(true);
      setDriveError(null);
      const session = await connectGoogleDrive();
      setGoogleUser(session.user);
      showToast(`Compte Google connecté : ${session.user.email}`);
      const files = await listDriveBackups();
      setDriveBackups(files);
    } catch (err: any) {
      setDriveError(err.message || 'Erreur lors de la connexion Google');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await disconnectGoogleDrive();
      setGoogleUser(null);
      setDriveBackups([]);
      setLastUploadedFile(null);
      showToast('Compte Google déconnecté');
    } catch (err: any) {
      showToast('Erreur lors de la déconnexion');
    }
  };

  const handleSaveToGoogleDrive = async () => {
    try {
      setDriveLoading(true);
      setDriveError(null);
      const data = await api.getBackup();
      const uploaded = await uploadBackupToGoogleDrive(data);
      setLastUploadedFile(uploaded);
      showToast(`Sauvegarde enregistrée avec succès sur votre Google Drive !`);
      await loadDriveFiles();
      try {
        await api.logActivity(
          'BACKUP_DRIVE',
          `Sauvegarde exportée vers Google Drive (${uploaded.name})`,
          `Fichier ID: ${uploaded.id}`
        );
      } catch {}
    } catch (err: any) {
      setDriveError(err.message || 'Erreur lors de la sauvegarde sur Google Drive');
      alert('Erreur Google Drive : ' + err.message);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleRestoreFromDrive = async (file: DriveFileItem) => {
    if (
      !confirm(
        `Confirmez-vous la restauration de la base de données depuis le fichier Google Drive "${file.name}" ?\n\nToutes les données actuelles seront remplacées par celles contenues dans cette sauvegarde.`
      )
    ) {
      return;
    }

    try {
      setDriveLoading(true);
      const data = await downloadBackupFromGoogleDrive(file.id);
      if (!data || !Array.isArray(data.caisses)) {
        throw new Error('Fichier de sauvegarde Drive invalide ou corrompu.');
      }
      await api.restoreBackup(data);
      try {
        localStorage.removeItem('gestion_caisse_billets');
      } catch {}
      await onRefreshData();
      showToast(`Base de données restaurée avec succès depuis Google Drive (${file.name}) !`);
      try {
        await api.logActivity(
          'BACKUP_RESTORE',
          `Restauration réussie depuis Google Drive (${file.name})`
        );
      } catch {}
    } catch (err: any) {
      alert('Erreur lors de la restauration : ' + err.message);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setLoading(true);
      const data = await api.getBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
      a.href = url;
      a.download = `sauvegarde_caisse_multicaisse_${dateStr}_${timeStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Sauvegarde téléchargée avec succès sur votre ordinateur.');
    } catch (err: any) {
      alert('Erreur lors du téléchargement : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFile = async (file: File) => {
    try {
      setLoading(true);
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json || !Array.isArray(json.caisses)) {
        throw new Error('Format de fichier de sauvegarde invalide.');
      }
      await api.restoreBackup(json);
      try {
        localStorage.removeItem('gestion_caisse_billets');
      } catch {}
      await onRefreshData();
      showToast('Base de données restaurée avec succès (caisses, transactions, utilisateurs, billets).');
    } catch (err: any) {
      alert('Erreur lors de la restauration : ' + err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetToDemo = async () => {
    if (window.confirm('Voulez-vous réinitialiser les données aux caisses et transactions de démonstration ?')) {
      try {
        setLoading(true);
        await api.restoreBackup(initialCaisseDb);
        try {
          localStorage.removeItem('gestion_caisse_billets');
        } catch {}
        await onRefreshData();
        showToast('Données réinitialisées avec succès.');
      } catch (err: any) {
        alert('Erreur : ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2.5">
            <span>Sauvegarde & Google Drive</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Exportez, sécurisez et restaurez l’ensemble de vos caisses, transactions, utilisateurs et billets dans le Cloud Google Drive ou en local.
          </p>
        </div>
      </div>

      {/* --- GOOGLE DRIVE BACKUP SECTION --- */}
      <div className="bg-gradient-to-br from-white via-white to-teal-50/40 rounded-2xl border border-teal-200/80 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">
                  Sauvegarde Cloud via Google Drive
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 rounded-full">
                  Nouveau
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Enregistrez vos données directement dans votre espace Google Drive personnel ou professionnel.
              </p>
            </div>
          </div>

          {/* Account status / Connect button */}
          <div>
            {googleUser ? (
              <div className="flex items-center gap-3 p-2 px-3 bg-teal-50 border border-teal-200 rounded-xl">
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'Google'}
                    className="w-7 h-7 rounded-full border border-teal-300"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                    {(googleUser.email || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <div className="text-xs font-bold text-teal-900 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span>{googleUser.displayName || 'Compte Google'}</span>
                  </div>
                  <div className="text-[11px] text-teal-700 font-medium">
                    {googleUser.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  title="Déconnecter ce compte Google"
                  className="p-1.5 text-teal-600 hover:text-red-600 hover:bg-white rounded-lg transition cursor-pointer ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleConnect}
                disabled={driveLoading}
                className="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50 font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Connecter mon Compte Google</span>
              </button>
            )}
          </div>
        </div>

        {driveError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{driveError}</span>
          </div>
        )}

        {/* Action Button & Description */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="sm:col-span-2 space-y-1">
            <h4 className="text-sm font-bold text-gray-900">
              Créer une sauvegarde instantanée sur Google Drive
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Exporte toutes les écritures de caisses, billetterie, attributions et permissions sous un fichier horodaté sécurisé dans votre Google Drive. Vous pouvez ensuite restaurer l'état de l'application à tout moment depuis ce cloud.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleSaveToGoogleDrive}
              disabled={driveLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {driveLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sauvegarde en cours...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>Sauvegarder sur Google Drive</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success message banner */}
        {lastUploadedFile && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Fichier enregistré sur votre Drive : <strong>{lastUploadedFile.name}</strong>
              </span>
            </div>
            {lastUploadedFile.webViewLink && (
              <a
                href={lastUploadedFile.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 underline ml-2"
              >
                <span>Ouvrir sur Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* List of files in Google Drive */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-teal-600" />
              <span>Sauvegardes disponibles sur votre Google Drive ({driveBackups.length})</span>
            </h4>
            {googleUser && (
              <button
                type="button"
                onClick={loadDriveFiles}
                disabled={driveLoading}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${driveLoading ? 'animate-spin' : ''}`} />
                <span>Actualiser la liste</span>
              </button>
            )}
          </div>

          {!googleUser ? (
            <div className="p-6 rounded-xl bg-gray-50/60 border border-gray-200 text-center space-y-2">
              <Cloud className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-xs text-gray-600 font-medium">
                Connectez votre compte Google ci-dessus pour afficher et restaurer vos sauvegardes Drive.
              </p>
            </div>
          ) : driveBackups.length === 0 ? (
            <div className="p-6 rounded-xl bg-gray-50/60 border border-gray-200 text-center space-y-1">
              <p className="text-xs text-gray-500">
                Aucune sauvegarde trouvée dans votre Google Drive pour le moment.
              </p>
              <p className="text-[11px] text-gray-400">
                Cliquez sur "Sauvegarder sur Google Drive" pour créer votre première copie Cloud.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
              {driveBackups.map((file) => (
                <div
                  key={file.id}
                  className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-gray-50/80 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-teal-50 text-teal-700 rounded-lg shrink-0">
                      <FileJson className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-gray-900 truncate">{file.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {file.createdTime
                          ? new Date(file.createdTime).toLocaleString('fr-FR')
                          : 'Date inconnue'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex items-center gap-1 font-medium"
                        title="Voir le fichier sur Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Drive</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRestoreFromDrive(file)}
                      disabled={driveLoading}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                      title="Restaurer cette sauvegarde dans l'application"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurer</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- LOCAL BACKUP & RESTORE SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-3">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Exporter sur mon appareil (Fichier JSON)
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Téléchargez un fichier de sauvegarde complet directement sur votre disque dur local (PC, tablette ou smartphone).
            </p>
          </div>

          <button
            onClick={handleDownloadBackup}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#00897b] hover:bg-[#00796b] text-white font-semibold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Télécharger la sauvegarde locale</span>
          </button>
        </div>

        {/* Restore Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Restaurer depuis un fichier local
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Chargez un fichier de sauvegarde précédemment exporté depuis votre ordinateur ou téléphone pour restaurer l'état.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleRestoreFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>Choisir un fichier de sauvegarde (.json)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone (Admin only) */}
      {isAdmin && (
        <div className="bg-red-50/50 border border-red-200/80 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-900">
                Zone de réinitialisation (Administrateur uniquement)
              </h4>
              <p className="text-xs text-red-700 mt-1 mb-4">
                Rétablissez les données de démonstration avec les 3 caisses exemples (FVB Ambodisina, Fanorenana, Fanatitra II) et leurs écritures.
              </p>
              <button
                onClick={handleResetToDemo}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réinitialiser aux données exemples</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
