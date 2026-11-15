import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  try {
    return NextResponse.json(db.prepare('SELECT * FROM projects ORDER BY id DESC').all());
  } catch (error) {
    console.error('Projeler listelenemedi:', error);
    return NextResponse.json({ error: 'Projeler yüklenemedi.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Geçersiz proje bilgileri.' }, { status: 400 });
  }
  const values = body as Record<string, unknown>;
  if (!['semt', 'ada', 'parsel'].every(key => typeof values[key] === 'string' && (values[key] as string).trim().length > 0 && (values[key] as string).trim().length <= 100)) {
    return NextResponse.json({ error: 'Tüm alanları doldurun (en fazla 100 karakter).' }, { status: 400 });
  }
  try {
    const result = db.prepare('INSERT INTO projects (semt, ada, parsel) VALUES (?, ?, ?)').run((values.semt as string).trim(), (values.ada as string).trim(), (values.parsel as string).trim());
    return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
  } catch (error) {
    console.error('Proje kaydedilemedi:', error);
    return NextResponse.json({ error: 'Proje kaydedilemedi.' }, { status: 500 });
  }
}
