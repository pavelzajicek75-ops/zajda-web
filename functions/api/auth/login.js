// /functions/api/auth/login.js

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "zajda123"; // změň si podle sebe
const JWT_SECRET = "super-tajne-heslo-zajda"; // změň si, ale drž konzistentní

function createJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const headerPart = enc(header);
  const payloadPart = enc(payload);
  const data = `${headerPart}.${payloadPart}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(data);

  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  ).then(key =>
    crypto.subtle.sign("HMAC", key, msgData)
  ).then(sig => {
    const bytes = new Uint8Array(sig);
    let bin = "";
    bytes.forEach(b => bin += String.fromCharCode(b));
    const signature = btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${data}.${signature}`;
  });
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      username,
      iat: now,
      exp: now + 60 * 60 * 8 // 8 hodin
    };

    const token = await createJwt(payload, JWT_SECRET);

    return new Response(JSON.stringify({ token, username }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
