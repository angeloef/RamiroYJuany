import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import glsl from 'vite-plugin-glsl'

export default defineConfig(({ command }) => {
  const esProduccion = command === 'build'

  return {
    // en produccion el bundle lo sirve la app Next desde /sitio/, con un rewrite
    // de "/" — por eso base absoluta: con './' los assets romperian en la raiz
    base: esProduccion ? '/sitio/' : './',
    build: { outDir: '../public/sitio', emptyOutDir: true },
    plugins: [glsl()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // el panel de debug y el contador de FPS solo existen en desarrollo
        ...(esProduccion
          ? {
              tweakpane: fileURLToPath(new URL('./src/stubs/tweakpane.js', import.meta.url)),
              'three/examples/jsm/libs/stats.module.js': fileURLToPath(
                new URL('./src/stubs/stats.js', import.meta.url),
              ),
            }
          : {}),
      },
    },
  }
})
