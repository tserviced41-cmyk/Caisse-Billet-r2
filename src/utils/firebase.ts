import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { initialCaisseDb } from '../data/caisseSeed';
import { Caisse, Transaction, User, ActivityItem } from '../types/caisse';

// Initialize Firebase App
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID if provided
const fbConfig = firebaseConfig as any;
export const firestoreDb = fbConfig.firestoreDatabaseId && fbConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(firebaseApp, fbConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Test connection on boot per Firebase guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing cache.');
    } else if (error?.code === 5 || error?.message?.includes('NOT_FOUND') || error?.message?.includes('not found')) {
      // Suppress NOT_FOUND when Firestore is not provisioned
    }
  }
}
testConnection();

// Collection references
export const caissesCol = collection(firestoreDb, 'caisses');
export const transactionsCol = collection(firestoreDb, 'transactions');
export const ticketsCol = collection(firestoreDb, 'tickets');
export const usersCol = collection(firestoreDb, 'users');
export const activitiesCol = collection(firestoreDb, 'activities');

let isSeeding = false;

// Seed initial database into Firestore if Firestore is empty
export async function seedFirestoreIfNeeded(localDbSnapshot?: typeof initialCaisseDb) {
  if (isSeeding) return;
  isSeeding = true;
  try {
    const usersSnap = await getDocs(usersCol).catch((err: any) => {
      if (err?.code === 5 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('not found')) {
        return { empty: true };
      }
      throw err;
    });
    if (!usersSnap.empty) {
      isSeeding = false;
      return; // Already initialized!
    }

    console.log('Bootstrapping Firestore with initial multi-caisse database...');
    const sourceData = localDbSnapshot || initialCaisseDb;
    const batch = writeBatch(firestoreDb);

    // Seed users
    for (const u of sourceData.users || []) {
      const ref = doc(firestoreDb, 'users', u.id);
      batch.set(ref, u);
    }

    // Seed caisses
    for (const c of sourceData.caisses || []) {
      const ref = doc(firestoreDb, 'caisses', c.id);
      batch.set(ref, c);
    }

    // Seed transactions
    for (const t of sourceData.transactions || []) {
      const ref = doc(firestoreDb, 'transactions', t.id);
      batch.set(ref, t);
    }

    // Seed tickets (if any)
    for (const tkt of sourceData.tickets || []) {
      const ref = doc(firestoreDb, 'tickets', tkt.id);
      batch.set(ref, tkt);
    }

    // Seed activities (if any)
    for (const act of sourceData.activities || []) {
      const ref = doc(firestoreDb, 'activities', act.id);
      batch.set(ref, act);
    }

    await batch.commit();
    console.log('Firestore bootstrapped successfully!');
  } catch (err: any) {
    if (err?.code === 5 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('not found')) {
      // Ignore NOT_FOUND if Firestore is not provisioned
    } else {
      console.error('Error seeding Firestore:', err);
    }
  } finally {
    isSeeding = false;
  }
}
