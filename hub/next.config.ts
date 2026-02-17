import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Garante que o Next use o hub como raiz (evita inferir o monorepo como root)
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
