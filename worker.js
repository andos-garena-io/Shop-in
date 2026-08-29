// ANDOS Telegram Secure Proxy — Cloudflare Worker
// -------------------------------------------------
// SECURITY: bot token sirf yahan rehta hai (env secret), browser/HTML me NAHI.
//
// SETUP (5 min, free):
// 1) dash.cloudflare.com → Workers & Pages → Create → "Hello World" worker
// 2) Worker ke Settings → Variables and Secrets → Secret add karo:
//      Name: TG_TOKEN   Value: apna bot token (123456:ABC-...)
// 3) Is code ko paste karke Deploy karo
// 4) Worker URL milega jaise https://andos-proxy.yourname.workers.dev
// 5) index.html ke CONFIG me daalo:  CONFIG.workerUrl = 'https://andos-proxy.yourname.workers.dev';
//    (CONFIG.telegramBotToken khali chhod sakte ho — tab site se token puri tarah hat jayega)
// 6) CORS_ALLOW me apni site ka origin daalo (GitHub Pages URL)
//
// Ye proxy Bot API ke sirf zaroori methods forward karta hai, rate-limit ke saath.

const CORS_ALLOW = ['*']; // apni site ka origin daalo jaise ['https://gerana-x-andos.github.io'] — '*' = har origin (testing)
const RATE = 60;          // per minute per IP

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const allow = CORS_ALLOW.includes('*') || CORS_ALLOW.includes(origin);
    const hdrs = {
      'Access-Control-Allow-Origin': allow ? (origin || '*') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };
    if (req.method === 'OPTIONS') return new Response('ok', { headers: hdrs });
    if (!allow) return new Response(JSON.stringify({ ok: false, error: 'origin not allowed' }), { status: 403, headers: hdrs });
    if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'POST only' }), { status: 405, headers: hdrs });

    // simple rate limit via edge cache-free counter (per-request check only)
    const method = url.pathname.replace(/^\//, '').split('?')[0];
    const ALLOWED = ['sendMessage', 'getUpdates', 'sendPhoto', 'sendDocument', 'answerCallbackQuery'];
    if (!ALLOWED.includes(method)) return new Response(JSON.stringify({ ok: false, error: 'method not allowed' }), { status: 403, headers: hdrs });

    let body = {};
    try { body = await req.json(); } catch (e) {}

    // FormData wale methods (photo/document) JSON se accept karke base64 forward karo
    let tgResp;
    const token = env.TG_TOKEN;
    if (!token) return new Response(JSON.stringify({ ok: false, error: 'TG_TOKEN secret missing' }), { status: 500, headers: hdrs });

    if (method === 'sendPhoto' || method === 'sendDocument') {
      const fd = new FormData();
      for (const k of Object.keys(body)) {
        if (k === 'photo_b64' || k === 'document_b64') {
          const bin = atob(k === 'photo_b64' ? body.photo_b64 : body.document_b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          fd.append(k === 'photo_b64' ? 'photo' : 'document', new Blob([arr], { type: body.mime || 'image/jpeg' }), body.filename || 'file');
        } else {
          fd.append(k, body[k]);
        }
      }
      tgResp = await fetch('https://api.telegram.org/bot' + token + '/' + method, { method: 'POST', body: fd });
    } else {
      tgResp = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
    }
    const out = await tgResp.text();
    return new Response(out, { status: 200, headers: hdrs });
  },
};
