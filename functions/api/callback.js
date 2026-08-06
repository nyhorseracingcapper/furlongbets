function cookies(req){ return Object.fromEntries((req.headers.get('Cookie')||'').split(';').map(c=>{const i=c.indexOf('=');return [c.slice(0,i).trim(), decodeURIComponent(c.slice(i+1))];}).filter(x=>x[0])); }
async function hmac(secret, data){
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function memberships(env, userId, prod){
  const u = `https://api.whop.com/api/v2/memberships?user_id=${encodeURIComponent(userId)}&product_id=${encodeURIComponent(prod)}&valid=true&per=10`;
  const r = await fetch(u, { headers:{ Authorization:`Bearer ${env.WHOP_API_KEY}`, Accept:'application/json' }});
  const body = await r.text(); let j={}; try{j=JSON.parse(body);}catch(e){}
  const list = Array.isArray(j.data) ? j.data : [];
  return { status:r.status, count:list.length, body };
}
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const c = cookies(request); const [verifier, savedState] = (c['whop_pkce']||'').split('.');
  const back = (m, dbg) => Response.redirect(url.origin + '/members.html?e=' + m + (dbg? '&dbg=' + encodeURIComponent(dbg) : ''), 302);
  if(!code || !state || state!==savedState) return back('auth','state_mismatch');
  const tr = await fetch('https://api.whop.com/oauth/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri:env.REDIRECT_URI, client_id:env.WHOP_APP_ID, client_secret:env.WHOP_CLIENT_SECRET, code_verifier:verifier }) });
  if(!tr.ok){ const t=await tr.text(); return back('token', tr.status+':'+t.slice(0,150)); }
  const tok = await tr.json();
  const ur = await fetch('https://api.whop.com/oauth/userinfo', { headers:{ Authorization:`Bearer ${tok.access_token}` }});
  const ubody = await ur.text(); let user={}; try{user=JSON.parse(ubody);}catch(e){}
  const userId = user.sub || user.id || user.user_id;
  if(!userId) return back('user', ur.status+':'+ubody.slice(0,150));
  const paid = await memberships(env, userId, env.WHOP_PRODUCT_ID);
  const ok = paid.status===200 && paid.count>0;
  if(!ok){
    let free={status:'-',count:'-'};
    try{ free = await memberships(env, userId, 'prod_VrgmwhPrbEZaF'); }catch(e){}
    return back('nomember', `uid=${userId} paid_s${paid.status}n${paid.count} free_s${free.status}n${free.count} ${paid.body.slice(0,60)}`);
  }
  const exp = Date.now() + 1000*60*60*24*30;
  const base = `${userId}.${exp}`; const sig = await hmac(env.SESSION_SECRET, base);
  const h = new Headers(); h.append('Set-Cookie','whop_pkce=; Path=/; Max-Age=0');
  h.append('Set-Cookie', `furlong_session=${base}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60*60*24*30}`);
  h.set('Location', url.origin + '/members.html');
  return new Response(null, { status:302, headers:h });
}
