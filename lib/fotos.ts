import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { events, photos } from '@/db/schema';
import { urlPublica } from '@/lib/storage';

export const POR_PAGINA = 60;

// muchos celulares traen la hora mal: si no hay EXIF, vale la hora de subida
const cuando = sql<Date>`coalesce(${photos.takenAt}, ${photos.uploadedAt})`;

export type Foto = {
  id: string;
  thumb: string;
  web: string;
  width: number;
  height: number;
  cuando: string;
};

/** Una página del feed público, de la más nueva a la más vieja. */
export async function feed(slug: string, cursor?: { cuando: string; id: string }) {
  const filas = await db
    .select({
      id: photos.id, keyThumb: photos.keyThumb, keyWeb: photos.keyWeb,
      width: photos.width, height: photos.height, cuando: cuando.as('cuando'),
    })
    .from(photos)
    .innerJoin(events, eq(events.id, photos.eventId))
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
    .limit(POR_PAGINA + 1);

  const hayMas = filas.length > POR_PAGINA;
  const fotos: Foto[] = filas.slice(0, POR_PAGINA).map((f) => ({
    id: f.id,
    thumb: urlPublica(f.keyThumb),
    web: urlPublica(f.keyWeb),
    width: f.width || 4,
    height: f.height || 3,
    cuando: new Date(f.cuando).toISOString(),
  }));

  return { fotos, hayMas };
}
