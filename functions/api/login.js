function base64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64url(encoder.encode(JSON.stringify(payload)));

  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const encodedSignature = base64url(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function onRequestPost(context) {
  const { username, password } = await context.request.json();

  // 1) kontrola jména
  if (username !== "zajda") {
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }

  // 2) kontrola hesla
  if (password !== context.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }

  // 3) vytvoření tokenu
  const token = await signJWT(
    { admin: true, ts: Date.now(), username: "zajda" },
    context.env.ADMIN_JWT_SECRET
  );

  // 4) uložení session
  await context.env.SESSIONS.put(token, "valid", {
    expirationTtl: 60 * 60 * 24
  });

  return new Response(JSON.stringify({ ok: true, token }), {
    headers: { "Content-Type": "application/json" }
  });
}
