import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { syncManager } from '@/services/sync-manager';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

          // Se estava offline e agora está online, inicia sincronização automática
          if (wasOffline && isNowOnline) {
            console.log('[useOnlineStatus] Back online, starting sync...');
            setTimeout(() => {
              console.log('[useOnlineStatus] Triggering syncAll...');
              syncManager.syncAll();
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

      // Inicia sincronização quando volta online
      if (wasOffline) {
        console.log('[useOnlineStatus] Was offline, now online - starting sync...');
        setTimeout(() => {
          console.log('[useOnlineStatus] Triggering syncAll...');
          syncManager.syncAll();
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

  return isOnline;
};
