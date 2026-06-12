// ============================================
// ADMIN TOKEN VERIFY ENDPOINT – FINÁLNÍ VERZE
// ============================================

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

    // 🔥 TADY OPRAVDU MUSÍ BÝT STEJNÝ SECRET JAKO V LOGINU
    const secret = context.env.ADMIN_JWT_SECRET;

    const { payload } = await context.env.JWT.verify(token, secret);

    return new Response(JSON.stringify({ valid: true, exp: payload.exp }), {
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
