export type UserRole = 'admin' | 'user';

export type CaissePermissionLevel = 'none' | 'read' | 'write';

export type BilletsPermissionLevel = 'none' | 'read' | 'write';

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  caissePermissions: Record<string, CaissePermissionLevel>; // caisseId -> permission
  canAccessAfb160?: boolean; // Permission to view AFB160 tab
  billetsPermission?: BilletsPermissionLevel; // Permission for tickets module
  canPrintBillets?: boolean; // Permission to view/use ticket printing
  canAccessActivite?: boolean; // Permission to view activity log tab
  canBackupDrive?: boolean; // Permission to perform Google Drive backup
  createdAt: string;
}

export interface Caisse {
  id: string;
  nom: string;
  description?: string;
  devise: string; // 'AR'
  soldeInitial: number;
  statut: 'active' | 'fermee';
  color: string;
  createdAt: string;
}

export type TransactionType = 'entree' | 'sortie';

export interface Transaction {
  id: string;
  caisseId: string;
  type: TransactionType;
  montant: number;
  date: string; // ISO format or YYYY-MM-DD HH:mm
  motif: string;
  responsable: string;
  createdAt: string;
}

export interface TicketItem {
  id: string;
  numero: number;
  campagne: string;
  session?: string; // New field for session
  prix: number;
  groupe: string;
  beneficiaire: string;
  telephone: string;
  paye: boolean;
  dateAttribution: string;
}

export type ActivityActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'TRANSACTION_CREATE'
  | 'TRANSACTION_EDIT'
  | 'TRANSACTION_DELETE'
  | 'CAISSE_CREATE'
  | 'CAISSE_EDIT'
  | 'CAISSE_DELETE'
  | 'TICKET_CREATE'
  | 'TICKET_ASSIGN'
  | 'TICKET_PAY'
  | 'TICKET_DELETE'
  | 'TICKET_BATCH_DELETE'
  | 'USER_CREATE'
  | 'USER_EDIT'
  | 'USER_DELETE'
  | 'AFB160_GENERATE'
  | 'REPORT_EXPORT'
  | 'BACKUP_EXPORT'
  | 'BACKUP_RESTORE'
  | 'BACKUP_DRIVE'
  | 'ACTIVITY_CLEAR'
  | 'SYSTEM';

export interface ActivityItem {
  id: string;
  timestamp: string; // ISO format
  userId: string;
  userName: string;
  userRole: UserRole;
  action: ActivityActionType;
  description: string;
  details?: string;
}

export interface DatabaseState {
  users: User[];
  caisses: Caisse[];
  transactions: Transaction[];
  tickets?: TicketItem[];
  activities?: ActivityItem[];
  version: number;
  revision?: number;
  lastModified?: number;
}

