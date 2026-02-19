import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Garante que o Next use o hub como raiz (evita inferir o monorepo como root)
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Se o hub for servido em um subpath (ex.: https://dominio.com/hub), descomente e use o mesmo path:
  // basePath: "/hub",
  // Se os assets (_next/static) forem servidos de outro domínio/CDN:
  // assetPrefix: "https://cdn.seudominio.com",
  // Se usar next/image com URLs externas (ex.: CDN de logos), adicione:
  // images: { remotePatterns: [{ protocol: 'https', hostname: 'seu-cdn.com', pathname: '/**' }] },
};

export default nextConfig;
