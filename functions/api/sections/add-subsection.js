export async function onRequest(context) {
  const { request, env } = context;

  const body = await request.json();
  const { sectionId, name } = body;

  if (!sectionId || !name) {
    return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });
  }

  const raw = await env.SUBSECTIONS.get("all");
  const data = raw ? JSON.parse(raw) : {};

  if (!data[sectionId]) data[sectionId] = [];

  const newSub = {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name
  };

  data[sectionId].push(newSub);

  await env.SUBSECTIONS.put("all", JSON.stringify(data));

  return new Response(JSON.stringify(newSub), {
    headers: { "Content-Type": "application/json" }
  });
}
