import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { initialCaisseDb } from './src/data/caisseSeed';
import { DatabaseState, User, Caisse, Transaction, ActivityItem, ActivityActionType } from './src/types/caisse';

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data', 'caisse_db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

const BAK_FILE = path.join(process.cwd(), 'data', 'caisse_db.json.bak');

let dbRevision = 1;
let dbLastModified = Date.now();

// Initialize Cloud Firestore client
const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const fbConfig = firebaseConfig as any;
const firestoreDb = fbConfig.firestoreDatabaseId && fbConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(fbApp, fbConfig.firestoreDatabaseId)
  : getFirestore(fbApp);
const CLOUD_STATE_DOC = doc(firestoreDb, 'system', 'database_state');

// Helper to sanitize loaded DB and ensure caisses and tickets remain completely decoupled
function sanitizeLoadedDb(parsed: DatabaseState) {
  if (Array.isArray(parsed.transactions)) {
    // Billets and caisses are strictly distinct: remove any automatic ticket sale entries
    parsed.transactions = parsed.transactions.filter(
      (t) => !t.motif || !t.motif.startsWith('Vente billet')
    );
  }
  if (Array.isArray(parsed.tickets)) {
    parsed.tickets.forEach((t) => {
      if (t.id && t.id.includes('/')) {
        t.id = t.id.replace(/\//g, '_');
      }
    });
  }
}

// Load or initialize DB safely without ever clobbering user data
function loadDb(): DatabaseState {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      if (content.trim()) {
        const parsed: DatabaseState = JSON.parse(content);
        if (Array.isArray(parsed.caisses) && Array.isArray(parsed.transactions)) {
          if (!Array.isArray(parsed.tickets)) parsed.tickets = [];
          if (!Array.isArray(parsed.activities)) parsed.activities = [];
          if (!Array.isArray(parsed.users) || parsed.users.length === 0) parsed.users = initialCaisseDb.users;
          sanitizeLoadedDb(parsed);
          parsed.revision = typeof parsed.revision === 'number' && parsed.revision > 0 ? parsed.revision : 1;
          parsed.lastModified = parsed.lastModified || Date.now();
          dbRevision = parsed.revision;
          dbLastModified = parsed.lastModified;
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading primary DB file, trying backup...', e);
    }
  }

  // Fallback to backup file if primary file was corrupted
  if (fs.existsSync(BAK_FILE)) {
    try {
      const content = fs.readFileSync(BAK_FILE, 'utf-8');
      if (content.trim()) {
        const parsed: DatabaseState = JSON.parse(content);
        if (Array.isArray(parsed.caisses) && Array.isArray(parsed.transactions)) {
          console.warn('Successfully recovered DB from backup file!');
          if (!Array.isArray(parsed.tickets)) parsed.tickets = [];
          if (!Array.isArray(parsed.activities)) parsed.activities = [];
          sanitizeLoadedDb(parsed);
          console.warn('Successfully recovered DB from backup file!');
          if (!Array.isArray(parsed.tickets)) parsed.tickets = [];
          if (!Array.isArray(parsed.activities)) parsed.activities = [];
          parsed.revision = (parsed.revision || 0) + 1;
          parsed.lastModified = Date.now();
          dbRevision = parsed.revision;
          dbLastModified = parsed.lastModified;
          saveDb(parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.error('Backup DB file also failed', e);
    }
  }

  // Only if NO valid database existed at all
  console.log('Initializing fresh DB with initial seed data');
  const freshDb: DatabaseState = JSON.parse(JSON.stringify(initialCaisseDb));
  freshDb.revision = 1;
  freshDb.lastModified = Date.now();
  dbRevision = 1;
  dbLastModified = freshDb.lastModified;
  saveDb(freshDb);
  return freshDb;
}

let isFirestoreAvailable = true;

function saveDb(db: DatabaseState) {
  try {
    dbRevision = (dbRevision || 0) + 1;
    dbLastModified = Date.now();
    db.revision = dbRevision;
    db.lastModified = dbLastModified;

    const dataStr = JSON.stringify(db, null, 2);
    // Write atomically via a uniquely named temp file to avoid multi-device write conflicts
    const uniqueTmp = path.join(path.dirname(DB_FILE), `caisse_db_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.tmp`);
    fs.writeFileSync(uniqueTmp, dataStr, 'utf-8');
    
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, BAK_FILE);
      } catch {}
    }
    fs.renameSync(uniqueTmp, DB_FILE);

    // Sync to Cloud Firestore asynchronously for 100% durable multi-device storage
    if (isFirestoreAvailable) {
      setDoc(CLOUD_STATE_DOC, JSON.parse(dataStr)).catch((err: any) => {
        if (err?.code === 5 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('not found')) {
          if (isFirestoreAvailable) {
            console.log('[Firestore] Cloud Firestore not provisioned. Using local file storage (/data/caisse_db.json).');
            isFirestoreAvailable = false;
          }
        } else {
          console.warn('[Firestore Live] Sync error:', err);
        }
      });
    }
  } catch (err) {
    console.error('Failed to save DB atomically, fallback to direct write', err);
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
      if (isFirestoreAvailable) {
        setDoc(CLOUD_STATE_DOC, JSON.parse(JSON.stringify(db))).catch((err: any) => {
          if (err?.code === 5 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('not found')) {
            isFirestoreAvailable = false;
          }
        });
      }
    } catch (e2) {
      console.error('Critical failure saving DB', e2);
    }
  }
}

