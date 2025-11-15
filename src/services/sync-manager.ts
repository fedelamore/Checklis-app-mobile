import { toast } from 'sonner';
import {
  getPendingSyncItems,
  updateSyncItemStatus,
  incrementRetryCount,
  deleteSyncItem,
  getPendingFiles,
  updateFileStatus,
  deleteFileFromQueue,
  getSyncQueueStats,
} from './db/sync-queue';
import {
  getUnsyncedFieldResponses,
  updateFieldResponseSyncStatus,
  getFormResponseById,
  updateFormResponse,
} from './db/checklists-db';

const API_URL = import.meta.env.VITE_API_URL;

// Estado global do sync manager
class SyncManager {
  private isProcessing = false;
  private listeners: Set<() => void> = new Set();

  // Registrar listeners para mudanças no status
  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback());
  }

  // Verifica se está processando
  get processing() {
    return this.isProcessing;
  }

  // Inicia sincronização completa
  async syncAll() {
    if (this.isProcessing) {
      console.log('[SyncManager] Sync already in progress');
      return;
    }

    console.log('[SyncManager] Starting full sync...');
    this.isProcessing = true;
    this.notifyListeners();

    try {
      // 1. Processar fila de sincronização
      await this.processSyncQueue();

      // 2. Processar campos não sincronizados
      console.log("2. Processar campos não sincronizados")
      await this.syncUnsyncedFields();

      // 3. Processar fila de arquivos
      await this.processFileQueue();

      const stats = await getSyncQueueStats();
      console.log('[SyncManager] Sync completed', stats);

      if (stats.failed > 0) {
        toast.warning(`Sincronização concluída com ${stats.failed} erro(s)`);
      } else if (stats.pending === 0) {
        toast.success('Todos os dados foram sincronizados!');
      }
    } catch (error) {
      console.error('[SyncManager] Sync failed', error);
      toast.error('Erro durante a sincronização');
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }

  // Processa itens da fila de sincronização
  private async processSyncQueue() {
    const items = await getPendingSyncItems();
    console.log(`[SyncManager] Processing ${items.length} sync queue items`);

    for (const item of items) {
      try {
        await updateSyncItemStatus(item.id!, 'processing');

        switch (item.type) {
          case 'CREATE_RESPONSE':
            await this.handleCreateResponse(item.payload);
            break;
          case 'UPDATE_FIELD':
            await this.handleUpdateField(item.payload);
            break;
          case 'SUBMIT_FORM':
            await this.handleSubmitForm(item.payload);
            break;
          case 'UPLOAD_FILE':
            await this.handleUploadFile(item.payload);
            break;
        }

        await updateSyncItemStatus(item.id!, 'completed');
        // Deleta item completado após 5 segundos
        setTimeout(() => deleteSyncItem(item.id!), 5000);
      } catch (error: any) {
        console.error(`[SyncManager] Error processing item ${item.id}`, error);
        await incrementRetryCount(item.id!);
        await updateSyncItemStatus(
          item.id!,
          'pending',
          error.message || 'Unknown error'
        );
      }
    }
  }

  // Sincroniza campos que não estão na fila mas precisam ser sincronizados
  private async syncUnsyncedFields() {
    const fields = await getUnsyncedFieldResponses();
    console.log(`[SyncManager] Syncing ${fields.length} unsynced fields`);
    console.log("fields: ", fields)

    // Agrupa campos por responseId para processar junto
    const fieldsByResponse = new Map<number, typeof fields>();
    for (const field of fields) {
      const existing = fieldsByResponse.get(field.responseId) || [];
      existing.push(field);
      fieldsByResponse.set(field.responseId, existing);
    }

    // Processa cada resposta
    for (const [responseId, responseFields] of fieldsByResponse) {
      try {
        const token = this.getAuthToken();
        if (!token) throw new Error('No auth token');

        const response = await getFormResponseById(responseId);
        if (!response) {
          console.warn(`[SyncManager] Response ${responseId} not found`);
          continue;
        }

        // Se não tem serverResponseId, precisa criar a resposta no servidor primeiro
        if (!response.serverResponseId && response.serverChecklistId) {
          console.log(`[SyncManager] Creating response on server for checklist ${response.serverChecklistId}`);

          // Cria a resposta no servidor (gera o serverResponseId)
          const createRes = await fetch(`${API_URL}/gerar_checklist/${response.serverChecklistId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({}),
          });

          if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`);

          const createData = await createRes.json();
          const serverResponseId = createData?.data?.id;

          if (serverResponseId) {
            // Atualiza o serverResponseId local
            await updateFormResponse(responseId, { serverResponseId });
            response.serverResponseId = serverResponseId;
            console.log(`[SyncManager] Created server response: ${serverResponseId}`);
          } else {
            throw new Error('Server did not return response ID');
          }
        }

        // Agora sincroniza os campos
        if (!response.serverResponseId) {
          console.warn(`[SyncManager] Still no serverResponseId for response ${responseId}, skipping fields`);
          continue;
        }
        console.log("responseFields antes do for: ", responseFields)
        for (const field of responseFields) {
          try {
            const res = await fetch(`${API_URL}/salvar_campo`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Requested-With': 'XMLHttpRequest',
              },
              body: JSON.stringify({
                valor: field.valor,
                id_campo: field.serverFieldId || field.fieldId,
                id_resposta: response.serverResponseId,
                web: 0,
              }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            await updateFieldResponseSyncStatus(field.id!, 'synced');
            console.log(`[SyncManager] Field ${field.id} synced successfully`);
          } catch (error: any) {
            console.error(`[SyncManager] Error syncing field ${field.id}`, error);
            await updateFieldResponseSyncStatus(field.id!, 'error');
          }
        }
      } catch (error: any) {
        console.error(`[SyncManager] Error syncing response ${responseId}`, error);
        // Marca todos os campos desta resposta como erro
        for (const field of responseFields) {
          await updateFieldResponseSyncStatus(field.id!, 'error');
        }
      }
    }
  }

  // Processa fila de arquivos (fotos, assinaturas)
  private async processFileQueue() {
    const files = await getPendingFiles();
    console.log(`[SyncManager] Processing ${files.length} files`);

    for (const file of files) {
      try {
        await updateFileStatus(file.id!, 'uploading');

        // Aqui você implementaria o upload real do arquivo
        // Por enquanto, vamos simular
        const token = this.getAuthToken();
        if (!token) throw new Error('No auth token');

        // TODO: Implementar upload de arquivo real
        // const formData = new FormData();
        // formData.append('file', base64ToBlob(file.fileData, file.mimeType));

        await updateFileStatus(file.id!, 'uploaded');
        setTimeout(() => deleteFileFromQueue(file.id!), 5000);
      } catch (error: any) {
        console.error(`[SyncManager] Error uploading file ${file.id}`, error);
        await updateFileStatus(file.id!, 'error', error.message);
      }
    }
  }

  // Handlers para diferentes tipos de sincronização
  private async handleCreateResponse(payload: any) {
    console.log('[SyncManager] Creating response on server', payload);
    // Implementar criação de resposta no servidor
  }

  private async handleUpdateField(payload: any) {
    console.log('[SyncManager] Updating field on server', payload);
    const token = this.getAuthToken();
    if (!token) throw new Error('No auth token');

    const res = await fetch(`${API_URL}/salvar_campo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  private async handleSubmitForm(payload: any) {
    console.log('[SyncManager] Submitting form on server', payload);
    const token = this.getAuthToken();
    if (!token) throw new Error('No auth token');

    const res = await fetch(`${API_URL}/checklist/${payload.checklistId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ id_resposta: payload.id_resposta }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Atualizar status local
    if (payload.localResponseId) {
      await updateFormResponse(payload.localResponseId, { syncStatus: 'synced' });
    }

    return await res.json();
  }

  private async handleUploadFile(payload: any) {
    console.log('[SyncManager] Uploading file', payload);
    // Implementar upload de arquivo
  }

  // Pega token do localStorage
  private getAuthToken(): string | null {
    try {
      const userStr = localStorage.getItem('current_user');
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return user?.authorization?.token || null;
    } catch {
      return null;
    }
  }

  // Obtém estatísticas de sincronização
  async getStats() {
    return await getSyncQueueStats();
  }
}

// Instância singleton
export const syncManager = new SyncManager();

// Helper para iniciar sync
export const startSync = () => syncManager.syncAll();

// Helper para verificar se está processando
export const isSyncing = () => syncManager.processing;

// Helper para obter stats
export const getSyncStats = () => syncManager.getStats();
