import { Network } from '@capacitor/network';
import {
  saveChecklistLocal,
  getChecklistByServerId,
  getChecklistById,
  updateChecklistLocal,
  saveFieldResponse,
  updateFormResponse,
  getFormResponsesByChecklistId,
  saveFormularioLocal,
  getAllFormularios,
  getFormularioByServerId,
  createFormResponse,
} from './db/checklists-db';
import { addToSyncQueue } from './db/sync-queue';
import { Preferences } from '@capacitor/preferences';
import { globalLoading } from '@/contexts/LoadingContext';
import { storage } from '@/utils/storage';

const API_URL = import.meta.env.VITE_API_URL;

// Helper para pegar token de autenticação
const getAuthToken = async (): Promise<string | null> => {
  try {
    const { value } = await Preferences.get({ key: 'token' });
    const token = value;
    return token;
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
    const token = await getAuthToken();
    if (!token) {
      console.warn('[apiClient] No token available for offline download');
      return;
    }

    // Filtra apenas checklists em andamento
    const inProgress = checklistsData.filter(c => c.status === 'em_andamento');

    if (inProgress.length === 0) {
      return;
    }

    globalLoading.show();

    try {
      for (const checklist of inProgress) {
        try {
          // Verifica se já está em cache
          const cached = await getChecklistByServerId(checklist.id);
          if (cached) {
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

        } catch (error) {
          console.warn(`[apiClient] Error caching checklist ${checklist.id}:`, error);
        }
      }

    } finally {
      globalLoading.hide();
    }
  },

  // Buscar checklist por ID
  async getChecklist(id: number, forceOnline = false) {
    globalLoading.show();
    try {
      const isOnline = await checkOnlineStatus();
      const token = await getAuthToken();


      if (!token) {
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      // SEMPRE tenta buscar do cache primeiro (por serverId ou por id local)
      let cached = await getChecklistByServerId(id);
      if (!cached) {
        // Tenta buscar por ID local (para checklists criados offline)
        cached = await getChecklistById(id);
      }

      // Se está online ou forçou busca online, tenta buscar da API
      // MAS: se o checklist foi criado offline (sem serverId), usa o cache local
      if ((isOnline || forceOnline) && (!cached || cached.serverId)) {
        try {
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

          // Salva/atualiza no cache local
          const existingLocal = await getChecklistByServerId(id);
          if (existingLocal) {
            await updateChecklistLocal(existingLocal.id!, {
              serverId: id,
              titulo: data.data.titulo,
              campos: data.data.campos,
              syncStatus: 'synced',
            });
          } else {
            await saveChecklistLocal({
              serverId: id,
              titulo: data.data.titulo,
              campos: data.data.campos,
              syncStatus: 'synced',
            });
          }

          return data;
        } catch (error) {
          console.error('[apiClient] Error fetching from server:', error);

          // Se falhou mas tem cache, usa o cache como fallback
          if (cached) {

            // Busca o serverResponseId da formResponse local
            const formResponses = await getFormResponsesByChecklistId(id);
            const serverResponseId = formResponses.length > 0
              ? formResponses[formResponses.length - 1].serverResponseId
              : undefined;

            return {
              data: {
                id: cached.serverId,
                titulo: cached.titulo,
                campos: cached.campos,
                resposta: serverResponseId ? { id: serverResponseId } : {},
                respostasSalvas: {},
              },
            };
          }

          // Sem cache e sem conexão - erro específico
          console.error('[apiClient] No cache available and API failed');
          throw new Error('Não foi possível carregar o checklist. Conecte-se à internet ou acesse-o online primeiro.');
        }
      }

      // Se está offline ou checklist foi criado offline (sem serverId), usa o cache
      if (cached) {

        // Busca as formResponses pelo checklistId local
        const localChecklistId = cached.id!;
        const formResponses = await getFormResponsesByChecklistId(localChecklistId);

        // Para checklists criados offline, usa o localResponseId
        // Para checklists do servidor, usa o serverResponseId
        const lastResponse = formResponses.length > 0 ? formResponses[formResponses.length - 1] : null;
        const responseId = lastResponse?.serverResponseId || lastResponse?.id;

        return {
          data: {
            id: cached.serverId || cached.id, // Usa serverId se existir, senão usa id local
            titulo: cached.titulo,
            campos: cached.campos,
            resposta: responseId ? { id: responseId } : {},
            respostasSalvas: {},
            formularioId: lastResponse?.formularioId, // ID do formulário para checklists offline
          },
        };
      }

      // Offline e sem cache
      console.error('[apiClient] Offline and no cache available');
      throw new Error('Este checklist não está disponível offline. Conecte-se à internet e acesse-o primeiro.');
    } finally {
      globalLoading.hide();
    }
  },

  // Salvar campo individual
  async saveField(valor: any, id_campo: number, id_resposta: number, localResponseId?: number, id_formulario?: number) {
    globalLoading.show();
    try {
      const isOnline = await checkOnlineStatus();
      const token = await getAuthToken();

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
          // Processa o valor para leitura_automatica (extrai apenas imageDataUrl se for um objeto)
          let processedValor = valor;
          if (typeof valor === 'object' && valor !== null && 'imageDataUrl' in valor) {
            processedValor = valor.imageDataUrl;
          }

          const payload: any = {
            valor: processedValor,
            id_campo,
            id_resposta,
            web: 0,
          };

          // Adiciona id_formulario se disponível (para checklists criados offline)
          if (id_formulario) {
            payload.id_formulario = id_formulario;
          }

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

          if (!res.ok) {
            const errorText = await res.text();
            console.error("[apiClient] Error response:", errorText);
            throw new Error(`HTTP ${res.status}: ${errorText}`);
          }

          const result = await res.json();
          return result;
        } catch (error) {
          console.error('[apiClient] Error saving field online, queuing for sync', error);

          // Processa o valor para leitura_automatica (extrai apenas imageDataUrl se for um objeto)
          let processedValor = valor;
          if (typeof valor === 'object' && valor !== null && 'imageDataUrl' in valor) {
            processedValor = valor.imageDataUrl;
          }

          // Adiciona à fila de sincronização
          await addToSyncQueue('UPDATE_FIELD', {
            valor: processedValor,
            id_campo,
            id_resposta,
            id_formulario,
            web: 0,
          }, 5);
          throw error;
        }
      } else {
        // Se está offline, adiciona à fila de sincronização

        // Processa o valor para leitura_automatica (extrai apenas imageDataUrl se for um objeto)
        let processedValor = valor;
        if (typeof valor === 'object' && valor !== null && 'imageDataUrl' in valor) {
          processedValor = valor.imageDataUrl;
        }

        await addToSyncQueue('UPDATE_FIELD', {
          valor: processedValor,
          id_campo,
          id_resposta,
          id_formulario,
          web: 0,
        }, 5);

        return { success: true, offline: true };
      }
    } finally {
      globalLoading.hide();
    }
  },

  // Submeter formulário completo
  async submitForm(checklistId: number, id_resposta: number, localResponseId?: number) {
    globalLoading.show();
    try {
      const isOnline = await checkOnlineStatus();
      const token = await getAuthToken();

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
        await addToSyncQueue('SUBMIT_FORM', {
          checklistId,
          id_resposta,
          localResponseId,
        }, 1);

        return { success: true, offline: true };
      }
    } finally {
      globalLoading.hide();
    }
  },

  // Buscar formulários disponíveis para gerar checklist
  async getFormularios() {
    globalLoading.show();
    try {
      const isOnline = await checkOnlineStatus();
      const token = await getAuthToken();

      if (!token) {
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      // Se está online, busca da API e salva no cache
      if (isOnline) {
        try {
          const res = await fetch(`${API_URL}/gerar_checklist`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const result = await res.json();
          const formularios = result.data?.formularios || [];

          // Salva cada formulário no cache, buscando os campos detalhados
          for (const form of formularios) {
            // Busca os campos detalhados do formulário
            const detailRes = await fetch(`${API_URL}/formulario/${form.id}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
            });

            let campos = [];
            if (detailRes.ok) {
              const detail = await detailRes.json();
              campos = detail.data?.campos || detail.campos || [];
            }

            await saveFormularioLocal({
              serverId: form.id,
              nome: form.nome,
              campos: campos,
            });
          }

          return formularios;
        } catch (error) {
          console.error('[apiClient] Error fetching formulários:', error);
          // Tenta usar cache como fallback
          const cached = await getAllFormularios();
          if (cached.length > 0) {
            return cached.map(f => ({ id: f.serverId, nome: f.nome, campos: f.campos }));
          }
          throw error;
        }
      }

      // Se está offline, usa o cache
      const cached = await getAllFormularios();
      if (cached.length > 0) {
        return cached.map(f => ({ id: f.serverId, nome: f.nome, campos: f.campos }));
      }

      throw new Error('Nenhum formulário disponível offline. Conecte-se à internet primeiro.');
    } finally {
      globalLoading.hide();
    }
  },

  // Gerar checklist (online ou offline)
  async gerarChecklist(idFormulario: number, idUsuario: number) {
    globalLoading.show();
    try {
      const isOnline = await checkOnlineStatus();
      const token = await getAuthToken();

      if (!token) {
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      // Se está online, gera no servidor
      if (isOnline) {
        try {
          const res = await fetch(`${API_URL}/gerar_checklist`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              id_formulario: idFormulario,
              id_usuario: idUsuario,
            }),
          });

          if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error?.message || `HTTP ${res.status}`);
          }

          return await res.json();
        } catch (error: any) {
          // Se falhou por problema de rede, continua para modo offline
          if (error.message?.includes('Failed to fetch') ||
              error.message?.includes('Network') ||
              error.name === 'TypeError') {
          } else {
            throw error; // Re-throw outros erros (como 401, 500, etc)
          }
        }
      }

      // Se está offline, cria localmente

      // Busca o formulário do cache
      const formulario = await getFormularioByServerId(idFormulario);
      if (!formulario) {
        throw new Error('Formulário não encontrado no cache. Conecte-se à internet primeiro.');
      }

      // Cria o checklist localmente
      const localChecklistId = await saveChecklistLocal({
        serverId: undefined, // Será preenchido quando sincronizar
        titulo: formulario.nome,
        campos: formulario.campos,
        syncStatus: 'local_only',
      });

      // Cria a formResponse local
      const localResponseId = await createFormResponse(
        localChecklistId,
        undefined, // serverChecklistId - será preenchido quando sincronizar
        undefined, // serverResponseId - será preenchido quando sincronizar
        idFormulario // ID do formulário no servidor
      );

      // Adiciona à fila de sincronização
      await addToSyncQueue('CREATE_RESPONSE', {
        localChecklistId,
        localResponseId,
        idFormulario,
        idUsuario,
      }, 2);

      // Adiciona ao localStorage para aparecer na listagem
      storage.saveChecklist({
        id: localChecklistId,
        status: 'em_andamento',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        formulario: {
          id: idFormulario,
          nome: formulario.nome,
          descricao: 'Checklist offline (pendente sincronização)',
        },
        isOffline: true,
      } as any);

      return {
        success: true,
        offline: true,
        localChecklistId,
        localResponseId,
        data: {
          id: localChecklistId,
          titulo: formulario.nome,
        },
      };
    } finally {
      globalLoading.hide();
    }
  },
};

export default apiClient;