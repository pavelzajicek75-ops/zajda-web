export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const section = url.searchParams.get("section");
  const subsection = url.searchParams.get("subsection");

  const list = [];
  const objects = await context.env.ARTICLES_BUCKET.list({
    prefix: `articles/${section}/${subsection}/`
  });

  for (const obj of objects.objects) {
    const file = await context.env.ARTICLES_BUCKET.get(obj.key);
    const json = await file.json();

    list.push({
      title: json.title,
      date: json.date,
      place: json.place,
      leadImage: json.leadImage || null,
      slug: obj.key.split("/").pop().replace(".json", "")
    });
  }

  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  return Response.json(list);
}
