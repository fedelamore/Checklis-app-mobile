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
  deleteFieldResponse,
  deleteFormResponseAndFields,
  deleteChecklistFromCache,
} from './db/checklists-db';
import { Preferences } from '@capacitor/preferences';
import { globalLoading } from '@/contexts/LoadingContext';
import { storage } from '@/utils/storage';

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
      return;
    }

    this.isProcessing = true;
    this.notifyListeners();
    globalLoading.show();

    try {
      // 1. Processar fila de sincronização
      await this.processSyncQueue();

      // 2. Processar campos não sincronizados
      await this.syncUnsyncedFields();

      // 3. Processar fila de arquivos
      await this.processFileQueue();

      const stats = await getSyncQueueStats();

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
      globalLoading.hide();
    }
  }

  // Processa itens da fila de sincronização
  private async processSyncQueue() {
    const items = await getPendingSyncItems();

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
        const token = await this.getAuthToken();
        if (!token) throw new Error('No auth token');

        const response = await getFormResponseById(responseId);
        if (!response) {
          console.warn(`[SyncManager] Response ${responseId} not found`);
          continue;
        }

        // Se não tem serverResponseId, precisa criar a resposta no servidor primeiro
        if (!response.serverResponseId) {
          // Caso 1: Checklist criado offline 
          if (!response.serverChecklistId) {

            // Pega o id do usuário logado
            const user = storage.getUser();
            const userId = user?.id || 1;

            // Primeiro cria o checklist no servidor via POST /gerar_checklist
            const createRes = await fetch(`${API_URL}/gerar_checklist`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Requested-With': 'XMLHttpRequest',
              },
              body: JSON.stringify({
                id_formulario: response.formularioId,
                id_usuario: userId,
              }),
            });

            if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`);

            const createData = await createRes.json();
            // O id retornado é o id_resposta
            const serverResponseId = createData?.data?.id;
            const serverChecklistId = createData?.data?.id;

            if (serverResponseId) {
              // Atualiza o serverResponseId e serverChecklistId local
              await updateFormResponse(responseId, {
                serverResponseId,
                serverChecklistId
              });
              response.serverResponseId = serverResponseId;
              response.serverChecklistId = serverChecklistId;
            } else {
              throw new Error('Server did not return response ID for offline checklist');
            }
          }
          // Caso 2: Checklist do servidor mas sem resposta ainda (tem serverChecklistId)
          else if (response.serverChecklistId) {

            // Cria a resposta no servidor (gera o serverResponseId)
            const createRes = await fetch(`${API_URL}/gerar_checklist/`, {
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
            } else {
              throw new Error('Server did not return response ID');
            }
          } else {
            console.warn(`[SyncManager] Response ${responseId} has no formularioId or serverChecklistId, skipping`);
            continue;
          }
        }

        // Agora sincroniza os campos
        for (const field of responseFields) {
          try {
            // Prioriza o serverResponseId do formResponse (que foi atualizado após criar no servidor)
            const fieldServerResponseId = response.serverResponseId || field.serverResponseId || response.checklistId;

            if (!fieldServerResponseId) {
              console.warn(`[SyncManager] No serverResponseId or checklistId for field ${field.id}, skipping`);
              continue;
            }

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
                id_resposta: fieldServerResponseId,
                web: 0,
              }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // Deleta o campo sincronizado do banco local
            await deleteFieldResponse(field.id!);
          } catch (error: any) {
            console.error(`[SyncManager] Error syncing field ${field.id}`, error);
            await updateFieldResponseSyncStatus(field.id!, 'error');
          }
        }

        // Nota: Não deletar formResponse ou checklist aqui
        // A exclusão só deve ocorrer após o submit do formulário ser sincronizado
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

    for (const file of files) {
      try {
        await updateFileStatus(file.id!, 'uploading');

        // Aqui você implementaria o upload real do arquivo
        // Por enquanto, vamos simular
        const token = await this.getAuthToken();
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
    //console.log('[SyncManager] Creating response on server', payload);
    // Implementar criação de resposta no servidor
  }

  private async handleUpdateField(payload: any) {
    const token = await this.getAuthToken();
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
    const token = await this.getAuthToken();
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
  private async getAuthToken(): Promise<string | null> {
    try {
      /*const userStr = localStorage.getItem('current_user');
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return user?.authorization?.token || null;*/
      const { value } = await Preferences.get({ key: 'token' });
      const token = value;
      return token;
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
