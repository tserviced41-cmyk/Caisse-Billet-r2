import { User, Caisse, Transaction, DatabaseState, ActivityItem } from '../types/caisse';

let inMemoryUser: User | null = null;

export function getStoredUser(): User | null {
  if (inMemoryUser) return inMemoryUser;
  try {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem('caisse_auth_user');
    } catch {}
    if (!raw) {
      try {
        raw = localStorage.getItem('caisse_auth_user');
      } catch {}
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        inMemoryUser = parsed;
        return parsed;
      }
    }
    return null;
  } catch {
    return inMemoryUser;
  }
}

export function setStoredUser(user: User | null) {
  inMemoryUser = user;
  try {
    if (user) {
      const payload = JSON.stringify(user);
      try { sessionStorage.setItem('caisse_auth_user', payload); } catch {}
      try { localStorage.setItem('caisse_auth_user', payload); } catch {}
    } else {
      try { sessionStorage.removeItem('caisse_auth_user'); } catch {}
      try { localStorage.removeItem('caisse_auth_user'); } catch {}
    }
  } catch {}
}


function getAuthHeaders(): HeadersInit {
  const user = getStoredUser();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  };
  if (user?.id) {
    headers['x-user-id'] = user.id;
  }
  return headers;
}

export const api = {
  async getSyncStatus(): Promise<{
    revision: number;
    lastModified: number;
    serverTime: string;
    counts: {
      caisses: number;
      transactions: number;
      tickets: number;
      users: number;
      activities: number;
    };
  }> {
    const res = await fetch(`/api/sync/status?_t=${Date.now()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Erreur de synchronisation');
    return res.json();
  },

  async getMe(): Promise<User> {
    const res = await fetch(`/api/auth/me?_t=${Date.now()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Session expirée');
    }
    const user = await res.json();
    setStoredUser(user);
    return user;
  },

  async login(username: string, password: string): Promise<User> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Identifiant ou mot de passe incorrect');
    }
    const data = await res.json();
    setStoredUser(data.user);
    return data.user;
  },

  async getCaisses(): Promise<Caisse[]> {
    const res = await fetch(`/api/caisses?_t=${Date.now()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Impossible de charger les caisses');
    return res.json();
  },

  async createCaisse(data: Partial<Caisse>): Promise<Caisse> {
    const res = await fetch('/api/caisses', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la création de la caisse');
    }
    return res.json();
  },

  async updateCaisse(id: string, data: Partial<Caisse>): Promise<Caisse> {
    const res = await fetch(`/api/caisses/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erreur lors de la modification');
    return res.json();
  },

  async deleteCaisse(id: string): Promise<void> {
    const res = await fetch(`/api/caisses/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression de la caisse');
  },

  async getTransactions(caisseId?: string): Promise<Transaction[]> {
    const url = caisseId
      ? `/api/transactions?caisseId=${caisseId}&_t=${Date.now()}`
      : `/api/transactions?_t=${Date.now()}`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Impossible de charger les transactions');
    return res.json();
  },

  async createTransaction(tx: {
    caisseId: string;
    type: 'entree' | 'sortie';
    montant: number;
    date: string;
    motif?: string;
    responsable?: string;
  }): Promise<Transaction> {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(tx),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l’enregistrement');
    }
    return res.json();
  },

  async batchImportTransactions(caisseId: string, transactions: any[]): Promise<number> {
    const res = await fetch('/api/transactions/batch', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ caisseId, transactions }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l’importation');
    }
    const data = await res.json();
    return data.count;
  },

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la modification de la transaction');
    }
    return res.json();
  },

  async deleteTransaction(id: string): Promise<void> {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Erreur de suppression de la transaction');
  },

  async batchDeleteTransactions(ids: string[]): Promise<number> {
    const res = await fetch('/api/transactions/batch-delete', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la suppression groupée');
    }
    const data = await res.json();
    return data.deletedCount;
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch(`/api/users?_t=${Date.now()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Accès réservé à l’administrateur');
    return res.json();
  },

  async createUser(user: Partial<User>): Promise<User> {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur de création de l’utilisateur');
    }
    return res.json();
  },

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error('Erreur de mise à jour');
    return res.json();
  },

  async deleteUser(id: string): Promise<void> {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Erreur de suppression');
  },

  async getTickets(): Promise<any[]> {
    const res = await fetch(`/api/tickets?_t=${Date.now()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Impossible de charger les billets');
    return res.json();
  },

  async updateTicket(id: string, data: any): Promise<any> {
    // Send via POST /api/tickets/update to prevent URL path segment issues with slashes or spaces
    const res = await fetch('/api/tickets/update', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) {
      // Fallback to PUT
      const fallbackRes = await fetch(`/api/tickets/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        cache: 'no-store',
        body: JSON.stringify(data),
      });
      if (!fallbackRes.ok) {
        const err = await fallbackRes.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la modification du billet');
      }
      return fallbackRes.json();
    }
    return res.json();
  },

  async generateTickets(params: {
    campagne: string;
    startNum: number;
    endNum: number;
    prix: number;
    groupe: string;
  }): Promise<{ count: number; total: number; _revision: number }> {
    const res = await fetch('/api/tickets/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la génération des billets');
    }
    return res.json();
  },

  async batchAssignTickets(params: {
    start: number;
    end: number;
    groupe?: string;
    beneficiaire?: string;
    telephone?: string;
    paye?: boolean;
    campagne?: string;
  }): Promise<{ updatedCount: number; _revision: number }> {
    const res = await fetch('/api/tickets/batch-assign', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l’attribution groupée');
    }
    return res.json();
  },

  async batchToggleTicketsPaye(
    ids: string[],
    paye: boolean
  ): Promise<{ updatedCount: number; paye: boolean; totalPaid: number; totalAmount: number; _revision: number }> {
    const res = await fetch('/api/tickets/batch-toggle-paye', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ ids, paye }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la mise à jour groupée des paiements');
    }
    return res.json();
  },

  async batchPayNumbers(params: {
    startNum: number;
    endNum: number;
    paye?: boolean;
    campagne?: string;
  }): Promise<{ updatedCount: number; startNum: number; endNum: number; paye: boolean; totalPaid: number; totalAmount: number; _revision: number }> {
    const res = await fetch('/api/tickets/batch-pay-numbers', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la validation par numéro');
    }
    return res.json();
  },

  async restorePaidTarget(params?: {
    targetCount?: number;
    mode?: 'range_1_to_n' | 'first_n';
  }): Promise<{ restoredCount: number; totalPaid: number; totalAmount: number; _revision: number }> {
    const res = await fetch('/api/tickets/restore-paid-target', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(params || { targetCount: 590, mode: 'range_1_to_n' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la restauration des billets');
    }
    return res.json();
  },

  async syncTickets(tickets: any[], reason?: string): Promise<void> {
    const res = await fetch('/api/tickets/sync', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ tickets, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la synchronisation des billets');
    }
  },

  async deleteTicket(id: string): Promise<void> {
    const res = await fetch('/api/tickets/delete', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      // Fallback
      const fallbackRes = await fetch(`/api/tickets/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!fallbackRes.ok) {
        const err = await fallbackRes.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la suppression du billet');
      }
    }
  },

  async batchDeleteTickets(ids: string[]): Promise<number> {
    const res = await fetch('/api/tickets/batch-delete', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la suppression groupée');
    }
    const data = await res.json();
    return data.deletedCount;
  },

  async getBackup(): Promise<DatabaseState> {
    const res = await fetch(`/api/backup?_t=${Date.now()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Accès réservé');
    return res.json();
  },

  async restoreBackup(data: DatabaseState): Promise<void> {
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Restauration échouée');
  },

  async getActivities(): Promise<ActivityItem[]> {
    const res = await fetch(`/api/activities?_t=${Date.now()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Impossible de charger le journal d’activité');
    }
    return res.json();
  },

  async logActivity(action: string, description: string, details?: string): Promise<ActivityItem> {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ action, description, details }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l’enregistrement de l’activité');
    }
    return res.json();
  },

  async clearActivities(): Promise<void> {
    const res = await fetch('/api/activities/clear', {
      method: 'POST',
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Seul l’administrateur peut réinitialiser le journal d’activité');
    }
  },
};
