export async function onRequestPost(context) {
  try {
    const auth = context.request.headers.get("Authorization");

    if (!auth || !auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const token = auth.replace("Bearer ", "").trim();

    // ✔ Ověření tokenu v KV (STEJNÉ jako login.js)
    const session = await context.env.SESSIONS.get(token);

    if (!session) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ valid: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ valid: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
}
