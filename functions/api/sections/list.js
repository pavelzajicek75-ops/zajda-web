export async function onRequest(context) {
  const { env } = context;

  // načti uložené podsekce
  const raw = await env.SUBSECTIONS.get("all");
  const stored = raw ? JSON.parse(raw) : {};

  const sections = [
    {
      id: "cestovani",
      name_cz: "Cestování",
      name_en: "Travel",
      subsections: stored.cestovani || []
    },
    {
      id: "fotografovani",
      name_cz: "Fotografování",
      name_en: "Photography",
      subsections: stored.fotografovani || []
    },
    {
      id: "projekty",
      name_cz: "Projekty",
      name_en: "Projects",
      subsections: stored.projekty || []
    },
    {
      id: "zajda",
      name_cz: "Zajda – O mně",
      name_en: "About",
      subsections: stored.zajda || []
    }
  ];

  return new Response(JSON.stringify(sections), {
    headers: { "Content-Type": "application/json" }
  });
}
