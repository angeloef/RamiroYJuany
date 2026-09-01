# Brief de proyecto — Web de boda con subida de fotos por QR

> Pegá este archivo (o su contenido) como primer mensaje en una sesión nueva de Claude Code.
> Contiene todo el contexto y las decisiones ya tomadas. No re-decidas lo que está en "Decisiones cerradas".

---

## 1. Qué hay que construir

Una web de un solo evento (una boda, 150 invitados) con dos funciones:

1. **Subida de fotos por los invitados.** Escanean un QR impreso en las mesas, caen en una página, sacan o eligen fotos del carrete y las suben. Sin registro, sin app, sin cuenta. Tiene que funcionar en un celular con 4G malo dentro de un salón, en menos de 10 segundos desde que escanean hasta que están subiendo.
2. **Galería interactiva** para ver esas fotos: grilla de thumbnails, lightbox, filtros, y descarga del álbum.

**Solo fotos. No hay video en ningún punto del sistema** — ni subida, ni almacenamiento, ni reproducción. Rechazar `video/*` en el input y en la validación del servidor.

## 2. Decisiones cerradas (no revisar)

| Decisión | Valor | Por qué |
|---|---|---|
| Hosting de la app | **Render.com** | Definido por el cliente/dev |
| Base de datos | **Postgres en Render** | Solo metadata |
| Almacenamiento de imágenes | **Cloudflare R2** (bucket con dominio custom) | Egress $0 vs $0,15/GB en Render; ver §4 |
| Binarios en Postgres | **Prohibido** — ni `bytea` ni large objects | Rompe backups y restores |
| Subida de archivos | **Presigned PUT directo a R2**, nunca a través del backend | Ver §5 |
| Derivadas (web + thumb) | **Generadas en el cliente** antes de subir | Elimina el worker de procesamiento |
| Disco persistente de Render | **No usar** | Impide multi-instancia y deploys sin downtime |
| Alcance de contenido | **Solo imágenes** | Sin video |

## 3. Dimensionamiento (ya calculado, usarlo como base)

Con 150 invitados y **solo fotos**:

| Escenario | Participación | Fotos | Originales | Derivadas | **Total R2** |
|---|---|---|---|---|---|
| Conservador | 45% × 8 c/u | 544 | 2,1 GB | 0,23 GB | **2,4 GB** |
| **Realista (diseñar para este)** | 65% × 14 c/u | ~1.400 | 5,4 GB | 0,59 GB | **6,0 GB** |
| Alto | 85% × 22 c/u | ~2.800 | 11,0 GB | 1,21 GB | **12,2 GB** |

Supuestos: original de celular 4 MB (HEIC iPhone 12MP 2-3 MB, JPEG Android 12-50MP 3-8 MB), derivada web 2048px q80 ≈ 400 KB, thumb 400px ≈ 40 KB.

**Provisionar 15 GB en R2.** Costo: ~US$0,23/mes.

**Base de datos: menos de 20 MB en el peor escenario.**

| Componente | 2.800 fotos |
|---|---|
| `photos` + índices (~2 KB/fila con EXIF en jsonb) | 5,5 MB |
| Invitados, reacciones, comentarios | ~2 MB |
| Log de vistas | ~9 MB |
| **Total** | **~16 MB** |

El plan de Postgres más chico sobra. **La DB no es una restricción de diseño en este proyecto** — no optimices por espacio ahí, optimizá por claridad del esquema.

**Egress de la galería** (esto sí importa): ~116 MB por persona que recorre la galería completa; con 200 visitantes son ~23 GB/mes. Por eso todo lo binario se sirve desde R2, no desde Render. La descarga del álbum completo en ZIP son 5,5 GB por descarga — si se sirviera desde Render, 30 descargas serían ~US$25.

## 4. Arquitectura

```
Celular del invitado
   │
   ├── (1) GET  /e/<slug>?t=<token>   ──► Render Web Service (app)
   │                                        └─► Postgres (metadata)
   ├── (2) POST /api/uploads/sign     ──► Render devuelve 2 presigned PUT
   │
   └── (3) PUT  original + web + thumb ──► Cloudflare R2   [directo, no pasa por Render]
   └── (4) POST /api/uploads/commit   ──► Render inserta filas en Postgres

Galería: <img src="https://fotos.<dominio>/<key>">  ──► R2 vía dominio custom + CDN
```

- **Render Web Service**: firma URLs, escribe metadata, sirve HTML/JS. Nunca toca bytes de imagen.
- **R2**: todos los binarios. Bucket privado para originales, dominio público (o Worker) para derivadas.
- El servicio de Render **no puede dormir** durante el evento — la ventana crítica son ~5 horas de un sábado a la noche. Plan pago, no free tier.

