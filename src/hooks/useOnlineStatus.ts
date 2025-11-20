import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { syncManager } from '@/services/sync-manager';
import { getSyncQueueStats } from '@/services/db/sync-queue';
import { getUnsyncedFieldResponses } from '@/services/db/checklists-db';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [hasPendingItems, setHasPendingItems] = useState(false);

  // Verifica se há itens pendentes para sincronizar
  const checkPendingItems = async (): Promise<boolean> => {
    try {
      const stats = await getSyncQueueStats();
      const unsyncedFields = await getUnsyncedFieldResponses();
      const hasPending = stats.pending > 0 || unsyncedFields.length > 0;
      setHasPendingItems(hasPending);
      return hasPending;
    } catch (error) {
      console.error('[useOnlineStatus] Error checking pending items:', error);
      return false;
    }
  };

  // Função para confirmar sincronização do modal
  const confirmSync = async () => {
    setShowSyncModal(false);
    await syncManager.syncAll();
  };

  // Função para cancelar o modal
  const cancelSync = () => {
    setShowSyncModal(false);
  };

  useEffect(() => {
    // Verifica status inicial
    const checkInitialStatus = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
      } catch (error) {
        // Fallback para navigator.onLine se Capacitor Network não estiver disponível
        console.warn('[useOnlineStatus] Capacitor Network not available, using navigator.onLine');
        setIsOnline(navigator.onLine);
      }
    };

    checkInitialStatus();

    // Listener do Capacitor Network (nativo)
    let networkListener: any;
    let previousOnlineState = navigator.onLine;

    const setupCapacitorListener = async () => {
      try {
        networkListener = await Network.addListener('networkStatusChange', status => {
          console.log('[useOnlineStatus] Network status changed:', status.connected);
          const wasOffline = !previousOnlineState;
          const isNowOnline = status.connected;

          previousOnlineState = isNowOnline;
          setIsOnline(isNowOnline);

          // Se estava offline e agora está online, verifica pendentes e mostra modal
          if (wasOffline && isNowOnline) {
            console.log('[useOnlineStatus] Back online, checking pending items...');
            setTimeout(async () => {
              const hasPending = await checkPendingItems();
              if (hasPending) {
                console.log('[useOnlineStatus] Has pending items, showing modal...');
                setShowSyncModal(true);
              } else {
                console.log('[useOnlineStatus] No pending items');
              }
            }, 1000); // Aguarda 1 segundo para estabilizar conexão
          }
        });
      } catch (error) {
        console.warn('[useOnlineStatus] Could not setup Capacitor listener');
      }
    };

    setupCapacitorListener();

    // Listeners do navegador (fallback)
    const handleOnline = () => {
      console.log('[useOnlineStatus] Browser online event');
      const wasOffline = !previousOnlineState;
      previousOnlineState = true;
      setIsOnline(true);

      // Verifica pendentes quando volta online
      if (wasOffline) {
        console.log('[useOnlineStatus] Was offline, now online - checking pending items...');
        setTimeout(async () => {
          const hasPending = await checkPendingItems();
          if (hasPending) {
            console.log('[useOnlineStatus] Has pending items, showing modal...');
            setShowSyncModal(true);
          } else {
            console.log('[useOnlineStatus] No pending items');
          }
        }, 1000);
      }
    };

    const handleOffline = () => {
      console.log('[useOnlineStatus] Browser offline event');
      previousOnlineState = false;
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      // Cleanup
      if (networkListener) {
        networkListener.remove();
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    showSyncModal,
    hasPendingItems,
    confirmSync,
    cancelSync,
  };
};
