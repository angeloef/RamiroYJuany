import type { Metadata } from 'next';
import { esAdmin } from '@/lib/admin';
import Login from '@/components/panel/Login';
import Panel from '@/components/panel/Panel';

export const metadata: Metadata = { title: 'Panel · Ramiro & Juany', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PaginaPanel() {
  return (await esAdmin()) ? <Panel /> : <Login />;
}
