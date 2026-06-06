// /functions/api/auth/verify.js

const JWT_SECRET = "super-tajne-heslo-zajda"; // MUSÍ být stejné jako v login.js

// Cloudflare-safe Base64URL decode
function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify("HMAC", key, signature, data);
  if (!valid) return null;

  // Cloudflare-safe payload decode
  const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
  const payload = JSON.parse(json);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;

  return payload;
}

export async function onRequest(context) {
  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return Response.json({ valid: false }, { status: 401 });
  }

  try {
    const payload = await verifyJwt(token, JWT_SECRET);
    if (!payload) {
      return Response.json({ valid: false }, { status: 401 });
    }

    return Response.json({ valid: true, username: payload.username });
  } catch (err) {
    return Response.json({ valid: false }, { status: 401 });
  }
}