let dbState = loadDb();

// Live bidirectional synchronization with Cloud Firestore
async function initFirestoreCloudSync() {
  if (!isFirestoreAvailable) return;
  try {
    const snap = await getDoc(CLOUD_STATE_DOC).catch((err: any) => {
      if (err?.code === 5 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('not found')) {
        isFirestoreAvailable = false;
        console.log('[Firestore] Cloud Firestore not provisioned. Using local file storage (/data/caisse_db.json).');
        return { exists: () => false } as any;
      }
      throw err;
    });

    if (snap.exists && snap.exists()) {
      const cloudData = snap.data() as DatabaseState;
      if (cloudData && Array.isArray(cloudData.caisses) && (cloudData.revision || 0) >= (dbState.revision || 0)) {
        console.log(`[Firestore] Loaded persisted state from cloud (revision ${cloudData.revision})`);
        sanitizeLoadedDb(cloudData);
        dbState = cloudData;
        dbRevision = cloudData.revision || 1;
        dbLastModified = cloudData.lastModified || Date.now();
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
        } catch {}
      } else {
        // Local is newer: upload to Firestore
        console.log('[Firestore] Local database has higher revision; syncing to Cloud Firestore...');
        await setDoc(CLOUD_STATE_DOC, JSON.parse(JSON.stringify(dbState)));
      }
    } else if (isFirestoreAvailable) {
      console.log('[Firestore] First run: seeding Cloud Firestore with current database...');
      await setDoc(CLOUD_STATE_DOC, JSON.parse(JSON.stringify(dbState))).catch((err: any) => {
        if (err?.code === 5 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('not found')) {
          isFirestoreAvailable = false;
        }
      });
    }

    // Subscribe to live multi-container / multi-instance cloud changes
    if (isFirestoreAvailable) {
      onSnapshot(CLOUD_STATE_DOC, (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data() as DatabaseState;
          if (cloudData && typeof cloudData.revision === 'number' && cloudData.revision > dbRevision) {
            console.log(`[Firestore Live Sync] Cloud revision ${cloudData.revision} received (was ${dbRevision})`);
            sanitizeLoadedDb(cloudData);
            dbState = cloudData;
            dbRevision = cloudData.revision;
            dbLastModified = cloudData.lastModified || Date.now();
            try {
              fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
            } catch {}
          }
        }
      }, (err: any) => {
        if (err?.code === 5 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('not found')) {
          isFirestoreAvailable = false;
        }
      });
    }
  } catch (err: any) {
    if (err?.code === 5 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('not found')) {
      isFirestoreAvailable = false;
      console.log('[Firestore] Cloud Firestore not provisioned. Using local file storage (/data/caisse_db.json).');
    } else {
      console.warn('[Firestore] Sync warning:', err);
    }
  }
}
initFirestoreCloudSync();

const app = express();
app.set('etag', false);
app.use(express.json({ limit: '50mb' }));

// Anti-cache middleware for all API routes: prevents stale responses on multiple devices
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Helper to authenticate user from header
function getAuthUser(req: Request): User | null {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return null;
  return dbState.users.find((u) => u.id === userId) || null;
}

// --- SYNC STATUS & SYSTEM ENDPOINT ---
app.get('/api/sync/status', (_req: Request, res: Response) => {
  res.json({
    revision: dbRevision,
    lastModified: dbLastModified,
    serverTime: new Date().toISOString(),
    counts: {
      caisses: dbState.caisses.length,
      transactions: dbState.transactions.length,
      tickets: (dbState.tickets || []).length,
      users: dbState.users.length,
      activities: (dbState.activities || []).length,
    },
  });
});

// --- CURRENT USER PROFILE & PERMISSIONS ---
function formatSafeUser(u: User): Omit<User, 'password'> {
  const { password: _, ...safeUser } = u;
  return {
    ...safeUser,
    caissePermissions: safeUser.caissePermissions || {},
    canAccessAfb160: safeUser.role === 'admin' ? true : Boolean(safeUser.canAccessAfb160),
    billetsPermission: safeUser.role === 'admin' ? 'write' : (safeUser.billetsPermission || 'none'),
    canPrintBillets: safeUser.role === 'admin' ? true : Boolean(safeUser.canPrintBillets),
    canAccessActivite: safeUser.role === 'admin' ? true : Boolean(safeUser.canAccessActivite),
  };
}

// --- CURRENT USER PROFILE & PERMISSIONS ---
app.get('/api/auth/me', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Session non valide ou utilisateur introuvable' });
  }
  res.json(formatSafeUser(authUser));
});

// Helper to record user activity
function recordActivity(
  action: ActivityActionType,
  description: string,
  userOrReq?: User | Request | null,
  details?: string
): ActivityItem {
  let user: User | null = null;
  if (userOrReq) {
    if ('headers' in userOrReq) {
      user = getAuthUser(userOrReq as Request);
    } else {
      user = userOrReq as User;
    }
  }

  const activityItem: ActivityItem = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    userId: user ? user.id : 'system',
    userName: user ? (user.fullName || user.username) : 'Système',
    userRole: user ? user.role : 'admin',
    action,
    description,
    details,
  };

  if (!dbState.activities) {
    dbState.activities = [];
  }
  dbState.activities.unshift(activityItem);
  // Cap at 3000 to keep reasonable file size
  if (dbState.activities.length > 3000) {
    dbState.activities = dbState.activities.slice(0, 3000);
  }
  saveDb(dbState);
  return activityItem;
}

