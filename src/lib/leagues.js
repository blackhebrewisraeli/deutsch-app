import { getAccessToken } from './auth.js';

export const LEAGUES_ENABLED = import.meta.env.VITE_LEAGUES_ENABLED === 'true';
export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby'];

async function post(path) {
  const token = await getAccessToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export function joinLeague() {
  return post('/api/v1/league/join');
}

export function refreshLeague() {
  return post('/api/v1/league/refresh');
}

export async function fetchProfile(userId) {
  const token = await getAccessToken();
  const res = await fetch(`/api/v1/league/profile?userId=${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`profile failed: ${res.status}`);
  return res.json();
}

// Standings via the RLS-scoped Supabase client (reads only the caller's league).
export async function fetchStandings(supabase, leagueId) {
  const { data, error } = await supabase
    .from('league_members')
    .select('user_id, handle, weekly_xp, rank')
    .eq('league_id', leagueId)
    .order('weekly_xp', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
