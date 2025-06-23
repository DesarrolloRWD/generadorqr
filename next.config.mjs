/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Configuración del proxy para evitar problemas de CORS
  async rewrites() {
    return [
      {
        source: '/api/save/information',
        destination: 'http://82.25.97.207:8087/save/information',
      },
    ];
  },
}

export default nextConfig
