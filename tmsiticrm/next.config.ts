import type { NextConfig } from "next";

// Brauzer API so'rovlarini saytning o'ziga (/crm-api/...) yuboradi, Next.js esa
// ularni ichki backend'ga uzatadi — server portlari/nginx'ga bog'liq emas.
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000";

const nextConfig: NextConfig = {
  // "/employees/" kabi oxiridagi "/" saqlanishi shart: aks holda Next uni olib tashlaydi,
  // FastAPI esa ichki manzilga (http://backend:8000/...) redirect qiladi — brauzer yetolmaydi.
  skipTrailingSlashRedirect: true,
  experimental: {
    proxyTimeout: 120_000, // og'ir hisobotlar (Excel/PDF) uchun
  },
  async rewrites() {
    return [
      { source: "/crm-api/:path*/", destination: `${BACKEND_INTERNAL_URL}/:path*/` },
      { source: "/crm-api/:path*", destination: `${BACKEND_INTERNAL_URL}/:path*` },
    ];
  },
};

export default nextConfig;
