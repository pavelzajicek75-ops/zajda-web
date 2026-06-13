import jwt from "@tsndr/cloudflare-worker-jwt";

export async function onRequest(context) {
  const cookie = context.request.headers.get("Cookie");
  const token = cookie?.match(/token=([^;]+)/)?.[1];

  if (!token) {
    return Response.json({ ok: false });
  }

  const valid = await jwt.verify(token, context.env.ADMIN_JWT_SECRET);

  if (!valid) {
    return Response.json({ ok: false });
  }

  return Response.json({ ok: true });
}
