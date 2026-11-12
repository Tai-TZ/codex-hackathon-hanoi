import { useEffect, useState } from 'react';

import { getHealth } from '@/lib/api';

export type BackendStatus = 'checking' | 'ready' | 'no-api-key' | 'unreachable';

export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((health) => {
        if (!cancelled) setStatus(health.llm_configured ? 'ready' : 'no-api-key');
      })
      .catch(() => {
        if (!cancelled) setStatus('unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
