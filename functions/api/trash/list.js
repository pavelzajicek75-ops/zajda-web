// GET /api/trash/list — položky koše (články, milníky), nejnovější první.
import { requireAdmin, json } from '../_auth-utils.js';
import { readTrashIndex, TRASH_DAYS } from '../_trash.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const items = await readTrashIndex(env);
  return Response.json({ days: TRASH_DAYS, items }, { headers: { 'cache-control': 'no-store' } });
}
