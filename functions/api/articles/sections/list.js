// /functions/api/articles/sections/list.js
export async function onRequestGet() {

  const sections = [
    {
      name: "Fotografování",
      subsections: ["Portréty", "Krajiny", "Zvířata", "Reportáž"]
    },
    {
      name: "Cestování",
      subsections: ["Evropa", "Svět", "Tipy na cesty"]
    },
    {
      name: "Projekty",
      subsections: ["Osobní projekty", "Dlouhodobé projekty"]
    },
    {
      name: "Zajda / About",
      subsections: ["O mně", "Můj příběh"]
    }
  ];

  return new Response(JSON.stringify({ sections }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
