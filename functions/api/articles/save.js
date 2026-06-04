// /functions/api/article/save.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const bucket = env.zajda_articles;

  const body = await request.json();

  let id = body.id;
  if (!id) {
    id = crypto.randomUUID();
  }

  const article = {
    id,
    title: body.title,
    section: body.section,
    subsection: body.subsection,
    place: body.place,
    date: body.date,
    content: body.content,
    created: body.created || new Date().toISOString(),
    updated: new Date().toISOString()
  };

  // uložit článek jako samostatný soubor
  await bucket.put(`articles/${id}.json`, JSON.stringify(article, null, 2), {
    httpMetadata: { contentType: "application/json" }
  });

  // aktualizovat seznam článků
  const listFile = await bucket.get("articles.json");
  let list = [];

  if (listFile) {
    list = JSON.parse(await listFile.text());
  }

  const index = list.findIndex(a => a.id === id);
  if (index >= 0) {
    list[index] = article;
  } else {
    list.push(article);
  }

  await bucket.put("articles.json", JSON.stringify(list, null, 2), {
    httpMetadata: { contentType: "application/json" }
  });

  return new Response(JSON.stringify({ success: true, id }), {
    headers: { "Content-Type": "application/json" }
  });
}
