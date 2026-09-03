import { NextResponse } from 'next/server';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { guestTokens, photos } from '@/db/schema';
import { cuotaDe, mesaDeCookie } from '@/lib/token';

export async function POST(req: Request) {
  const b = await req.json();

  const mesa = await mesaDeCookie(String(b.slug ?? ''));
  if (!mesa) return NextResponse.json({ error: 'sin-token' }, { status: 401 });

  // el contador es la cuota: si el UPDATE no toca ninguna fila, la mesa se paso.
  const cupo = await db.update(guestTokens)
    .set({ usos: sql`${guestTokens.usos} + 1` })
    .where(and(eq(guestTokens.id, mesa.id), lt(guestTokens.usos, cuotaDe(mesa.config))))
    .returning({ usos: guestTokens.usos });
  if (cupo.length === 0) return NextResponse.json({ error: 'cuota' }, { status: 429 });

  const [foto] = await db.insert(photos).values({
    id: b.id,
    eventId: mesa.eventId,
    guestTokenId: mesa.id,
    keyOriginal: b.keys.original,
    keyWeb: b.keys.web,
    keyThumb: b.keys.thumb,
    derivadas: Boolean(b.derivadas),
    mime: String(b.mime),
    bytes: Number(b.bytes),
    width: Number(b.width) || 0,
    height: Number(b.height) || 0,
    takenAt: b.takenAt ? new Date(b.takenAt) : null,
  }).returning({ id: photos.id });

  return NextResponse.json({ id: foto.id, usos: cupo[0].usos, cuota: cuotaDe(mesa.config) });
}
