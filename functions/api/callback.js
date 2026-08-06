function cookies(req){ return Object.fromEntries((req.headers.get('Cookie')||'').split(';').map(c=>{const i=c.indexOf('=');return [c.slice(0,i).trim(), decodeURIComponent(c.slice(i+1))];}).filter(x=>x[0])); }
async function hmac(secret, data){
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function checkAccess(env, userId){
  const u = `https://api.whop.com/api/v2/memberships?user_id=${encodeURIComponent(userId)}&product_id=${encodeURIComponent(env.WHOP_PRODUCT_ID)}&valid=true&per=10`;
  const r = await fetch(u, { headers:{ Authorization:`Bearer ${env.WHOP_API_KEY}`, Accept:'application/json' }});
  if(!r.ok) return false;
  const j = await r.json();
  return Array.isArray(j.data) && j.data.length > 0;
}
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const c = cookies(request); const [verifier, savedState] = (c['whop_pkce']||'').split('.');
  const back = m => Response.redirect(url.origin + '/members.html?e=' + m, 302);
  if(!code || !state || state!==savedState) return back('auth');
  const tr = await fetch('https://api.whop.com/oauth/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri:env.REDIRECT_URI, client_id:env.WHOP_APP_ID, client_secret:env.WHOP_CLIENT_SECRET, code_verifier:verifier }) });
  if(!tr.ok) return back('token');
  const tok = await tr.json();
  const ur = await fetch('https://api.whop.com/oauth/userinfo', { headers:{ Authorization:`Bearer ${tok.access_token}` }});
  const user = await ur.json(); const userId = user.sub || user.id || user.user_id;
  if(!userId) return back('user');
  if(!(await checkAccess(env, userId))) return back('nomember');
  const exp = Date.now() + 1000*60*60*24*30;
  const base = `${userId}.${exp}`; const sig = await hmac(env.SESSION_SECRET, base);
  const h = new Headers(); h.append('Set-Cookie','whop_pkce=; Path=/; Max-Age=0');
  h.append('Set-Cookie', `furlong_session=${base}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60*60*24*30}`);
  h.set('Location', url.origin + '/members.html');
  return new Response(null, { status:302, headers:h });
}
