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
| `prototipo/` | La página que se ve hoy: hero + galería 3D. Vite + Three.js. Es lo que se despliega. |
| `app/`, `components/` | La app Next.js (hero portado a React). Todavía sin la galería ni las subidas. |
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

Base de datos (hace falta `DATABASE_URL` en `.env`):

```bash
npm run db:migrate
npm run db:seed
```

## Deploy

`render.yaml` publica `prototipo/` como sitio estático en Render, con autodeploy en cada push a
`main`. La app Next.js y su base todavía no están desplegadas.
