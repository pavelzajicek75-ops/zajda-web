export async function onRequest() {
  // Sem doplň názvy všech fotek v R2
  const photos = [
    "IMG_7781.JPG",
    "IMG_7782.JPG",
    "IMG_7783.JPG"
  ];

  const urls = photos.map(name => ({
    url: `https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/${name}`
  }));

  return new Response(JSON.stringify(urls), {
    headers: { "Content-Type": "application/json" }
  });
}
