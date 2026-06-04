// /functions/api/articles/sections/list.js
export async function onRequestGet(context) {
  const { env } = context;
  const bucket = env.zajda_articles;

  try {
    const obj = await bucket.get("sections.json");
    let sections = [];

    if (obj) {
      sections = JSON.parse(await obj.text());
    } else {
      // Fallback – výchozí sekce
      sections = [
        { name: "Aktuality", subsections: ["Obecné"] },
        { name: "Reportáže", subsections: ["Sport", "Kultura"] },
        { name: "Fotografování", subsections: ["Portréty", "Krajiny"] },
        { name: "Cestování", subsections: ["Evropa", "Svět"] }
      ];
    }

    return new Response(JSON.stringify({ sections }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
