import jwt from "@tsndr/cloudflare-worker-jwt";

export async function onRequest(context) {
  const { password } = await context.request.json();

  if (password !== context.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }

  const token = await jwt.sign(
    { admin: true, ts: Date.now() },
    context.env.ADMIN_JWT_SECRET
  );

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `token=${token}; Path=/; Secure; HttpOnly; SameSite=None`
    }
  });
}
