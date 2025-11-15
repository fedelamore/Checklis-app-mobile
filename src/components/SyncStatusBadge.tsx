import { Wifi, WifiOff, CloudOff, Cloud, RefreshCw, AlertCircle } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { syncManager } from '@/services/sync-manager';
import { cn } from '@/lib/utils';

interface SyncStatusBadgeProps {
  showDetails?: boolean;
  className?: string;
}

export const SyncStatusBadge = ({ showDetails = false, className }: SyncStatusBadgeProps) => {
  const isOnline = useOnlineStatus();
  const { isSyncing, stats, hasPendingItems, hasErrors } = useSyncStatus();

  const handleManualSync = () => {
    if (!isSyncing && isOnline) {
      syncManager.syncAll();
    }
  };

  // Define ícone e cor baseado no status
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: 'Offline',
        variant: 'secondary' as const,
        color: 'text-gray-500',
      };
    }

    if (isSyncing) {
      return {
        icon: RefreshCw,
        label: 'Sincronizando...',
        variant: 'default' as const,
        color: 'text-blue-500',
        animate: true,
      };
    }

    if (hasErrors) {
      return {
        icon: AlertCircle,
        label: `${stats.failed} erro(s)`,
        variant: 'destructive' as const,
        color: 'text-red-500',
      };
    }

    if (hasPendingItems) {
      return {
        icon: CloudOff,
        label: `${stats.pending} pendente(s)`,
        variant: 'outline' as const,
        color: 'text-orange-500',
      };
    }

    return {
      icon: Cloud,
      label: 'Sincronizado',
      variant: 'outline' as const,
      color: 'text-green-500',
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  if (!showDetails) {
    // Versão compacta - apenas ícone
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <StatusIcon
          className={cn(
            'w-5 h-5',
            statusInfo.color,
            statusInfo.animate && 'animate-spin'
          )}
        />
        {!isOnline && (
          <span className="text-xs text-muted-foreground">Offline</span>
        )}
      </div>
    );
  }

  // Versão completa com detalhes
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge variant={statusInfo.variant} className="flex items-center gap-1.5">
        <StatusIcon
          className={cn('w-3.5 h-3.5', statusInfo.animate && 'animate-spin')}
        />
        <span>{statusInfo.label}</span>
      </Badge>

      {isOnline && hasPendingItems && !isSyncing && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleManualSync}
          className="h-7 px-2"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Sincronizar
        </Button>
      )}
    </div>
  );
};

export default SyncStatusBadge;