// --- AUTH ROUTES ---
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();

  // Find user
  const user = dbState.users.find(
    (u) => u.username.toLowerCase() === cleanUser && u.password === cleanPass
  );

  if (!user) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }

  // Record login activity
  recordActivity(
    'LOGIN',
    `Connexion réussie de l’utilisateur "${user.fullName || user.username}" (${user.role === 'admin' ? 'Administrateur' : 'Utilisateur'})`,
    user
  );

  // Return formatted safe user
  res.json({ user: formatSafeUser(user) });
});


// --- USERS MANAGEMENT (Admin only) ---
app.get('/api/users', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l’administrateur' });
  }
  const safeUsers = dbState.users.map(({ password: _, ...u }) => u);
  res.json(safeUsers);
});

app.post('/api/users', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l’administrateur' });
  }

  const { username, password, fullName, role, caissePermissions, canAccessAfb160, billetsPermission, canPrintBillets, canAccessActivite } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  const exists = dbState.users.some(
    (u) => u.username.toLowerCase() === String(username).trim().toLowerCase()
  );
  if (exists) {
    return res.status(400).json({ error: 'Cet identifiant existe déjà' });
  }

  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    username: String(username).trim(),
    password: String(password).trim(),
    fullName: String(fullName || username).trim(),
    role: role === 'admin' ? 'admin' : 'user',
    caissePermissions: caissePermissions || {},
    canAccessAfb160: role === 'admin' ? true : Boolean(canAccessAfb160),
    billetsPermission: role === 'admin' ? 'write' : (billetsPermission || 'none'),
    canPrintBillets: role === 'admin' ? true : Boolean(canPrintBillets),
    canAccessActivite: role === 'admin' ? true : Boolean(canAccessActivite),
    createdAt: new Date().toISOString(),
  };

  dbState.users.push(newUser);
  saveDb(dbState);

  recordActivity(
    'USER_CREATE',
    `Création du compte utilisateur "${newUser.fullName}" (@${newUser.username}) avec le rôle ${newUser.role}`,
    authUser
  );

  const { password: _, ...safeUser } = newUser;
  res.json(safeUser);
});

app.put('/api/users/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l’administrateur' });
  }

  const { id } = req.params;
  const userIndex = dbState.users.findIndex((u) => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }

  const { username, fullName, password, role, caissePermissions, canAccessAfb160, billetsPermission, canPrintBillets, canAccessActivite } = req.body;

  if (username && username.trim() !== dbState.users[userIndex].username) {
    const trimmed = username.trim();
    const conflict = dbState.users.some(
      (u) => u.id !== id && u.username.toLowerCase() === trimmed.toLowerCase()
    );
    if (conflict) {
      return res.status(400).json({ error: 'Cet identifiant est déjà utilisé' });
    }
    dbState.users[userIndex].username = trimmed;
  }

  if (fullName !== undefined) dbState.users[userIndex].fullName = fullName;
  if (password) dbState.users[userIndex].password = password;
  if (role !== undefined) dbState.users[userIndex].role = role;
  if (caissePermissions !== undefined) {
    dbState.users[userIndex].caissePermissions = caissePermissions;
  }
  if (canAccessAfb160 !== undefined) {
    dbState.users[userIndex].canAccessAfb160 = role === 'admin' ? true : Boolean(canAccessAfb160);
  }
  if (billetsPermission !== undefined) {
    dbState.users[userIndex].billetsPermission = role === 'admin' ? 'write' : billetsPermission;
  }
  if (canPrintBillets !== undefined) {
    dbState.users[userIndex].canPrintBillets = role === 'admin' ? true : Boolean(canPrintBillets);
  }
  if (canAccessActivite !== undefined) {
    dbState.users[userIndex].canAccessActivite = role === 'admin' ? true : Boolean(canAccessActivite);
  }

  saveDb(dbState);

  recordActivity(
    'USER_EDIT',
    `Modification du compte utilisateur "${dbState.users[userIndex].fullName}" (@${dbState.users[userIndex].username})`,
    authUser
  );

  const { password: _, ...safeUser } = dbState.users[userIndex];
  res.json(safeUser);
});

app.delete('/api/users/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l’administrateur' });
  }

  const { id } = req.params;
  if (id === 'user-admin' || authUser.id === id) {
    return res.status(400).json({ error: 'Impossible de supprimer cet administrateur' });
  }

  const targetUser = dbState.users.find((u) => u.id === id);
  dbState.users = dbState.users.filter((u) => u.id !== id);
  saveDb(dbState);

  recordActivity(
    'USER_DELETE',
    `Suppression du compte utilisateur "${targetUser?.fullName || targetUser?.username || id}"`,
    authUser
  );

  res.json({ success: true });
});

// --- CAISSES ROUTES ---
app.get('/api/caisses', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.json([]);
  }

  if (authUser.role === 'admin') {
    return res.json(dbState.caisses);
  }

  // Filter only caisses where user has permission ('read' or 'write')
  const allowed = dbState.caisses.filter((c) => {
    const perm = authUser.caissePermissions?.[c.id];
    return perm === 'read' || perm === 'write';
  });
  res.json(allowed);
});

