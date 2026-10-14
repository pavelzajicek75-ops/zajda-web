// Vyřazený starý koncový bod. Dřív byl bez přihlášení; nahrazen novými (s ověřením) v api/*.
export async function onRequest() {
  return new Response(JSON.stringify({ error: 'Gone' }), { status: 410, headers: { 'Content-Type': 'application/json' } });
}
