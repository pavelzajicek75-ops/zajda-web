export async function onRequestPost(context) {
  const { request, env } = context
  const data = await request.json()

  if (!data.title || !data.section || !data.subsection || !data.content) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    })
  }

  const bucket = env.zajda_articles
  const object = await bucket.get("articles.json")
  let articles = object ? JSON.parse(await object.text()) : []

  const newArticle = {
    id: crypto.randomUUID(),
    title: data.title,
    section: data.section,
    subsection: data.subsection,
    place: data.place,
    content: data.content,
    created: data.created || new Date().toISOString()
  }

  articles.push(newArticle)
  await bucket.put("articles.json", JSON.stringify(articles, null, 2), {
    httpMetadata: { contentType: "application/json" }
  })

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  })
}
