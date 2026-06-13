// ============================================
// AUTH – ověření tokenu pro chráněné endpointy
// ============================================

export async function onRequest(context) {
  const { request, env } = context;

  try {
    // získat token z hlavičky
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Chybí autorizace" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // ověřit token v KV
    const session = await env.SESSIONS.get(token);
    if (!session) {
      return new Response(JSON.stringify({ error: "Neplatný nebo vypršelý token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // token platný → pokračuj
    return new Response(JSON.stringify({ ok: true }), {
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
