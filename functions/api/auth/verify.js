export async function onRequest(context) {
  const token = context.request.headers.get("Authorization");

  if (!token) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const valid = await context.env.SESSIONS.get(token);

  return valid
    ? Response.json({ ok: true })
    : Response.json({ ok: false }, { status: 401 });
}

