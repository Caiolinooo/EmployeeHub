import type { Handler } from '@netlify/functions';

// Scheduled function: runs on Netlify according to netlify.toml schedule
export const handler: Handler = async () => {
  try {
    const base = process.env.URL || process.env.DEPLOY_URL;
    if (!base) {
      console.warn('No base URL in env (URL/DEPLOY_URL). Falling back to relative fetch.');
    }
    const endpoint = `${base || ''}/api/calendar/company/notify`;
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Notify endpoint failed', res.status, data);
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: data?.error || res.statusText }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, result: data }) };
  } catch (e: any) {
    console.error('company-notify scheduled function error', e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e?.message || 'error' }) };
  }
};

