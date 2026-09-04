# Ramiro & Juany · 19.09.2026

Web de la boda: portada y galería de fotos que suben los invitados desde el QR de su mesa.

## Privacidad

**No hay login.** La privacidad es por oscuridad del slug y del token:

- cualquiera con el link `/e/<slug>` puede **ver** la galería;
- para **subir** hace falta el token del QR (`?t=<token>`), que queda en una cookie httpOnly.

Un link reenviado por WhatsApp le da acceso a quien lo reciba. Alcanza para el caso de uso,
pero conviene saberlo antes de repartir los QR.

## Qué hay acá

| Carpeta | Qué es |
|---|---|
| `prototipo/` | El sitio: hero + galería 3D. Vite + Three.js. Se construye a `public/sitio/` y lo sirve la app Next en `/`. |
| `app/`, `components/` | La app Next.js: subida de fotos por QR, API y el sitio de Vite servido en `/`. |
| `db/` | Esquema Drizzle, migración y seed (evento + tokens por mesa con sus URLs de QR). |
| `design/` | Artboards del sistema de diseño. |
| `references/` | Fotos e invitación de las que salen la portada y la paleta. |

La galería 3D es el demo [codrops-depth-gallery](https://github.com/houmahani/codrops-depth-gallery)
de Houmahani Kane (MIT), copiado sin modificar en `prototipo/src/Experience/`. Lo nuestro está en
`prototipo/index.html`, `src/main.js`, `src/css/hero.css` y `src/data/mood.js`.

## Correr

```bash
npm --prefix prototipo run dev   # prototipo, puerto 5173
npm run dev                      # app Next.js, puerto 3000
```

Base de datos (hace falta `DATABASE_URL` en `.env`, **con `?sslmode=require`** — sin eso
`drizzle-kit migrate` sale con exit 0 sin aplicar nada):

```bash
npm run db:migrate
npm run db:seed
```

## Subida por QR

El QR de cada mesa apunta a `/e/<slug>/subir?t=<token>`. El token se cambia por una cookie
httpOnly y desaparece de la URL. El flujo:

1. el navegador genera las derivadas (web 2048px q0.82, thumb 400px q0.75) con `createImageBitmap`
   + canvas; si no puede decodificar el archivo sube el original tal cual y las tres keys apuntan ahí;
2. `POST /api/uploads/sign` valida mime, tamaño y cuota, y devuelve PUT firmados;
3. el celular sube directo a R2, de a 2 archivos en paralelo y con reintento exponencial —
   los bytes nunca pasan por Render;
4. `POST /api/uploads/commit` incrementa `guest_tokens.usos` (el UPDATE condicional *es* la cuota)
   e inserta la fila en `photos`.

Falta: dedup por `phash`, EXIF real (hoy usa `file.lastModified`) y retomar una subida cortada
después de recargar la página.

## QR de las mesas

```bash
npm run qr    # escribe qr-mesas.html: una tarjeta por mesa, 4 por hoja A4
```

Se abre en el navegador y se imprime sin escalar. Es un script y no una página web a
propósito: la hoja lista los 22 tokens, y cualquiera que diera con esa URL podría subir
fotos como cualquier mesa. `qr-mesas.html` está gitignoreado por lo mismo.

## Deploy

`render.yaml` define **un** servicio, `ramiro-y-juany`, en plan free por ahora. Su build corre
primero Vite (`prototipo/` → `public/sitio/`) y después Next, así que un solo dominio sirve
el sitio, la subida y la API. El servicio estático viejo quedó de más.

La base **no** está en el blueprint: Render permite una sola gratis por cuenta y se reusa la que
ya existe. `DATABASE_URL` se carga a mano igual que las de R2.

Aplicar el blueprint desde el dashboard de Render (Blueprints → New Blueprint Instance) y después
cargar a mano las variables en el servicio `boda-app`:

```
DATABASE_URL=<Internal Database URL de la base de Render>?sslmode=require
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_BUCKET=boda-fotos
R2_PUBLIC_URL=https://fotos.<dominio>
```

Al bucket hay que ponerle CORS con **`GET` y `PUT`**: `PUT` para que el celular pueda subir,
y `GET` porque la galería 3D lee las fotos con `crossOrigin="anonymous"` (three.js para la
textura, y un canvas para derivar la paleta de cada foto).

**Límites del plan free**, a resolver antes de la fiesta:

- el web service duerme a los 15 min de inactividad y el primer request tarda ~30 s;
- la base free caduca a los 30 días y hay que recrearla;
- la base es compartida con otro proyecto, así que ojo con los nombres de tabla;
- R2 free son 10 GB (alcanza), pero pide tarjeta al crear la cuenta.
