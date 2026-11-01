import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory token and user caching (strictly no localStorage/sessionStorage for token)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: FirebaseUser | null = null;
let isSigningIn = false;

// Subscribe to Firebase Auth state
export const initGoogleAuth = (
  onStateChange?: (user: FirebaseUser | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, (user) => {
    cachedGoogleUser = user;
    if (!user) {
      cachedAccessToken = null;
    }
    if (onStateChange) {
      onStateChange(user, cachedAccessToken);
    }
  });
};

export const getCachedAccessToken = (): string | null => cachedAccessToken;
export const getCachedGoogleUser = (): FirebaseUser | null => cachedGoogleUser;

/**
 * Connect with Google account & request Google Drive permission
 */
export const connectGoogleDrive = async (): Promise<{
  user: FirebaseUser;
  accessToken: string;
}> => {
  if (isSigningIn) {
    throw new Error('Connexion Google déjà en cours...');
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Impossible d'obtenir le jeton d'accès Google Drive.");
    }
    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erreur authentification Google Drive:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Connexion annulée par l’utilisateur.');
    }
    if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('Une autre fenêtre de connexion était déjà ouverte.');
    }
    throw new Error(error.message || 'Erreur lors de la connexion Google');
  } finally {
    isSigningIn = false;
  }
};

/**
 * Sign out of Google account
 */
export const disconnectGoogleDrive = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedGoogleUser = null;
};

export interface DriveFileItem {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  webViewLink?: string;
}

/**
 * Upload database backup JSON directly to user's Google Drive
 */
export const uploadBackupToGoogleDrive = async (
  backupData: any,
  customName?: string
): Promise<DriveFileItem> => {
  let token = cachedAccessToken;
  if (!token) {
    const session = await connectGoogleDrive();
    token = session.accessToken;
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = customName || `Sauvegarde_Caisse_Multicaisse_${dateStr}_${timeStr}.json`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: `Sauvegarde complète multicaisse & gestion des billets exportée le ${now.toLocaleString('fr-FR')}`,
  };

  const fileContent = JSON.stringify(backupData, null, 2);
  const boundary = `-------GoogleDriveBackupBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    // If token expired, try reconnecting once
    if (response.status === 401) {
      cachedAccessToken = null;
      const session = await connectGoogleDrive();
      return uploadBackupToGoogleDrive(backupData, customName);
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Erreur Google Drive (${response.status})`);
  }

  return response.json();
};

/**
 * List existing backup files in Google Drive
 */
export const listDriveBackups = async (): Promise<DriveFileItem[]> => {
  let token = cachedAccessToken;
  if (!token) {
    return [];
  }

  const query = encodeURIComponent("name contains 'Sauvegarde_Caisse' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,size,webViewLink)&orderBy=createdTime desc&pageSize=15`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = null;
      return [];
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Erreur lors du chargement des sauvegardes Drive');
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Download a backup file from Google Drive by its file ID
 */
export const downloadBackupFromGoogleDrive = async (fileId: string): Promise<any> => {
  let token = cachedAccessToken;
  if (!token) {
    const session = await connectGoogleDrive();
    token = session.accessToken;
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = null;
      const session = await connectGoogleDrive();
      return downloadBackupFromGoogleDrive(fileId);
    }
    throw new Error(`Impossible de télécharger le fichier Google Drive (${response.status})`);
  }

  return response.json();
};
