'use server';

import { redirect } from 'next/navigation';
import { abrirSesion, cerrarSesion, credencialesOk } from '@/lib/admin';

export async function entrar(_prev: { error: string; usuario: string } | null, form: FormData) {
  const usuario = String(form.get('usuario') ?? '');
  if (!credencialesOk(usuario, String(form.get('clave') ?? ''))) {
    // ponytail: freno minimo contra fuerza bruta; rate limit real si el panel se hace publico
    await new Promise((r) => setTimeout(r, 800));
    // React resetea el form despues de la accion: devolvemos el usuario para no hacerlo tipear de nuevo
    return { error: 'Usuario o clave incorrectos', usuario };
  }
  await abrirSesion();
  redirect('/panel');
}

export async function salir() {
  await cerrarSesion();
  redirect('/panel');
}
