export async function onRequestPost(context) {
  const { password } = await context.request.json();

  if (password !== context.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }

  const token = crypto.randomUUID();
  await context.env.SESSIONS.put(token, "valid", { expirationTtl: 60 * 60 * 24 });

  return new Response(JSON.stringify({ ok: true, token }), {
    headers: { "Content-Type": "application/json" }
  });
}
