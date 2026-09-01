import {
  pgTable, pgEnum, uuid, text, integer, bigint, boolean, timestamp,
  date, jsonb, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const estadoEvento = pgEnum('estado_evento', ['borrador', 'activo', 'cerrado']);
export const estadoFoto = pgEnum('estado_foto', ['pendiente', 'publicada', 'oculta', 'eliminada']);
export const estadoComentario = pgEnum('estado_comentario', ['publicado', 'oculto']);
export const tipoReaccion = pgEnum('tipo_reaccion', ['corazon', 'risa', 'fiesta', 'emocion']);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  nombre: text('nombre').notNull(),
  fecha: date('fecha').notNull(),
  timezone: text('timezone').notNull().default('America/Argentina/Buenos_Aires'),
  estado: estadoEvento('estado').notNull().default('borrador'),
  // cuota por token, limites, textos de la portada
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const guestTokens = pgTable('guest_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  token: text('token').notNull().unique(),
  label: text('label').notNull(),              // "Mesa 7"
  usos: integer('usos').notNull().default(0),  // fotos subidas, contra la cuota
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  revocadoEn: timestamp('revocado_en', { withTimezone: true }),
}, (t) => [index('guest_tokens_event_idx').on(t.eventId)]);

export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  guestTokenId: uuid('guest_token_id').notNull().references(() => guestTokens.id),

  keyOriginal: text('key_original').notNull(),
  keyWeb: text('key_web').notNull(),
  keyThumb: text('key_thumb').notNull(),
  // false = el navegador no pudo decodificar; las 3 keys apuntan al original (§13.2)
  derivadas: boolean('derivadas').notNull().default(true),

  mime: text('mime').notNull(),
  bytes: bigint('bytes', { mode: 'number' }).notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  phash: text('phash'),

  takenAt: timestamp('taken_at', { withTimezone: true }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  caption: text('caption'),
  exif: jsonb('exif'),
  estado: estadoFoto('estado').notNull().default('publicada'), // moderacion posterior (§10.4)
  orden: integer('orden'),
}, (t) => [
  // feed: coalesce(taken_at, uploaded_at) desc — muchos celulares traen la hora mal
  index('photos_feed_idx').on(t.eventId, t.estado, sql`coalesce(${t.takenAt}, ${t.uploadedAt}) desc`),
  index('photos_dedup_idx').on(t.eventId, t.phash),
  index('photos_token_idx').on(t.guestTokenId),
]);

export const reactions = pgTable('reactions', {
  photoId: uuid('photo_id').notNull().references(() => photos.id),
  guestTokenId: uuid('guest_token_id').notNull().references(() => guestTokens.id),
  tipo: tipoReaccion('tipo').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.photoId, t.guestTokenId, t.tipo] })]);

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  photoId: uuid('photo_id').notNull().references(() => photos.id),
  guestTokenId: uuid('guest_token_id').notNull().references(() => guestTokens.id),
  texto: text('texto').notNull(),
  estado: estadoComentario('estado').notNull().default('publicado'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('comments_photo_idx').on(t.photoId, t.creadoEn)]);

// agregado por dia: nunca una fila por impresion de thumbnail
export const viewEvents = pgTable('view_events', {
  photoId: uuid('photo_id').notNull().references(() => photos.id),
  dia: date('dia').notNull(),
  cantidad: integer('cantidad').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.photoId, t.dia] })]);
