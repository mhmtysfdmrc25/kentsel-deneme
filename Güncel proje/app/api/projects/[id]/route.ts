import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { projectFields, validateProject } from '@/lib/projects';
export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ id: string }> };
async function getId(context: RouteContext) {
  const raw = (await context.params).id;
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
}
export async function PUT(request: Request, context: RouteContext) {
  const id = await getId(context);
  if (!id) return NextResponse.json({ error: 'Geçersiz proje kimliği.' }, { status: 400 });
  let values;
  try { values = validateProject(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçersiz istek.' }, { status: 400 }); }
  try {
    const result = db.prepare(`UPDATE projects SET ${projectFields.map(key => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...projectFields.map(key => values[key]), id);
    if (!result.changes) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Proje güncellenemedi.' }, { status: 500 });
  }
}
export async function DELETE(_request: Request, context: RouteContext) {
  const id = await getId(context);
  if (!id) return NextResponse.json({ error: 'Geçersiz proje kimliği.' }, { status: 400 });
  try {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    if (!result.changes) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Proje silinemedi.' }, { status: 500 });
  }
}