app.post('/api/caisses', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Seul l’administrateur peut créer une caisse' });
  }

  const { nom, description, devise, soldeInitial, color } = req.body;
  if (!nom) return res.status(400).json({ error: 'Le nom de la caisse est requis' });

  const newCaisse: Caisse = {
    id: `caisse-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    nom: String(nom).trim(),
    description: description ? String(description).trim() : '',
    devise: devise || 'AR',
    soldeInitial: Number(soldeInitial) || 0,
    statut: 'active',
    color: color || 'blue',
    createdAt: new Date().toISOString(),
  };

  dbState.caisses.push(newCaisse);
  saveDb(dbState);

  recordActivity(
    'CAISSE_CREATE',
    `Création de la caisse "${newCaisse.nom}" (Solde initial: ${newCaisse.soldeInitial.toLocaleString('fr-FR')} ${newCaisse.devise})`,
    authUser
  );

  res.json({ ...newCaisse, _revision: dbRevision });
});

app.put('/api/caisses/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Seul l’administrateur peut modifier une caisse' });
  }

  const { id } = req.params;
  const caisse = dbState.caisses.find((c) => c.id === id);
  if (!caisse) return res.status(404).json({ error: 'Caisse introuvable' });

  const { nom, description, soldeInitial, statut, color } = req.body;
  if (nom !== undefined) caisse.nom = nom;
  if (description !== undefined) caisse.description = description;
  if (soldeInitial !== undefined) caisse.soldeInitial = Number(soldeInitial) || 0;
  if (statut !== undefined) caisse.statut = statut;
  if (color !== undefined) caisse.color = color;

  saveDb(dbState);

  recordActivity(
    'CAISSE_EDIT',
    `Mise à jour des paramètres de la caisse "${caisse.nom}"`,
    authUser
  );

  res.json({ ...caisse, _revision: dbRevision });
});

app.delete('/api/caisses/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Seul l’administrateur peut supprimer une caisse' });
  }

  const { id } = req.params;
  const caisse = dbState.caisses.find((c) => c.id === id);
  const caisseNom = caisse?.nom || id;

  dbState.caisses = dbState.caisses.filter((c) => c.id !== id);
  dbState.transactions = dbState.transactions.filter((t) => t.caisseId !== id);
  saveDb(dbState);

  recordActivity(
    'CAISSE_DELETE',
    `Suppression de la caisse "${caisseNom}" et de ses écritures associées`,
    authUser
  );

  res.json({ success: true, _revision: dbRevision });
});

// --- TRANSACTIONS ROUTES ---
app.get('/api/transactions', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.json([]);

  const { caisseId } = req.query;

  // Check access
  if (authUser.role === 'admin') {
    if (caisseId) {
      return res.json(dbState.transactions.filter((t) => t.caisseId === caisseId));
    }
    return res.json(dbState.transactions);
  }

  // Regular user: only authorized caisses
  const allowedCaisseIds = Object.keys(authUser.caissePermissions || {}).filter(
    (cId) => authUser.caissePermissions[cId] === 'read' || authUser.caissePermissions[cId] === 'write'
  );

  let filtered = dbState.transactions.filter((t) => allowedCaisseIds.includes(t.caisseId));
  if (caisseId && allowedCaisseIds.includes(String(caisseId))) {
    filtered = filtered.filter((t) => t.caisseId === caisseId);
  }
  res.json(filtered);
});

app.post('/api/transactions', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Non authentifié' });

  const { caisseId, type, montant, date, motif, responsable } = req.body;
  if (!caisseId || !type || !montant) {
    return res.status(400).json({ error: 'Caisse, type et montant sont requis' });
  }

  // Check write permission
  if (authUser.role !== 'admin') {
    const perm = authUser.caissePermissions?.[caisseId];
    if (perm !== 'write') {
      return res.status(403).json({ error: 'Vous n’avez pas le droit d’écriture sur cette caisse' });
    }
  }

  const caisse = dbState.caisses.find((c) => c.id === caisseId);
  const newTx: Transaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    caisseId,
    type: type === 'sortie' ? 'sortie' : 'entree',
    montant: Math.abs(Number(montant) || 0),
    date: date || new Date().toISOString().replace('T', ' ').slice(0, 16),
    motif: motif || '',
    responsable: responsable || authUser.fullName || authUser.username,
    createdAt: new Date().toISOString(),
  };

  dbState.transactions.unshift(newTx);
  saveDb(dbState);

  const typeLabel = newTx.type === 'entree' ? 'Entrée (+)' : 'Sortie (-)';
  recordActivity(
    'TRANSACTION_CREATE',
    `Ajout ${typeLabel} de ${newTx.montant.toLocaleString('fr-FR')} Ar dans "${caisse?.nom || 'Caisse'}" : ${newTx.motif || 'Sans motif'}`,
    authUser,
    `Responsable: ${newTx.responsable} | Date: ${newTx.date}`
  );

  res.json({ ...newTx, _revision: dbRevision });
});

app.post('/api/transactions/batch', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Non authentifié' });

  const { caisseId, transactions } = req.body;
  if (!caisseId || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  // Check write permission
  if (authUser.role !== 'admin') {
    const perm = authUser.caissePermissions?.[caisseId];
    if (perm !== 'write') {
      return res.status(403).json({ error: 'Vous n’avez pas le droit d’écriture sur cette caisse' });
    }
  }

  const caisse = dbState.caisses.find((c) => c.id === caisseId);

  const parseBatchDate = (rawDate: any): string => {
    if (!rawDate) return new Date().toISOString().replace('T', ' ').slice(0, 16);
    const num = Number(rawDate);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const utc_days = Math.floor(num - 25569);
      const utc_value = utc_days * 86400;
      const d = new Date(utc_value * 1000);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return String(rawDate).trim();
  };

  const created: Transaction[] = transactions.map((t: any) => ({
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    caisseId,
    type: t.type === 'sortie' ? 'sortie' : 'entree',
    montant: Math.abs(Number(t.montant) || 0),
    date: parseBatchDate(t.date),
    motif: t.motif ? String(t.motif).trim() : '',
    responsable: t.responsable ? String(t.responsable).trim() : (authUser.fullName || authUser.username),
    createdAt: new Date().toISOString(),
  }));

  dbState.transactions.unshift(...created);
  saveDb(dbState);

  recordActivity(
    'TRANSACTION_CREATE',
    `Importation de ${created.length} transaction(s) dans la caisse "${caisse?.nom || 'Caisse'}"`,
    authUser
  );

  res.json({ count: created.length, _revision: dbRevision });
});

// Admin-only modification of transaction
app.put('/api/transactions/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'La modification des transactions est réservée à l’administrateur' });
  }

  const { id } = req.params;
  const tx = dbState.transactions.find((t) => t.id === id);
  if (!tx) return res.status(404).json({ error: 'Transaction introuvable' });

  const oldMontant = tx.montant;
  const oldMotif = tx.motif;

  const { caisseId, type, montant, date, motif, responsable } = req.body;
  if (caisseId !== undefined) tx.caisseId = caisseId;
  if (type !== undefined) tx.type = type === 'sortie' ? 'sortie' : 'entree';
  if (montant !== undefined) tx.montant = Math.abs(Number(montant) || 0);
  if (date !== undefined) tx.date = date;
  if (motif !== undefined) tx.motif = motif;
  if (responsable !== undefined) tx.responsable = responsable;

  saveDb(dbState);

  recordActivity(
    'TRANSACTION_EDIT',
    `Modification de la transaction #${id.slice(-6)} (Montant: ${tx.montant.toLocaleString('fr-FR')} Ar, Motif: "${tx.motif}")`,
    authUser,
    `Précédent: ${oldMontant.toLocaleString('fr-FR')} Ar - "${oldMotif}"`
  );

  res.json({ ...tx, _revision: dbRevision });
});

