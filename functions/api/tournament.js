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
function fromB64url(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); }
async function verifySession(env, v){
  if(!v) return null; const p=v.split('.'); if(p.length<3) return null;
  const sig=p.pop(); const base=p.join('.'); if(await hmac(env.SESSION_SECRET, base)!==sig) return null;
  const [userId, exp]=base.split('.'); if(Date.now()>Number(exp)) return null; return userId;
}
export async function onRequestGet({ request, env }) {
  const userId = await verifySession(env, cookies(request)['furlong_session']);
  const j = (o,s)=>new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(!userId) return j({error:'login'},401);
  if(!(await checkAccess(env, userId))) return j({error:'inactive'},403);
  const enc = new Uint8Array(await (await fetch(new URL('/members_tournament.enc', request.url))).arrayBuffer());
  const iv = enc.slice(0,12), ct = enc.slice(12);
  const key = await crypto.subtle.importKey('raw', fromB64url(env.CARD_KEY), {name:'AES-GCM'}, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ct);
  return new Response(new TextDecoder().decode(pt), { headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'} });
}
