export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    // Ověř přihlašovací údaje
    const adminUser = env.ADMIN_USER || "admin";
    const adminPass = env.ADMIN_PASSWORD || "heslo123";

    if (username !== adminUser || password !== adminPass) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Generuj JWT token
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      username: username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7 // 7 dní
    }));

    const secret = env.JWT_SECRET || "super-tajne-heslo-zmenit-v-production";
    const encoder = new TextEncoder();
    const data = encoder.encode(`${header}.${payload}`);
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = btoa(
      String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, data)))
    ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

    const token = `${header}.${payload}.${signature}`;

    return new Response(JSON.stringify({
      success: true,
      token: token,
      username: username
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `adminToken=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict`
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