// Batch delete transactions (Admin only)
app.post('/api/transactions/batch-delete', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'La suppression des transactions est réservée à l’administrateur' });
  }

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Liste d’identifiants requise' });
  }

  const idsSet = new Set(ids);
  const beforeCount = dbState.transactions.length;
  dbState.transactions = dbState.transactions.filter((t) => !idsSet.has(t.id));
  const deletedCount = beforeCount - dbState.transactions.length;
  saveDb(dbState);

  recordActivity(
    'TRANSACTION_DELETE',
    `Suppression groupée de ${deletedCount} transaction(s)`,
    authUser
  );

  res.json({ deletedCount, _revision: dbRevision });
});

// Single delete transaction (Admin only)
app.delete('/api/transactions/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'La suppression des transactions est réservée à l’administrateur' });
  }

  const { id } = req.params;
  const tx = dbState.transactions.find((t) => t.id === id);
  if (!tx) return res.status(404).json({ error: 'Transaction introuvable' });

  dbState.transactions = dbState.transactions.filter((t) => t.id !== id);
  saveDb(dbState);

  recordActivity(
    'TRANSACTION_DELETE',
    `Suppression de la transaction #${id.slice(-6)} (${tx.type.toUpperCase()}: ${tx.montant.toLocaleString('fr-FR')} Ar - "${tx.motif}")`,
    authUser
  );

  res.json({ success: true, _revision: dbRevision });
});

// --- TICKETS / BILLETS MANAGEMENT ---
app.get('/api/tickets', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && (!authUser.billetsPermission || authUser.billetsPermission === 'none')) {
    return res.status(403).json({ error: 'Accès non autorisé au module billets' });
  }
  res.json(dbState.tickets || []);
});

