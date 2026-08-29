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

export async function updateHandle(body) {
  const token = await getAccessToken();
  const res = await fetch('/api/v1/league/handle', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`handle update failed: ${res.status}`);
  return res.json();
}

// The caller's own settled results (RLS lets you read your own league_member rows).
export async function fetchMyResults(supabase, userId) {
  const { data, error } = await supabase
    .from('league_members')
    .select('league_id, rank, result')
    .eq('user_id', userId)
    .not('result', 'is', null);
  if (error) throw error;
  return data ?? [];
}

// The caller's membership for the CURRENT league week, or null if they have not
// joined one. A single own-row read: period_start is denormalised onto
// league_members and carries a unique (user_id, period_start) constraint, so no
// join to `leagues` is needed.
//
// Deliberately a READ. Home is the landing tab and must never join or refresh a
// league as a side effect of being opened — see useLeagueStanding.
export async function fetchMyMembership(supabase, userId, periodStart) {
  const { data, error } = await supabase
    .from('league_members')
    .select('league_id, weekly_xp')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
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
