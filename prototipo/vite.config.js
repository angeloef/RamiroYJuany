import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  base: './',
  plugins: [glsl()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