## 5. Flujo de subida (el punto crítico del proyecto)

El escenario de estrés real: **30 invitados subiendo en simultáneo durante el brindis, con 4G saturado**. Si los archivos pasan por el backend son 120 MB en RAM de una instancia de 512 MB, más timeouts de request. Por eso:

1. El cliente selecciona N fotos (permitir selección múltiple, `<input type="file" accept="image/*" multiple>` — el `capture` directo limita a una foto por vez, no usarlo por defecto).
2. **En el navegador**, por cada foto: leer con `createImageBitmap`, generar en canvas la derivada **web** (lado largo 2048px, JPEG q0.82) y el **thumb** (lado largo 400px, q0.75). Extraer EXIF (`DateTimeOriginal`, orientación) antes de descartarlo.
3. Pedir al backend las presigned PUT de las 3 keys (o 2, ver decisión abierta sobre originales).
4. **Subir en paralelo con concurrencia limitada a 2-3 archivos**, con reintento exponencial y reanudación. Subir primero thumb y web (chicos, aparecen rápido en la galería), el original en segundo plano.
5. `commit` al backend con las keys, dimensiones, hash y EXIF → inserta en Postgres.
6. **Progreso visible y estado persistido en `localStorage`**: si el invitado bloquea la pantalla o pierde señal, al volver tiene que retomar, no empezar de cero. Esto es lo que decide si la funcionalidad se usa o no.

Validación en servidor al firmar: `Content-Type` en `image/jpeg|png|webp|heic`, `Content-Length` ≤ 25 MB, cuota por token de invitado, rate limit.

## 6. Esquema de datos (punto de partida, ajustalo)

```sql
events        (id, slug, nombre, fecha, timezone, estado, config jsonb)
guest_tokens  (id, event_id, token, label, usos, creado_en, revocado_en)
photos        (id, event_id, guest_token_id, key_original, key_web, key_thumb,
               mime, bytes, width, height, phash, taken_at, uploaded_at,
               caption, exif jsonb, estado, orden)
reactions     (photo_id, guest_token_id, tipo, creado_en)   -- PK compuesta
comments      (id, photo_id, guest_token_id, texto, estado, creado_en)
view_events   (id, photo_id, dia, cantidad)                 -- agregado por día, no fila por vista
```

- `photos.estado`: `pendiente | publicada | oculta | eliminada`. **Nunca borrar filas** — la moderación es soft delete.
- `phash` (perceptual hash) para detectar duplicados: en una boda la misma foto grupal la suben 5 personas distintas. Agrupar visualmente, no rechazar la subida.
- Índices: `(event_id, estado, taken_at DESC)` para el feed, `(event_id, phash)` para dedup, `(guest_token_id)` para cuotas.
- `view_events` agregado por día: nunca una fila por impresión de thumbnail.

## 7. Galería

- Grilla de thumbnails con **scroll infinito y virtualización** (no cargar 1.400 nodos de golpe), `loading="lazy"`, aspect-ratio reservado desde `width`/`height` en la DB para que no salte el layout.
- Lightbox con swipe en mobile, teclado en desktop, precarga de la siguiente y anterior.
- Orden por `taken_at` con fallback a `uploaded_at` (muchos celulares vienen con la hora mal).
- Filtros: por momento del día, por quien subió (si se etiqueta), y "más reaccionadas".
- Reacciones y comentarios opcionales, con el mismo token de invitado.
- **Descarga**: individual siempre; álbum completo en ZIP generado bajo demanda **en R2 vía Worker o pre-armado como objeto**, nunca streameado desde Render.
- Vista de moderación para los novios: aprobar/ocultar, con link secreto separado.

## 8. Acceso y QR

- Un QR por mesa o uno solo genérico, apuntando a `https://<dominio>/e/<slug>?t=<token>`.
- El token identifica a la mesa/grupo, no a la persona. Se guarda en cookie al primer ingreso.
- Sin login. La privacidad es por oscuridad del slug + token; sirve para el caso de uso, pero **decilo explícitamente en el README** para que el cliente lo sepa.
- La galería puede quedar abierta a cualquiera con el link, o requerir token: decisión del cliente (ver §10).

## 9. Requisitos no funcionales

