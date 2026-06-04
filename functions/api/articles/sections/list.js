// /functions/api/articles/sections/list.js
export async function onRequestGet(context) {
  const { env } = context;
  const bucket = env.zajda_articles;

  const obj = await bucket.get("sections.json");
  let sections = [];

  if (obj) {
    sections = JSON.parse(await obj.text());
  } else {
    sections = [
      { name: "Aktuality", subsections: ["Obecné"] },
      { name: "Reportáže", subsections: ["Sport", "Kultura"] }
    ];
  }

  return new Response(JSON.stringify({ sections }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
