import { getAccessToken } from './auth.js';

async function adminFetch(op, { method = 'GET', query = {}, body } = {}) {
  const token = await getAccessToken();
  if (!token) {
    const err = new Error('Please sign in again.');
    err.code = 'unauthorized';
    throw err;
  }

  const params = new URLSearchParams({ op });
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') params.set(key, String(value));
  }

  const res = await fetch(`/api/v1/admin?${params}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(payload?.error?.message ?? 'Request failed.');
    err.code = payload?.error?.code ?? 'server_error';
    throw err;
  }
  return payload;
}

export function fetchAdminMe() {
  return adminFetch('me');
}

export function fetchFeedback(status) {
  return adminFetch('feedback', { query: status ? { status } : {} });
}

export function updateFeedbackStatus(id, status) {
  return adminFetch('feedback', { method: 'PATCH', body: { id, status } });
}

export function deleteFeedback(id) {
  return adminFetch('feedback', { method: 'DELETE', query: { id } });
}

export function fetchAdminUsers() {
  return adminFetch('users');
}

export function setUserBlocked(userId, blocked) {
  return adminFetch('block', { method: 'POST', body: { userId, blocked } });
}
