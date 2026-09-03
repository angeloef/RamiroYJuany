import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cuotaDe, mesaDeCookie } from '@/lib/token';
import { Subir } from '@/components/Subir';
import styles from './subir.module.css';

export const dynamic = 'force-dynamic';

export default async function SubirPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  if (t) redirect(`/e/${slug}/subir/entrar?t=${encodeURIComponent(t)}`);

  const mesa = await mesaDeCookie(slug);

  if (!mesa) {
    return (
      <main className={styles.main}>
        <h1 className={styles.titulo}>Escaneá el QR de tu mesa</h1>
        <p className={styles.bajada}>Para subir fotos hace falta el link del QR que está en la mesa. Pedíselo a alguien de tu mesa si no lo tenés.</p>
        <Link className={styles.galeria} href="/">Ver la galería</Link>
      </main>
    );
  }

  const cuota = cuotaDe(mesa.config);
  return (
    <main className={styles.main}>
      <span className={styles.mesa}>{mesa.label}</span>
      <h1 className={styles.titulo}>Subí tus fotos de la fiesta</h1>
      <p className={styles.bajada}>Se ven en la galería al instante. Sin app, sin cuenta.</p>
      <Subir slug={slug} usos={mesa.usos} cuota={cuota} />
      <Link className={styles.galeria} href="/">Ver la galería</Link>
    </main>
  );
}
