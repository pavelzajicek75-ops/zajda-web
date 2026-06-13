export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { password } = await request.json();

    // 🔥 tvoje admin heslo
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

    if (!password || password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Špatné heslo" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 🔥 vytvoření tokenu
    const token = crypto.randomUUID();

    // uložit token do KV
    await env.SESSIONS.put(token, "valid", { expirationTtl: 60 * 60 * 24 });

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Chyba serveru" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
