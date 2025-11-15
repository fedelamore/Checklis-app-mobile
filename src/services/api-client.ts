import { Network } from '@capacitor/network';
import {
  saveChecklistLocal,
  getChecklistByServerId,
  updateChecklistLocal,
  createFormResponse,
  saveFieldResponse,
  updateFormResponse,
  getFormResponseById,
} from './db/checklists-db';
import { addToSyncQueue } from './db/sync-queue';

const API_URL = import.meta.env.VITE_API_URL;

// Helper para pegar token de autenticação
const getAuthToken = (): string | null => {
  try {
    const userStr = localStorage.getItem('current_user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user?.authorization?.token || null;
  } catch {
    return null;
  }
};

// Helper para verificar se está online
const checkOnlineStatus = async (): Promise<boolean> => {
  try {
    const status = await Network.getStatus();
    return status.connected;
  } catch {
    return navigator.onLine;
  }
};

// ==================== API CLIENT ====================

export const apiClient = {
  // Baixar automaticamente checklists em andamento para uso offline
  async downloadInProgressChecklistsForOffline(checklistsData: any[]) {
    const token = getAuthToken();
    if (!token) {
      console.warn('[apiClient] No token available for offline download');
      return;
    }

    // Filtra apenas checklists em andamento
    const inProgress = checklistsData.filter(c => c.status === 'em_andamento');

    if (inProgress.length === 0) {
      console.log('[apiClient] No in-progress checklists to download');
      return;
    }

    console.log(`[apiClient] Auto-downloading ${inProgress.length} in-progress checklists for offline use...`);

    for (const checklist of inProgress) {
      try {
        // Verifica se já está em cache
        const cached = await getChecklistByServerId(checklist.id);
        if (cached) {
          console.log(`[apiClient] Checklist ${checklist.id} already cached, skipping`);
          continue;
        }

        // Busca os detalhes do checklist
        const res = await fetch(`${API_URL}/checklist/${checklist.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        if (!res.ok) {
          console.warn(`[apiClient] Failed to download checklist ${checklist.id}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();

        // Salva no cache local
        await saveChecklistLocal({
          serverId: checklist.id,
          titulo: data.data.titulo,
          campos: data.data.campos,
          syncStatus: 'synced',
        });

        console.log(`[apiClient] ✓ Checklist ${checklist.id} ("${data.data.titulo}") cached for offline use`);
      } catch (error) {
        console.warn(`[apiClient] Error caching checklist ${checklist.id}:`, error);
      }
    }

    console.log(`[apiClient] Offline caching complete - ${inProgress.length} checklists processed`);
  },

  // Buscar checklist por ID
  async getChecklist(id: number, forceOnline = false) {
    const isOnline = await checkOnlineStatus();
    const token = getAuthToken();

    console.log(`[apiClient] getChecklist(${id}) - Online: ${isOnline}`);

    if (!token) {
      throw new Error('Token não encontrado. Faça login novamente.');
    }

    // SEMPRE tenta buscar do cache primeiro
    const cached = await getChecklistByServerId(id);
    console.log(`[apiClient] Cache lookup for checklist ${id}:`, cached ? 'FOUND' : 'NOT FOUND');

    // Se está online ou forçou busca online, tenta buscar da API
    if (isOnline || forceOnline) {
      try {
        console.log(`[apiClient] Fetching checklist ${id} from API...`);
        const res = await fetch(`${API_URL}/checklist/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        console.log(`[apiClient] Successfully fetched checklist ${id} from API`);

        // Salva/atualiza no cache local
        const existingLocal = await getChecklistByServerId(id);
        if (existingLocal) {
          await updateChecklistLocal(existingLocal.id!, {
            serverId: id,
            titulo: data.data.titulo,
            campos: data.data.campos,
            syncStatus: 'synced',
          });
          console.log(`[apiClient] Updated checklist ${id} in cache`);
        } else {
          await saveChecklistLocal({
            serverId: id,
            titulo: data.data.titulo,
            campos: data.data.campos,
            syncStatus: 'synced',
          });
          console.log(`[apiClient] Saved new checklist ${id} to cache`);
        }

        return data;
      } catch (error) {
        console.error('[apiClient] Error fetching from server:', error);

        // Se falhou mas tem cache, usa o cache como fallback
        if (cached) {
          console.log('[apiClient] API failed, using cached checklist as fallback');
          return {
            data: {
              id: cached.serverId,
              titulo: cached.titulo,
              campos: cached.campos,
              resposta: {},
              respostasSalvas: {},
            },
          };
        }

        // Sem cache e sem conexão - erro específico
        console.error('[apiClient] No cache available and API failed');
        throw new Error('Não foi possível carregar o checklist. Conecte-se à internet ou acesse-o online primeiro.');
      }
    }

    // Se está offline, usa o cache
    if (cached) {
      console.log('[apiClient] Offline mode: using cached checklist');
      return {
        data: {
          id: cached.serverId,
          titulo: cached.titulo,
          campos: cached.campos,
          resposta: {},
          respostasSalvas: {},
        },
      };
    }

    // Offline e sem cache
    console.error('[apiClient] Offline and no cache available');
    throw new Error('Este checklist não está disponível offline. Conecte-se à internet e acesse-o primeiro.');
  },

  // Salvar campo individual
  async saveField(valor: any, id_campo: number, id_resposta: number, localResponseId?: number) {
    const isOnline = await checkOnlineStatus();
    const token = getAuthToken();

    if (!token) {
      throw new Error('Token não encontrado. Faça login novamente.');
    }

    // Sempre salva localmente primeiro
    if (localResponseId) {
      await saveFieldResponse(localResponseId, id_campo, valor, id_campo, id_resposta);
    }

    // Se está online, tenta enviar para o servidor
    if (isOnline) {
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
            valor,
            id_campo,
            id_resposta,
            web: 0,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        return await res.json();
      } catch (error) {
        console.error('[apiClient] Error saving field online, queuing for sync', error);
        // Adiciona à fila de sincronização
        await addToSyncQueue('UPDATE_FIELD', {
          valor,
          id_campo,
          id_resposta,
          web: 0,
        }, 5);
        throw error;
      }
    } else {
      // Se está offline, adiciona à fila de sincronização
      console.log('[apiClient] Offline mode: queuing field save');
      await addToSyncQueue('UPDATE_FIELD', {
        valor,
        id_campo,
        id_resposta,
        web: 0,
      }, 5);

      return { success: true, offline: true };
    }
  },

  // Submeter formulário completo
  async submitForm(checklistId: number, id_resposta: number, localResponseId?: number) {
    const isOnline = await checkOnlineStatus();
    const token = getAuthToken();

    if (!token) {
      throw new Error('Token não encontrado. Faça login novamente.');
    }

    // Marca como completo localmente
    if (localResponseId) {
      await updateFormResponse(localResponseId, {
        isComplete: true,
        syncStatus: 'local_only',
      });
    }

    // Se está online, envia para o servidor
    if (isOnline) {
      try {
        const res = await fetch(`${API_URL}/checklist/${checklistId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ id_resposta }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Marca como sincronizado localmente
        if (localResponseId) {
          await updateFormResponse(localResponseId, { syncStatus: 'synced' });
        }

        return await res.json();
      } catch (error) {
        console.error('[apiClient] Error submitting form online, queuing for sync', error);
        // Adiciona à fila de sincronização com alta prioridade
        await addToSyncQueue('SUBMIT_FORM', {
          checklistId,
          id_resposta,
          localResponseId,
        }, 1);
        throw error;
      }
    } else {
      // Se está offline, adiciona à fila de sincronização
      console.log('[apiClient] Offline mode: queuing form submission');
      await addToSyncQueue('SUBMIT_FORM', {
        checklistId,
        id_resposta,
        localResponseId,
      }, 1);

      return { success: true, offline: true };
    }
  },
};

export default apiClient;
