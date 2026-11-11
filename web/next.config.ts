import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// API Express (voir ../src). En dev, Next tourne sur :3001 et relaie /api vers Express.
const API_URL = process.env.API_URL || "http://localhost:3000";

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      images: { unoptimized: true },
      async rewrites() {
        return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
      },
    };
  }

  // En production : site statique dans web/out, servi par Express avec l'API (un seul serveur)
  return {
    output: "export",
    images: { unoptimized: true },
    productionBrowserSourceMaps: false,
  };
}
