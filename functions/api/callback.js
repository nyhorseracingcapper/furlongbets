function cookies(req){ return Object.fromEntries((req.headers.get('Cookie')||'').split(';').map(c=>{const i=c.indexOf('=');return [c.slice(0,i).trim(), decodeURIComponent(c.slice(i+1))];}).filter(x=>x[0])); }
async function hmac(secret, data){
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
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
  const ar = await fetch(`https://api.whop.com/api/v5/users/${userId}/access/${env.WHOP_PRODUCT_ID}`, { headers:{ Authorization:`Bearer ${env.WHOP_API_KEY}` }});
  const abody = await ar.text(); let a={}; try{a=JSON.parse(abody);}catch(e){}
  const ok = ar.ok && !!a.has_access && (a.access_level==='customer' || a.access_level==='admin');
  if(!ok){
    let free='';
    try{ const fr = await fetch(`https://api.whop.com/api/v5/users/${userId}/access/prod_VrgmwhPrbEZaF`, { headers:{ Authorization:`Bearer ${env.WHOP_API_KEY}` }}); free='free'+fr.status+':'+(await fr.text()).slice(0,70); }catch(e){ free='free_err'; }
    return back('nomember', 'uid='+userId+' paid'+ar.status+':'+abody.slice(0,70)+' '+free);
  }
  const exp = Date.now() + 1000*60*60*24*30;
  const base = `${userId}.${exp}`; const sig = await hmac(env.SESSION_SECRET, base);
  const h = new Headers(); h.append('Set-Cookie','whop_pkce=; Path=/; Max-Age=0');
  h.append('Set-Cookie', `furlong_session=${base}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60*60*24*30}`);
  h.set('Location', url.origin + '/members.html');
  return new Response(null, { status:302, headers:h });
}
