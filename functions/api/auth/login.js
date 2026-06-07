export async function onRequest(context) {
  const { password } = await context.request.json();
  const stored = context.env.ADMIN_PASSWORD;

  if (password === stored) {
    const token = crypto.randomUUID();

    await context.env.SESSIONS.put(token, "ok", {
      expirationTtl: 3600   // 🔥 1 hodina, ne 1 sekunda
    });

    return Response.json({ token });
  }

  return Response.json({ error: "Invalid password" }, { status: 401 });
}
