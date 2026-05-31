export async function onRequest(context) {
  const { params } = context;
  const filename = params.filename;

  // Public R2 URL – žádné bindingy
  const url = `https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/${filename}`;

  const response = await fetch(url);

  if (!response.ok) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";

  return new Response(await response.arrayBuffer(), {
    headers: { "Content-Type": contentType }
  });
}
