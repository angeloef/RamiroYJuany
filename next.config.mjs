/** @type {import('next').NextConfig} */
export default {
  // el sitio (hero + galeria 3D) lo construye Vite y sale de public/sitio;
  // Next solo pone la subida por QR y la API
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/sitio/index.html' }],
      afterFiles: [],
      fallback: [],
    };
  },
};
