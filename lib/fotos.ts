import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { events, guestTokens, photos } from '@/db/schema';
import { urlPublica } from '@/lib/storage';

export const POR_PAGINA = 60;
// la galeria 3D pide todo de una: dos vueltas a la base eran ~1,5s antes de la
// primera portada. El tope existe para que nadie pida la boda entera sin querer.
export const POR_PAGINA_MAX = 300;

// muchos celulares traen la hora mal: si no hay EXIF, vale la hora de subida
const cuando = sql<Date>`coalesce(${photos.takenAt}, ${photos.uploadedAt})`;

export type Foto = {
  id: string;
  thumb: string;
  web: string;
  width: number;
  height: number;
  cuando: string;
  mesa: string;
};

/** Una página del feed público, de la más nueva a la más vieja. */
export async function feed(slug: string, cursor?: { cuando: string; id: string }, porPagina = POR_PAGINA) {
  const filas = await db
    .select({
      id: photos.id, keyThumb: photos.keyThumb, keyWeb: photos.keyWeb,
      width: photos.width, height: photos.height, cuando: cuando.as('cuando'),
      mesa: guestTokens.label,
    })
    .from(photos)
    .innerJoin(events, eq(events.id, photos.eventId))
    .innerJoin(guestTokens, eq(guestTokens.id, photos.guestTokenId))
    .where(and(
      eq(events.slug, slug),
      eq(photos.estado, 'publicada'),
      // el cursor va casteado a mano: `cuando` es una expresion cruda y drizzle
      // no sabe serializarle un Date
      cursor
        ? sql`(${cuando}, ${photos.id}) < (${cursor.cuando}::timestamptz, ${cursor.id}::uuid)`
        : undefined,
    ))
    .orderBy(desc(cuando), desc(photos.id))
    .limit(porPagina + 1);

  const hayMas = filas.length > porPagina;
  const fotos: Foto[] = filas.slice(0, porPagina).map((f) => ({
    id: f.id,
    thumb: urlPublica(f.keyThumb),
    web: urlPublica(f.keyWeb),
    width: f.width || 4,
    height: f.height || 3,
    cuando: new Date(f.cuando).toISOString(),
    mesa: f.mesa,
  }));

  return { fotos, hayMas };
}
