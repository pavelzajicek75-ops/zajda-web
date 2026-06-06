export async function onRequest(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const id = body.id || crypto.randomUUID();

    const article = {
      id,
      title: body.title || "",
      place: body.place || "",
      date: body.date || "",
      section: body.section || "",
      subsection: body.subsection || "",
      content: body.content || "",
      updated: Date.now()
    };

    await env.ARTICLES.put(id, JSON.stringify(article));

    return new Response(JSON.stringify({ ok: true, id }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
