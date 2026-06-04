// /functions/api/articles/sections/list.js

export async function onRequestGet(context) {
  // ZATÍM statické sekce – můžeš později uložit do R2
  const sections = [
    {
      name: "Cestování",
      subsections: ["Evropa", "Asie", "Afrika", "Amerika"]
    },
    {
      name: "Fotografie",
      subsections: ["Portréty", "Příroda", "Města", "Zvířata"]
    },
    {
      name: "Osobní",
      subsections: ["Myšlenky", "Zážitky", "Denník"]
    },
    {
      name: "Projekty",
      subsections: ["Web", "Design", "Technologie"]
    }
  ];

  return new Response(JSON.stringify({ sections }), {
    headers: { "Content-Type": "application/json" }
  });
}
