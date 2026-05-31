export async function onRequest() {
  const photos = [
    {
      id: "IMG_7781.JPG",
      name: "IMG_7781.JPG",
      url: "https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/IMG_7781.JPG"
    },
    {
      id: "sky-1107579.jpg",
      name: "sky-1107579.jpg",
      url: "https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/sky-1107579.jpg"
    },
    {
      id: "sky-1107952_1920.jpg",
      name: "sky-1107952_1920.jpg",
      url: "https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/sky-1107952_1920.jpg"
    },
    {
      id: "ts_file1442.jpg",
      name: "ts_file1442.jpg",
      url: "https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/ts_file1442.jpg"
    }
  ];

  return new Response(JSON.stringify(photos), {
    headers: { "Content-Type": "application/json" }
  });
}
