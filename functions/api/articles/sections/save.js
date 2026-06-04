// /functions/api/articles/sections/save.js
export async function onRequestPost() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
