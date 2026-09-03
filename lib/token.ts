import { cookies } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { events, guestTokens } from '@/db/schema';

export const COOKIE = 'mesa';

/** Token de mesa valido para un evento activo, o null. */
export async function mesaDe(slug: string, token: string | undefined) {
  if (!token) return null;
  const [fila] = await db
    .select({ id: guestTokens.id, label: guestTokens.label, usos: guestTokens.usos, eventId: events.id, config: events.config })
    .from(guestTokens)
    .innerJoin(events, eq(events.id, guestTokens.eventId))
    .where(and(eq(guestTokens.token, token), eq(events.slug, slug), isNull(guestTokens.revocadoEn), eq(events.estado, 'activo')))
    .limit(1);
  return fila ?? null;
}

/** La mesa guardada en la cookie httpOnly, para las rutas de escritura. */
export async function mesaDeCookie(slug: string) {
  return mesaDe(slug, (await cookies()).get(COOKIE)?.value);
}

export const cuotaDe = (config: unknown) =>
  Number((config as { cuotaPorToken?: number } | null)?.cuotaPorToken ?? 40);

export const maxBytesDe = (config: unknown) =>
  Number((config as { maxBytes?: number } | null)?.maxBytes ?? 25 * 1024 * 1024);