// Helper to find ticket by ID with full resilience against URL encoding, slashes, and special characters
function findTicketIndex(id: string): number {
  if (!dbState.tickets || !id) return -1;
  const clean = String(id).trim();
  const decoded = (() => {
    try {
      return decodeURIComponent(clean);
    } catch {
      return clean;
    }
  })();
  const sanitized = clean.replace(/\//g, '_');
  const sanitizedDecoded = decoded.replace(/\//g, '_');
  return dbState.tickets.findIndex(
    (t) =>
      t.id === clean ||
      t.id === decoded ||
      t.id === sanitized ||
      t.id === sanitizedDecoded ||
      (t.id && t.id.replace(/\//g, '_') === sanitized) ||
      (t.id && t.id.replace(/\//g, '_') === sanitizedDecoded)
  );
}

// Update a single ticket via POST (immune to URL segment/encoding issues)
app.post('/api/tickets/update', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && authUser.billetsPermission !== 'write') {
    return res.status(403).json({ error: 'Droits d’écriture requis pour modifier un billet' });
  }

  const { id, beneficiaire, groupe, telephone, paye, prix } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Identifiant du billet requis' });
  }

  if (!dbState.tickets) dbState.tickets = [];
  const ticketIndex = findTicketIndex(String(id));
  if (ticketIndex === -1) {
    return res.status(404).json({ error: 'Billet introuvable' });
  }

  const current = dbState.tickets[ticketIndex];
  if (beneficiaire !== undefined) current.beneficiaire = String(beneficiaire).trim();
  if (groupe !== undefined) current.groupe = String(groupe).trim();
  if (telephone !== undefined) current.telephone = String(telephone).trim();
  if (paye !== undefined) current.paye = Boolean(paye);
  if (prix !== undefined) current.prix = Number(prix) || current.prix;

  saveDb(dbState);

  recordActivity(
    'TICKET_ASSIGN',
    `Mise à jour du billet N° ${current.numero} (${current.campagne}) - ${current.beneficiaire || 'Non attribué'} (${current.paye ? 'Payé' : 'Impayé'})`,
    authUser
  );

  res.json({ ticket: current, _revision: dbRevision });
});

// Update a single ticket (granular - prevents multi-device overwrite)
app.put(['/api/tickets/:id', '/api/tickets/*'], (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && authUser.billetsPermission !== 'write') {
    return res.status(403).json({ error: 'Droits d’écriture requis pour modifier un billet' });
  }

  const rawId = req.params.id || (req.params as any)[0] || req.url.replace(/^\/api\/tickets\//, '').split('?')[0];
  if (!dbState.tickets) dbState.tickets = [];
  const ticketIndex = findTicketIndex(rawId);
  if (ticketIndex === -1) {
    return res.status(404).json({ error: 'Billet introuvable' });
  }

  const { beneficiaire, groupe, telephone, paye, prix } = req.body;
  const current = dbState.tickets[ticketIndex];
  if (beneficiaire !== undefined) current.beneficiaire = String(beneficiaire).trim();
  if (groupe !== undefined) current.groupe = String(groupe).trim();
  if (telephone !== undefined) current.telephone = String(telephone).trim();
  if (paye !== undefined) current.paye = Boolean(paye);
  if (prix !== undefined) current.prix = Number(prix) || current.prix;

  saveDb(dbState);

  recordActivity(
    'TICKET_ASSIGN',
    `Mise à jour du billet N° ${current.numero} (${current.campagne}) - ${current.beneficiaire || 'Non attribué'} (${current.paye ? 'Payé' : 'Impayé'})`,
    authUser
  );

  res.json({ ticket: current, _revision: dbRevision });
});

// Generate tickets range atomically on server
app.post('/api/tickets/generate', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && authUser.billetsPermission !== 'write') {
    return res.status(403).json({ error: 'Droits d’écriture requis pour générer des billets' });
  }

  const { campagne, startNum, endNum, prix, groupe } = req.body;
  const sNum = parseInt(startNum, 10);
  const eNum = parseInt(endNum, 10);
  if (isNaN(sNum) || isNaN(eNum) || sNum > eNum) {
    return res.status(400).json({ error: 'Plage de numéros invalide' });
  }

  if (!dbState.tickets) dbState.tickets = [];
  const existingSet = new Set(
    dbState.tickets
      .filter((t) => t.campagne === campagne)
      .map((t) => t.numero)
  );

  const newTickets: any[] = [];
  const now = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeCampagne = String(campagne || 'Opération').trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  for (let n = sNum; n <= eNum; n++) {
    if (!existingSet.has(n)) {
      newTickets.push({
        id: `tkt-${safeCampagne}-${n}-${now}-${Math.random().toString(36).substring(2, 6)}`,
        numero: n,
        campagne: String(campagne || 'Opération').trim(),
        prix: Number(prix) || 10000,
        groupe: String(groupe || 'Général').trim(),
        beneficiaire: '',
        telephone: '',
        paye: false,
        dateAttribution: dateStr,
      });
    }
  }

  dbState.tickets.push(...newTickets);
  saveDb(dbState);

  recordActivity(
    'TICKET_CREATE',
    `Génération de ${newTickets.length} billet(s) (N° ${sNum} à ${eNum}) pour "${campagne}"`,
    authUser
  );

  res.json({ count: newTickets.length, total: dbState.tickets.length, _revision: dbRevision });
});

// Batch assign tickets by range atomically on server
app.post('/api/tickets/batch-assign', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && authUser.billetsPermission !== 'write') {
    return res.status(403).json({ error: 'Droits d’écriture requis pour attribuer des billets' });
  }

  const { start, end, groupe, beneficiaire, telephone, paye, campagne } = req.body;
  const s = parseInt(start, 10);
  const e = parseInt(end, 10);
  if (isNaN(s) || isNaN(e) || s > e) {
    return res.status(400).json({ error: 'Plage de numéros invalide' });
  }

  if (!dbState.tickets) dbState.tickets = [];
  let updatedCount = 0;
  const today = new Date().toISOString().slice(0, 10);

  dbState.tickets.forEach((t) => {
    const matchCampagne = !campagne || campagne === 'Tous' || t.campagne === campagne;
    if (matchCampagne && t.numero >= s && t.numero <= e) {
      if (groupe !== undefined) t.groupe = String(groupe).trim();
      if (beneficiaire !== undefined) t.beneficiaire = String(beneficiaire).trim();
      if (telephone !== undefined) t.telephone = String(telephone).trim();
      if (paye !== undefined) t.paye = Boolean(paye);
      t.dateAttribution = today;
      updatedCount++;
    }
  });

  saveDb(dbState);

  recordActivity(
    'TICKET_ASSIGN',
    `Attribution groupée de ${updatedCount} billet(s) (N° ${s} à ${e}) à "${beneficiaire || 'Sans nom'}" (${groupe || 'Indéfini'})`,
    authUser
  );

  res.json({ updatedCount, _revision: dbRevision });
});

