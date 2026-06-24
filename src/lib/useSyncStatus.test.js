import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('./auth.js', () => ({ getSupabase: () => null, isAuthConfigured: () => false }));

import { useSyncStatus } from './useSyncStatus.js';
import { markDirty, __resetSyncState } from './sync.js';

describe('useSyncStatus', () => {
  beforeEach(() => __resetSyncState({ enabled: true, userId: 'user-1' }));

  it('reports pending while a push is queued', async () => {
    const { result } = renderHook(() => useSyncStatus());
    expect(result.current.pending).toBe(false);
    act(() => markDirty());
    await waitFor(() => expect(result.current.pending).toBe(true));
  });
});
