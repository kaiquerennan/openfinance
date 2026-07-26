import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir o dev server pelo IP da rede local (ex.: celular).
  allowedDevOrigins: ["192.168.15.14", "192.168.*.*", "10.*.*.*", "172.*.*.*"],

  // Proxeia a API NestJS pela mesma origem — o celular só precisa alcançar a
  // porta 3335; o Next repassa para o backend local.
  async rewrites() {
    const api = process.env.BACKEND_URL ?? "http://localhost:3334";
    return [{ source: "/api/backend/:path*", destination: `${api}/:path*` }];
  },
};

export default nextConfig;
