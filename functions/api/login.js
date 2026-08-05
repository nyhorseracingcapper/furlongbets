const b64url = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const rand = n => { const a=new Uint8Array(n); crypto.getRandomValues(a); return b64url(a.buffer); };
async function sha256(s){ return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); }
export async function onRequestGet({ env }) {
  const verifier = rand(48);
  const challenge = b64url(await sha256(verifier));
  const state = rand(16);
  const u = new URL('https://api.whop.com/oauth/authorize');
  u.searchParams.set('client_id', env.WHOP_APP_ID);
  u.searchParams.set('redirect_uri', env.REDIRECT_URI);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid');
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', state);
  const h = new Headers({ Location: u.toString() });
  h.append('Set-Cookie', `whop_pkce=${verifier}.${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  return new Response(null, { status: 302, headers: h });
}
