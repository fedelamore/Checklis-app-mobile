import Dexie, { Table } from 'dexie';

// Tipos para o banco de dados
export interface ChecklistDB {
  id?: number;
  serverId?: number; // ID do servidor quando vier da API
  titulo: string;
  campos: any[]; // JSON dos campos do formulário
  syncStatus: 'local_only' | 'syncing' | 'synced' | 'conflict' | 'error';
  lastModified: number;
  createdAt: number;
}

export interface FormResponseDB {
  id?: number;
  checklistId: number; // ID local do checklist
  serverChecklistId?: number; // ID do checklist no servidor
  serverResponseId?: number; // ID da resposta no servidor
  formValues: Record<string, any>; // Valores preenchidos do formulário
  isComplete: boolean;
  syncStatus: 'local_only' | 'syncing' | 'synced' | 'conflict' | 'error';
  lastModified: number;
  createdAt: number;
}

export interface FieldResponseDB {
  id?: number;
  responseId: number; // ID local da resposta
  serverResponseId?: number; // ID da resposta no servidor
  fieldId: number; // ID do campo
  serverFieldId?: number; // ID do campo no servidor
  valor: any;
  syncStatus: 'local_only' | 'syncing' | 'synced' | 'conflict' | 'error';
  lastModified: number;
  createdAt: number;
}

export interface SyncQueueDB {
  id?: number;
  type: 'CREATE_RESPONSE' | 'UPDATE_FIELD' | 'SUBMIT_FORM' | 'UPLOAD_FILE';
  payload: any;
  retryCount: number;
  maxRetries: number;
  priority: number; // menor = maior prioridade
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
  createdAt: number;
  lastAttempt?: number;
}

export interface FileQueueDB {
  id?: number;
  fieldResponseId: number;
  fileName: string;
  fileData: string; // base64
  mimeType: string;
  syncStatus: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  createdAt: number;
}

// Configuração do Dexie
class ChecklistDatabase extends Dexie {
  checklists!: Table<ChecklistDB, number>;
  formResponses!: Table<FormResponseDB, number>;
  fieldResponses!: Table<FieldResponseDB, number>;
  syncQueue!: Table<SyncQueueDB, number>;
  fileQueue!: Table<FileQueueDB, number>;

  constructor() {
    super('ChecklistAppDB');

    // IMPORTANTE: Removemos o índice composto e usamos apenas índices simples
    // Versão 3: Simplificando schema sem índice composto problemático
    this.version(3).stores({
      checklists: '++id, serverId, syncStatus, lastModified',
      formResponses: '++id, checklistId, serverChecklistId, serverResponseId, syncStatus, lastModified',
      fieldResponses: '++id, responseId, serverResponseId, fieldId, serverFieldId, syncStatus, lastModified',
      syncQueue: '++id, type, status, priority, createdAt',
      fileQueue: '++id, fieldResponseId, syncStatus, createdAt'
    });
  }
}

// Instância única do banco
export const db = new ChecklistDatabase();

// Funções utilitárias
export const clearAllData = async () => {
  await db.checklists.clear();
  await db.formResponses.clear();
  await db.fieldResponses.clear();
  await db.syncQueue.clear();
  await db.fileQueue.clear();
};

export const getDatabaseStats = async () => {
  return {
    checklists: await db.checklists.count(),
    formResponses: await db.formResponses.count(),
    fieldResponses: await db.fieldResponses.count(),
    syncQueue: await db.syncQueue.count(),
    fileQueue: await db.fileQueue.count(),
  };
};

// Debug: verifica se o compound index existe
export const debugDatabaseSchema = async () => {
  try {
    console.log('[DB Debug] Database version:', db.verno);
    console.log('[DB Debug] Database name:', db.name);

    // Tenta usar o compound index
    const testQuery = db.fieldResponses.where('[responseId+fieldId]');
    console.log('[DB Debug] Compound index [responseId+fieldId] exists:', !!testQuery);

    // Lista todos os índices da tabela fieldResponses
    const schema = db.table('fieldResponses').schema;
    console.log('[DB Debug] fieldResponses indexes:', schema.indexes.map(idx => idx.name));
    console.log('[DB Debug] fieldResponses primKey:', schema.primKey.name);

    return {
      version: db.verno,
      compoundIndexExists: !!testQuery,
      indexes: schema.indexes.map(idx => idx.name)
    };
  } catch (error) {
    console.error('[DB Debug] Error checking schema:', error);
    return { error: String(error) };
  }
};

// Força a recriação do banco deletando e recriando (use apenas para debug/troubleshooting)
export const recreateDatabase = async () => {
  try {
    console.log('[DB] Deleting database...');
    await db.delete();
    console.log('[DB] Database deleted, reloading page to recreate...');
    window.location.reload();
  } catch (error) {
    console.error('[DB] Error recreating database:', error);
    throw error;
  }
};
