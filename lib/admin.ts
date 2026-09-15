import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

// ponytail: un solo usuario fijo, pedido explicito de los novios; si hay mas, pasa a tabla
const USUARIO = 'Juany';
const CLAVE = 'Ramiro';
export const COOKIE_PANEL = 'panel';

// la cookie es una firma, no la clave: sin el secreto del server no se puede fabricar
const SECRETO = process.env.PANEL_SECRET ?? process.env.DATABASE_URL ?? 'dev';
const firma = () => createHmac('sha256', SECRETO).update(`${USUARIO}:${CLAVE}`).digest('base64url');

const iguales = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const credencialesOk = (usuario: string, clave: string) =>
  iguales(usuario.trim(), USUARIO) && iguales(clave, CLAVE);

export async function esAdmin() {
  const v = (await cookies()).get(COOKIE_PANEL)?.value;
  return Boolean(v && iguales(v, firma()));
}

export async function abrirSesion() {
  (await cookies()).set(COOKIE_PANEL, firma(), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 60 * 60 * 24 * 14,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE_PANEL);
}
