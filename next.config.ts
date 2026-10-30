import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cover-photo uploads go through a server action (max file 8 MB + multipart overhead).
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
  // Private barrel pages must never sit in a shared/browser cache after logout.
  async headers() {
    return [
      { source: "/wine/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/activar", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;
