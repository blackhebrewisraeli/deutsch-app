import { useState, useEffect } from 'react';
import { getSyncStatus, subscribeSyncStatus } from './sync.js';

export function useSyncStatus() {
  const [state, setState] = useState(getSyncStatus);
  useEffect(() => subscribeSyncStatus(setState), []);
  return state;
}
