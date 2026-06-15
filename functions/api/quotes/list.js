export async function onRequestGet(context) {
  const { env } = context;
  const list = await env['zajda-quotes'].list({ prefix: 'quotes/' });
  const quotes = [];
  for (const obj of list.objects || []) {
    const data = await env['zajda-quotes'].get(obj.key);
    if (data) quotes.push(await data.json());
  }
  return Response.json(quotes);
}
