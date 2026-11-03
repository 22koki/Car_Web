'use client';

import { useCallback, useEffect, useState } from 'react';
import type { InventoryResponse } from '../types/dealership';
import { apiRequest, errorMessage } from './api';


export function useInventory() {
  const [data, setData] = useState<InventoryResponse>({ vehicles: [], mode: 'live', total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    apiRequest<InventoryResponse>('/api/vehicles', { signal: controller.signal })
      .then(response => {
        if (!Array.isArray(response.vehicles)) throw new Error('The inventory response is incomplete. Please try again.');
        if (!controller.signal.aborted) setData(response);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  return { ...data, loading, error, reload };
}
