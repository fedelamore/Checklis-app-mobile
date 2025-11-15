import { useState, useEffect } from 'react';
import { syncManager } from '@/services/sync-manager';
import { getSyncQueueStats } from '@/services/db/sync-queue';

interface SyncStats {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  total: number;
}

export const useSyncStatus = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<SyncStats>({
    pending: 0,
    processing: 0,
    failed: 0,
    completed: 0,
    total: 0,
  });

  const updateStats = async () => {
    const newStats = await getSyncQueueStats();
    setStats(newStats);
  };

  useEffect(() => {
    // Atualiza stats iniciais
    updateStats();

    // Subscribe para mudanças no sync manager
    const unsubscribe = syncManager.subscribe(() => {
      setIsSyncing(syncManager.processing);
      updateStats();
    });

    // Atualiza stats periodicamente
    const interval = setInterval(updateStats, 5000); // a cada 5 segundos

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const hasPendingItems = stats.pending > 0 || stats.processing > 0;
  const hasErrors = stats.failed > 0;

  return {
    isSyncing,
    stats,
    hasPendingItems,
    hasErrors,
    refreshStats: updateStats,
  };
};
