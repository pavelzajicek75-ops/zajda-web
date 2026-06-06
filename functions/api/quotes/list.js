export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_quotes;

  const defaultQuotes = [
    "We shine like stars falling from the sky.",
    "Every silence hides a spark.",
    "Dreams are the gravity of the soul.",
    "Light travels even through darkness.",
    "Moments fade, but meaning stays.",
    "We are echoes of our own constellations.",
    "Stars fall, but we rise.",
    "A light you can't always see.",
    "Every night carries a hidden sunrise.",
    "We get lost to find ourselves."
  ];

  // -------------------------
  // GET – načtení citátů
  // -------------------------
  if (request.method === "GET") {
    try {
      const object = await bucket.get("quotes.json");
      if (!object) {
        return Response.json({ quotes: defaultQuotes });
      }

      const text = await object.text();
      const data = JSON.parse(text);

      if (!data.quotes || !Array.isArray(data.quotes) || data.quotes.length === 0) {
        return Response.json({ quotes: defaultQuotes });
      }

      return Response.json(data);
    } catch (err) {
      return Response.json({ quotes: defaultQuotes });
    }
  }

  // -------------------------
  // POST – uložení citátů z dashboardu
  // -------------------------
  if (request.method === "POST") {
    try {
      const body = await request.json();

      if (!body.quotes || !Array.isArray(body.quotes)) {
        return new Response("Invalid format", { status: 400 });
      }

      await bucket.put("quotes.json", JSON.stringify({ quotes: body.quotes }, null, 2), {
        httpMetadata: { contentType: "application/json" }
      });

      return Response.json({ success: true });
    } catch (err) {
      return new Response("Error saving quotes", { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
