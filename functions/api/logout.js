export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const h = new Headers({ Location: url.origin + '/members.html' });
  h.append('Set-Cookie', 'furlong_session=; Path=/; Max-Age=0');
  return new Response(null, { status: 302, headers: h });
}
