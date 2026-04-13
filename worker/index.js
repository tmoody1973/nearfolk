// Nearfolk leaderboard — Cloudflare Worker + KV
//
// POST /score  — submit score (HMAC-signed)
// GET  /top100 — get top 100 for a date
//
// KV schema:
//   key: "scores:{date}" -> JSON array sorted by score desc, capped at 100
//   key: "submitted:{date}:{ip}" -> "1" (one submission per IP per day)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Simple HMAC using Web Crypto API
async function computeHMAC(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // POST /score
    if (url.pathname === '/score' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { playerId, date, score, beatId, hmac } = body;

        // Validate required fields
        if (!playerId || !date || score === undefined || !hmac) {
          return jsonResponse({ error: 'Missing fields' }, 400);
        }

        // Validate score range (0-500 is generous max)
        if (typeof score !== 'number' || score < 0 || score > 500) {
          return jsonResponse({ error: 'Invalid score' }, 400);
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonResponse({ error: 'Invalid date' }, 400);
        }

        // Verify HMAC
        const secret = env.HMAC_SECRET || 'nearfolk-dev-secret';
        const message = `${playerId}:${date}:${score}`;
        const expected = await computeHMAC(secret, message);

        if (hmac !== expected) {
          return jsonResponse({ error: 'Invalid signature' }, 403);
        }

        // Check one submission per IP per day
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const submitKey = `submitted:${date}:${ip}`;
        const alreadySubmitted = await env.NEARFOLK_KV.get(submitKey);

        if (alreadySubmitted) {
          return jsonResponse({ error: 'Already submitted today' }, 429);
        }

        // Get current leaderboard for this date
        const scoresKey = `scores:${date}`;
        const existing = await env.NEARFOLK_KV.get(scoresKey, 'json') || [];

        // Add new score
        existing.push({
          playerId,
          score,
          beatId: beatId || 'unknown',
          timestamp: Date.now(),
        });

        // Sort descending, cap at 100
        existing.sort((a, b) => b.score - a.score);
        const top100 = existing.slice(0, 100);

        // Find rank
        const rank = top100.findIndex(e => e.playerId === playerId && e.score === score) + 1;

        // Save
        await env.NEARFOLK_KV.put(scoresKey, JSON.stringify(top100), {
          expirationTtl: 60 * 60 * 24 * 7, // 7 days
        });

        // Mark as submitted
        await env.NEARFOLK_KV.put(submitKey, '1', {
          expirationTtl: 60 * 60 * 24, // 24 hours
        });

        return jsonResponse({ success: true, rank, total: top100.length });

      } catch (e) {
        return jsonResponse({ error: 'Server error' }, 500);
      }
    }

    // GET /top100?date=YYYY-MM-DD
    if (url.pathname === '/top100' && request.method === 'GET') {
      const date = url.searchParams.get('date');
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return jsonResponse({ error: 'Missing or invalid date param' }, 400);
      }

      const scores = await env.NEARFOLK_KV.get(`scores:${date}`, 'json') || [];
      return jsonResponse({ date, scores, total: scores.length });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}
