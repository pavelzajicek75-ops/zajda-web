export async function onRequestGet(context) {
  const list = [];
  const objects = await context.env.ARTICLES_BUCKET.list({
    prefix: "articles/"
  });

  for (const obj of objects.objects) {
    const file = await context.env.ARTICLES_BUCKET.get(obj.key);
    const json = await file.json();

    list.push({
      key: obj.key,
      title: json.title,
      section: json.section,
      subsection: json.subsection,
      date: json.date
    });
  }

  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  return Response.json(list);
}
