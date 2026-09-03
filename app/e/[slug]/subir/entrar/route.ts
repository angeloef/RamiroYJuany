import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COOKIE, mesaDe } from '@/lib/token';

// El QR trae ?t=<token>. Lo cambiamos por una cookie httpOnly y sacamos el token de la URL.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const token = new URL(req.url).searchParams.get('t') ?? undefined;

  if (await mesaDe(slug, token)) {
    (await cookies()).set(COOKIE, token!, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: 60 * 60 * 24 * 30,
    });
  }
  redirect(`/e/${slug}/subir`);
}