- **Mobile first en serio**: el 95% del tráfico es un celular en un salón oscuro. Contraste alto, targets grandes, todo funcionando con una mano.
- Funciona en Safari iOS (HEIC → el canvas de Safari decodifica HEIC; verificar el fallback en Android/Chrome que no lo hace y necesita conversión o subir el original tal cual).
- Sin dependencia de que el invitado instale nada.
- Idioma: español rioplatense.
- El sitio tiene que sobrevivir a que el 100% del tráfico ocurra en 5 horas y después baje a casi cero.

## 10. Decisiones abiertas — preguntá antes de codear

1. **Stack.** Sugerencia: Next.js (App Router) como único Web Service en Render, Postgres con Drizzle o Prisma, SDK S3 para R2. Confirmar antes de arrancar.
2. **¿Se guarda el original?** Guardarlo son 5,4 GB y permite entregar el álbum en calidad completa; no guardarlo baja a 0,6 GB. Recomendación: guardarlo (el costo es US$0,08/mes) y ofrecer el ZIP de originales a los novios.
3. **¿La galería es pública o requiere token?**
4. **¿Moderación previa o posterior?** Recomendación: posterior (las fotos aparecen al instante, los novios ocultan lo que no quieran) — la moderación previa mata la dinámica de la fiesta.
5. **Retención**: cuánto tiempo queda online y qué pasa después (¿entrega del ZIP y baja del bucket?).
6. **¿Multi-evento o un solo evento?** El esquema ya está hecho multi-evento; confirmar si se va a reutilizar para otras bodas, porque cambia el trabajo de administración.

## 11. Orden de trabajo sugerido

1. Esquema + migraciones + seed de un evento de prueba.
2. Endpoint de firma + `commit` con validación y cuotas.
3. Página de subida con generación de derivadas en cliente, cola con reintentos y estado persistido. **Probarla con throttling de red a 3G lento y 30 archivos** — este es el entregable que decide el proyecto.
4. Galería: grilla virtualizada + lightbox.
5. Reacciones, comentarios, dedup por phash.
6. Panel de moderación y descarga del álbum.
7. Generación del QR y hoja imprimible para las mesas.

## 12. Errores a no cometer

- Subir los archivos a través del backend de Render.
- Guardar imágenes en Postgres o en un disco persistente de Render.
- Servir thumbnails desde el Web Service en lugar de R2.
- Una fila en la DB por cada impresión de thumbnail.
- Asumir que la conexión del salón funciona: sin reintentos y sin estado persistido, la mitad de las subidas se pierden.
- Cargar los 1.400 nodos de la grilla sin virtualizar.
- Borrado duro de fotos.

---

## 13. Decisiones cerradas en sesión (2026-09-01)

§10 resuelto: Next.js App Router + Drizzle + `@aws-sdk/client-s3` contra R2 · originales
se guardan · galería pública con link secreto · moderación posterior · retención
indefinida · un solo evento, esquema multi-evento igual.

### 13.1 Token: lectura libre, escritura con token

Galería pública no elimina el token. Queda partido en dos:

| Ruta | Token |
|---|---|
| `/e/<slug>` — galería, lightbox, descarga individual | no |
| `/e/<slug>/subir` + `POST /api/uploads/sign` + `/commit` | **sí** |

- El token llega por `?t=<token>` (el QR apunta ahí), se guarda en cookie httpOnly
  al primer ingreso y de ahí en más no vuelve a aparecer en la URL.
- `sign` y `commit` leen la cookie, no el query. Sin cookie válida → 401.
- Sigue siendo la unidad de cuota y de rate limit, y lo que llena
  `photos.guest_token_id`. Nada de esto cambia por que la galería sea pública.
- Quien entra a `/e/<slug>/subir` sin token ve "pedí el link del QR de tu mesa",
  no un formulario roto.

### 13.2 HEIC: feature-detect del decode, sin caso especial por formato

No se detecta HEIC. Se detecta si el navegador **puede decodificar el archivo**,
que es la condición real y cubre también JPEG raros y archivos corruptos.

```
try { bitmap = await createImageBitmap(file) }  → derivadas normales (web 2048 + thumb 400)
catch                                          → sin derivadas
```

En la rama sin derivadas: se sube el original tal cual, y `key_web` = `key_thumb`
= `key_original`. La galería no necesita saberlo — sirve lo que diga la fila.

- Costo: esa foto pesa 4 MB en la grilla. Con HEIC en Android siendo casi
  inexistente, es un puñado de fotos sobre 1.400.
- `photos` lleva `derivadas boolean` para poder listarlas después y regenerarlas
  en batch si alguna vez molesta. `// ponytail:` no se escribe el worker ahora.
- El servidor acepta `image/heic` y `image/heif` en la validación de `sign`.
