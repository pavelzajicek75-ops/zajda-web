function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function verifyJWT(token, secret) {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = base64urlDecode(signatureB64);

  return crypto.subtle.verify("HMAC", key, signature, data);
}

export async function onRequestPost(context) {
  const auth = context.request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const token = auth.replace("Bearer ", "").trim();
  const valid = await verifyJWT(token, context.env.ADMIN_JWT_SECRET);
  if (!valid) return Response.json({ ok: false }, { status: 401 });

  const exists = await context.env.SESSIONS.get(token);
  if (!exists) return Response.json({ ok: false }, { status: 401 });

  return Response.json({ ok: true });
}
