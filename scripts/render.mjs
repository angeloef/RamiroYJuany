// Utilitario del dashboard de Render por API: `node scripts/render.mjs deploy|estado`
import 'dotenv/config';

const SERVICE = process.env.RENDER_SERVICE_ID ?? 'srv-dad0jo67bikc7395t39g';
const h = { Authorization: `Bearer ${process.env.RENDER_KEY}`, 'Content-Type': 'application/json' };
const api = async (ruta, init) => {
  const r = await fetch(`https://api.render.com/v1${ruta}`, { headers: h, ...init });
  const texto = await r.text();
  return [r.status, texto ? JSON.parse(texto) : null];
};

const [cmd = 'estado'] = process.argv.slice(2);

if (cmd === 'deploy') {
  const [s, d] = await api(`/services/${SERVICE}/deploys`, { method: 'POST', body: '{}' });
  console.log('deploy', s, d?.id ?? '', d?.status ?? '');
} else {
  const [, lista] = await api(`/services/${SERVICE}/deploys?limit=1`);
  const d = lista[0]?.deploy;
  console.log(d?.id, d?.status, d?.commit?.id?.slice(0, 7) ?? '', d?.finishedAt ?? '');
}
