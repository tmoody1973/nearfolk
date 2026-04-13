// Nearfolk leaderboard client
//
// Submits scores and fetches top 100.
// HMAC signing for score verification.
// Falls back gracefully on network failure.

// Worker URL — update this after deploying
const WORKER_URL = 'https://nearfolk-leaderboard.tarikjmoody.workers.dev';

// No client-side HMAC — security relies on server-side rate limiting
// and score ceiling. The HMAC was security theater (same secret on client).

// Get or create player ID
function getPlayerId() {
  let id;
  try {
    id = localStorage.getItem('nearfolk_player_id');
  } catch {}
  if (!id) {
    id = 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try { localStorage.setItem('nearfolk_player_id', id); } catch {}
  }
  return id;
}

// Submit score
export async function submitScore(date, score, beatId) {
  const playerId = getPlayerId();

  try {
    const res = await fetch(`${WORKER_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, date, score, beatId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Submit failed' };
    }
    return await res.json();
  } catch (e) {
    return { success: false, error: 'Offline' };
  }
}

// Fetch top 100
export async function fetchLeaderboard(date) {
  try {
    const res = await fetch(`${WORKER_URL}/top100?date=${date}`);
    if (!res.ok) return { scores: [], error: 'Fetch failed' };
    return await res.json();
  } catch {
    return { scores: [], error: 'Offline' };
  }
}
