import { NextResponse } from 'next/server';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { guestTokens, photos } from '@/db/schema';
import { esAdmin } from '@/lib/admin';
import { urlPublica } from '@/lib/storage';

const cuando = sql<Date>`coalesce(${photos.takenAt}, ${photos.uploadedAt})`;
// ponytail: tope fijo, una boda no pasa de esto; paginar si alguna vez llega
const TOPE = 2000;

export async function GET() {
  if (!(await esAdmin())) return NextResponse.json({ error: 'sin-sesion' }, { status: 401 });

  const filas = await db
    .select({
      id: photos.id, keyThumb: photos.keyThumb, keyWeb: photos.keyWeb, estado: photos.estado,
      width: photos.width, height: photos.height, subida: photos.uploadedAt, mesa: guestTokens.label,
    })
    .from(photos)
    .innerJoin(guestTokens, eq(guestTokens.id, photos.guestTokenId))
    .where(inArray(photos.estado, ['publicada', 'oculta']))
    .orderBy(desc(photos.uploadedAt), desc(cuando))
    .limit(TOPE);

  return NextResponse.json({
    fotos: filas.map((f) => ({
      id: f.id,
      thumb: urlPublica(f.keyThumb),
      web: urlPublica(f.keyWeb),
      estado: f.estado,
      width: f.width || 4,
      height: f.height || 3,
      subida: new Date(f.subida).toISOString(),
      mesa: f.mesa,
    })),
  });
}

export async function PATCH(req: Request) {
  if (!(await esAdmin())) return NextResponse.json({ error: 'sin-sesion' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const ids = Array.isArray(b?.ids) ? b.ids.filter((x: unknown) => typeof x === 'string') : [];
  const estado = b?.estado;
  if (!ids.length || ids.length > TOPE || (estado !== 'publicada' && estado !== 'oculta')) {
    return NextResponse.json({ error: 'pedido-invalido' }, { status: 400 });
  }

  const hechas = await db.update(photos).set({ estado })
    .where(inArray(photos.id, ids))
    .returning({ id: photos.id });
  return NextResponse.json({ ids: hechas.map((h) => h.id), estado });
}
