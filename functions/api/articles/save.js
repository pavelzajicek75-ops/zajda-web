export async function onRequestPost(context) {
  const form = await context.request.formData();
  const data = JSON.parse(form.get("data"));
  const slug = form.get("slug");
  const editKey = form.get("editKey");

  const key = editKey || `articles/${data.section}/${data.subsection}/${slug}.json`;

  await context.env.ARTICLES_BUCKET.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: "application/json" }
  });

  return new Response("OK");
}
