import { NextResponse } from 'next/server';
import { POR_PAGINA, POR_PAGINA_MAX, feed } from '@/lib/fotos';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const slug = q.get('slug');
  if (!slug) return NextResponse.json({ error: 'falta-slug' }, { status: 400 });

  const cuando = q.get('cuando');
  const id = q.get('id');
  // ?porPagina lo usa la galeria para traer el evento en una sola vuelta
  const pedido = Number(q.get('porPagina'));
  const porPagina = Number.isFinite(pedido) && pedido > 0
    ? Math.min(pedido, POR_PAGINA_MAX)
    : POR_PAGINA;

  return NextResponse.json(await feed(slug, cuando && id ? { cuando, id } : undefined, porPagina));
}