// Atomic batch toggle payment for selected tickets (single disk & Cloud Firestore commit)
app.post('/api/tickets/batch-toggle-paye', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && authUser.billetsPermission !== 'write') {
    return res.status(403).json({ error: 'Droits d’écriture requis pour modifier les billets' });
  }

  const { ids, paye } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Liste d’identifiants de billets requise' });
  }

  const idsSet = new Set(ids.map((id: any) => String(id).trim()));
  if (!dbState.tickets) dbState.tickets = [];

  let updatedCount = 0;
  dbState.tickets.forEach((t) => {
    if (idsSet.has(t.id) || (t.id && idsSet.has(t.id.replace(/\//g, '_')))) {
      t.paye = Boolean(paye);
      updatedCount++;
    }
  });

  saveDb(dbState);

  const totalPaid = dbState.tickets.filter((t) => t.paye).length;
  const totalAmount = totalPaid * 10000;

  recordActivity(
    'TICKET_ASSIGN',
    `Mise à jour groupée : ${updatedCount} billet(s) marqués comme ${paye ? 'Payés' : 'Impayés'} (Total actuel : ${totalPaid} billets payés = ${totalAmount.toLocaleString('fr-FR')} Ar)`,
    authUser
  );

  res.json({
    success: true,
    updatedCount,
    paye: Boolean(paye),
    totalPaid,
    totalAmount,
    _revision: dbRevision,
  });
});

// Atomic batch pay tickets by number range (e.g. N° 1 à 590)
app.post('/api/tickets/batch-pay-numbers', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && authUser.billetsPermission !== 'write') {
    return res.status(403).json({ error: 'Droits d’écriture requis pour modifier les billets' });
  }

  const { startNum, endNum, paye = true, campagne } = req.body;
  const sNum = parseInt(startNum, 10);
  const eNum = parseInt(endNum, 10);
  if (isNaN(sNum) || isNaN(eNum) || sNum > eNum) {
    return res.status(400).json({ error: 'Plage de numéros invalide' });
  }

  if (!dbState.tickets) dbState.tickets = [];
  let updatedCount = 0;

  dbState.tickets.forEach((t) => {
    const matchCampagne = !campagne || campagne === 'Tous' || t.campagne === campagne;
    if (matchCampagne && t.numero >= sNum && t.numero <= eNum) {
      t.paye = Boolean(paye);
      updatedCount++;
    }
  });

  saveDb(dbState);

  const totalPaid = dbState.tickets.filter((t) => t.paye).length;
  const totalAmount = totalPaid * 10000;

  recordActivity(
    'TICKET_ASSIGN',
    `Validation groupée par numéro : Billets N° ${sNum} à ${eNum} (${updatedCount} billets) marqués comme ${paye ? 'Payés' : 'Impayés'} (Total : ${totalPaid} payés)`,
    authUser
  );

  res.json({
    success: true,
    updatedCount,
    startNum: sNum,
    endNum: eNum,
    paye: Boolean(paye),
    totalPaid,
    totalAmount,
    _revision: dbRevision,
  });
});

// Restore exact paid tickets count (e.g. 590 tickets = 5,900,000 Ar) atomically
app.post('/api/tickets/restore-paid-target', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && authUser.billetsPermission !== 'write') {
    return res.status(403).json({ error: 'Droits requis pour restaurer les billets' });
  }

  const { targetCount = 590, mode = 'range_1_to_n' } = req.body;
  if (!dbState.tickets) dbState.tickets = [];

  dbState.tickets.sort((a, b) => a.numero - b.numero);

  let paidCount = 0;
  if (mode === 'range_1_to_n') {
    dbState.tickets.forEach((t) => {
      if (t.numero >= 1 && t.numero <= Number(targetCount)) {
        t.paye = true;
        paidCount++;
      } else {
        t.paye = false;
      }
    });
  } else {
    let c = 0;
    dbState.tickets.forEach((t) => {
      if (c < Number(targetCount)) {
        t.paye = true;
        c++;
        paidCount++;
      } else {
        t.paye = false;
      }
    });
  }

  saveDb(dbState);

  const totalAmount = paidCount * 10000;

  recordActivity(
    'TICKET_ASSIGN',
    `Restauration des paiements : ${paidCount} billets validés comme payés (Total encaissé : ${totalAmount.toLocaleString('fr-FR')} Ar)`,
    authUser
  );

  res.json({
    success: true,
    restoredCount: paidCount,
    totalPaid: paidCount,
    totalAmount,
    _revision: dbRevision,
  });
});

// Smart merge sync (non-destructive: never deletes tickets that weren't in an explicit delete call)
app.post('/api/tickets/sync', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && authUser.billetsPermission !== 'write') {
    return res.status(403).json({ error: 'Droits d’écriture requis pour synchroniser les billets' });
  }

  const { tickets, reason } = req.body;
  if (!Array.isArray(tickets)) {
    return res.status(400).json({ error: 'Format de billets invalide' });
  }

  if (!dbState.tickets) dbState.tickets = [];

  // Map existing tickets by ID
  const map = new Map<string, any>();
  dbState.tickets.forEach((t) => map.set(t.id, t));

  // Merge incoming tickets
  tickets.forEach((t) => {
    if (t.id) {
      map.set(t.id, { ...(map.get(t.id) || {}), ...t });
    }
  });

  dbState.tickets = Array.from(map.values());
  saveDb(dbState);

  recordActivity(
    'TICKET_ASSIGN',
    reason || `Synchronisation sécurisée des billets (${dbState.tickets.length} billets au total)`,
    authUser
  );

  res.json({ success: true, count: dbState.tickets.length, _revision: dbRevision });
});

