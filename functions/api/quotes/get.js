// Vyřazený starý koncový bod (nepoužívá se).
export async function onRequest() {
  return new Response(JSON.stringify({ error: 'Gone' }), { status: 410, headers: { 'Content-Type': 'application/json' } });
}
