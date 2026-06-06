export async function onRequest(context) {
  const sections = [
    {
      id: "fotografie",
      name: "Fotografie",
      subsections: [
        { id: "krajina", name: "Krajina" },
        { id: "portrét", name: "Portrét" },
        { id: "street", name: "Street" }
      ]
    },
    {
      id: "cestovani",
      name: "Cestování",
      subsections: [
        { id: "evropa", name: "Evropa" },
        { id: "asii", name: "Asie" },
        { id: "cr", name: "ČR" }
      ]
    },
    {
      id: "osobni",
      name: "Osobní",
      subsections: [
        { id: "zivot", name: "Život" },
        { id: "diagnoza", name: "Diagnóza" }
      ]
    }
  ];

  return new Response(JSON.stringify(sections), {
    headers: { "Content-Type": "application/json" }
  });
}