// Delete single ticket via POST (immune to URL segment/encoding issues)
app.post('/api/tickets/delete', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'La suppression des billets est réservée à l’administrateur' });
  }

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Identifiant requis' });

  if (!dbState.tickets) dbState.tickets = [];
  const ticketIndex = findTicketIndex(String(id));
  if (ticketIndex === -1) return res.status(404).json({ error: 'Billet introuvable' });

  const targetTicket = dbState.tickets[ticketIndex];
  dbState.tickets.splice(ticketIndex, 1);
  saveDb(dbState);

  recordActivity(
    'TICKET_DELETE',
    `Suppression du billet N° ${targetTicket?.numero || id} (${targetTicket?.campagne || 'Opération'})`,
    authUser
  );

  res.json({ success: true, _revision: dbRevision });
});

app.delete(['/api/tickets/:id', '/api/tickets/*'], (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'La suppression des billets est réservée à l’administrateur' });
  }

  const rawId = req.params.id || (req.params as any)[0] || req.url.replace(/^\/api\/tickets\//, '').split('?')[0];
  if (!dbState.tickets) dbState.tickets = [];
  const ticketIndex = findTicketIndex(rawId);
  if (ticketIndex === -1) return res.status(404).json({ error: 'Billet introuvable' });

  const targetTicket = dbState.tickets[ticketIndex];
  dbState.tickets.splice(ticketIndex, 1);
  saveDb(dbState);

  recordActivity(
    'TICKET_DELETE',
    `Suppression du billet N° ${targetTicket?.numero || rawId} (${targetTicket?.campagne || 'Opération'})`,
    authUser
  );

  res.json({ success: true, _revision: dbRevision });
});

app.post('/api/tickets/batch-delete', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'La suppression des billets est réservée à l’administrateur' });
  }

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Liste d’identifiants requise' });
  }

  const idsSet = new Set(ids);
  const beforeCount = (dbState.tickets || []).length;
  dbState.tickets = (dbState.tickets || []).filter((t) => !idsSet.has(t.id));
  const deletedCount = beforeCount - (dbState.tickets || []).length;
  saveDb(dbState);

  recordActivity(
    'TICKET_BATCH_DELETE',
    `Suppression groupée de ${deletedCount} billet(s)`,
    authUser
  );

  res.json({ deletedCount, _revision: dbRevision });
});

// --- ACTIVITY LOG ROUTES ---
app.get('/api/activities', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authUser.role !== 'admin' && !authUser.canAccessActivite) {
    return res.status(403).json({ error: 'Accès non autorisé au suivi d’activité' });
  }
  res.json(dbState.activities || []);
});

app.post('/api/activities', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  const { action, description, details } = req.body;
  if (!action || !description) {
    return res.status(400).json({ error: 'Action et description requises' });
  }
  const item = recordActivity(action, description, authUser, details);
  res.json(item);
});

// CRITICAL REQUIREMENT: "admin seulement peu reinitialiser l'activité"
app.post('/api/activities/clear', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({
      error: 'Seul l’administrateur a le droit de réinitialiser le journal d’activité',
    });
  }

  // Clear activities and place one initial reset record
  dbState.activities = [
    {
      id: `act-${Date.now()}-reset`,
      timestamp: new Date().toISOString(),
      userId: authUser.id,
      userName: authUser.fullName || authUser.username,
      userRole: 'admin',
      action: 'ACTIVITY_CLEAR',
      description: `Journal d’activité réinitialisé par l’administrateur (${authUser.fullName || authUser.username})`,
    },
  ];
  saveDb(dbState);
  res.json({ success: true, activities: dbState.activities });
});

// --- BACKUP & RESTORE ---
app.get('/api/backup', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || (authUser.role !== 'admin' && !authUser.canBackupDrive)) {
    return res.status(403).json({ error: 'Accès réservé aux utilisateurs autorisés' });
  }

  recordActivity(
    'BACKUP_EXPORT',
    `Téléchargement du fichier de sauvegarde complète du système`,
    authUser
  );

  res.json(dbState);
});

app.post('/api/restore', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || (authUser.role !== 'admin' && !authUser.canBackupDrive)) {
    return res.status(403).json({ error: 'Accès réservé aux utilisateurs autorisés' });
  }

  const newState = req.body;
  if (!newState || !Array.isArray(newState.caisses) || !Array.isArray(newState.users)) {
    return res.status(400).json({ error: 'Fichier de sauvegarde invalide' });
  }

  if (!Array.isArray(newState.tickets)) {
    newState.tickets = dbState.tickets || [];
  }
  if (!Array.isArray(newState.activities)) {
    newState.activities = dbState.activities || [];
  }

  dbState = newState;
  saveDb(dbState);

  recordActivity(
    'BACKUP_RESTORE',
    `Restauration complète du système effectuée par l’administrateur`,
    authUser
  );

  res.json({ success: true });
});

// --- VITE MIDDLEWARE SETUP ---
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
