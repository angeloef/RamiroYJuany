import { NextResponse } from 'next/server';
import { feed } from '@/lib/fotos';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const slug = q.get('slug');
  if (!slug) return NextResponse.json({ error: 'falta-slug' }, { status: 400 });

  const cuando = q.get('cuando');
  const id = q.get('id');
  return NextResponse.json(await feed(slug, cuando && id ? { cuando, id } : undefined));
}
