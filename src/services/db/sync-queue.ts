import { db, SyncQueueDB, FileQueueDB } from './index';

// ==================== SYNC QUEUE ====================

export const addToSyncQueue = async (
  type: SyncQueueDB['type'],
  payload: any,
  priority: number = 10
): Promise<number> => {
  const id = await db.syncQueue.add({
    type,
    payload,
    retryCount: 0,
    maxRetries: 3,
    priority,
    status: 'pending',
    createdAt: Date.now(),
  });
  return id;
};

export const getPendingSyncItems = async (): Promise<SyncQueueDB[]> => {
  return await db.syncQueue
    .where('status')
    .equals('pending')
    .sortBy('priority');
};

export const getFailedSyncItems = async (): Promise<SyncQueueDB[]> => {
  return await db.syncQueue
    .where('status')
    .equals('failed')
    .toArray();
};

export const updateSyncItemStatus = async (
  id: number,
  status: SyncQueueDB['status'],
  error?: string
): Promise<void> => {
  const updates: Partial<SyncQueueDB> = {
    status,
    lastAttempt: Date.now(),
  };

  if (error) {
    updates.error = error;
  }

  await db.syncQueue.update(id, updates);
};

export const incrementRetryCount = async (id: number): Promise<void> => {
  const item = await db.syncQueue.get(id);
  if (!item) return;

  const newRetryCount = item.retryCount + 1;
  const updates: Partial<SyncQueueDB> = {
    retryCount: newRetryCount,
    lastAttempt: Date.now(),
  };

  // Se excedeu o número de tentativas, marca como failed
  if (newRetryCount >= item.maxRetries) {
    updates.status = 'failed';
  }

  await db.syncQueue.update(id, updates);
};

export const deleteSyncItem = async (id: number): Promise<void> => {
  await db.syncQueue.delete(id);
};

export const clearCompletedSyncItems = async (): Promise<void> => {
  await db.syncQueue.where('status').equals('completed').delete();
};

export const retryFailedSyncItems = async (): Promise<void> => {
  await db.syncQueue
    .where('status')
    .equals('failed')
    .modify({ status: 'pending', retryCount: 0 });
};

export const getSyncQueueStats = async () => {
  const all = await db.syncQueue.toArray();

  return {
    pending: all.filter(item => item.status === 'pending').length,
    processing: all.filter(item => item.status === 'processing').length,
    failed: all.filter(item => item.status === 'failed').length,
    completed: all.filter(item => item.status === 'completed').length,
    total: all.length,
  };
};

// ==================== FILE QUEUE ====================

export const addToFileQueue = async (
  fieldResponseId: number,
  fileName: string,
  fileData: string,
  mimeType: string
): Promise<number> => {
  const id = await db.fileQueue.add({
    fieldResponseId,
    fileName,
    fileData,
    mimeType,
    syncStatus: 'pending',
    createdAt: Date.now(),
  });
  return id;
};

export const getPendingFiles = async (): Promise<FileQueueDB[]> => {
  return await db.fileQueue
    .where('syncStatus')
    .equals('pending')
    .toArray();
};

export const updateFileStatus = async (
  id: number,
  syncStatus: FileQueueDB['syncStatus'],
  error?: string
): Promise<void> => {
  const updates: Partial<FileQueueDB> = { syncStatus };
  if (error) {
    updates.error = error;
  }
  await db.fileQueue.update(id, updates);
};

export const deleteFileFromQueue = async (id: number): Promise<void> => {
  await db.fileQueue.delete(id);
};

export const getFilesByFieldResponseId = async (
  fieldResponseId: number
): Promise<FileQueueDB[]> => {
  return await db.fileQueue
    .where('fieldResponseId')
    .equals(fieldResponseId)
    .toArray();
};

export const clearUploadedFiles = async (): Promise<void> => {
  await db.fileQueue.where('syncStatus').equals('uploaded').delete();
};

export const getFileQueueStats = async () => {
  const all = await db.fileQueue.toArray();

  return {
    pending: all.filter(item => item.syncStatus === 'pending').length,
    uploading: all.filter(item => item.syncStatus === 'uploading').length,
    uploaded: all.filter(item => item.syncStatus === 'uploaded').length,
    error: all.filter(item => item.syncStatus === 'error').length,
    total: all.length,
  };
};
