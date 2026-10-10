import type { NextConfig } from "next";

// next-intl sans son plugin (qui charge @swc/core natif) : on pose directement l'alias qu'il ajoute.
const I18N_REQUEST = "./src/i18n/request.ts";

const nextConfig: NextConfig = {
  // Application entièrement dynamique (par utilisateur, derrière l'auth) : pas de Cache Components.
  serverExternalPackages: ["pg-boss", "web-push"],
  async headers() {
    return [
      { source: "/(.*)", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ] },
      // Le service worker doit toujours être revalidé pour que les mises à jour arrivent.
      { source: "/sw.js", headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      ] },
    ];
  },
  turbopack: {
    resolveAlias: { "next-intl/config": I18N_REQUEST },
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
