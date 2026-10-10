import type { NextConfig } from "next";

// next-intl sans son plugin (qui charge @swc/core natif) : on pose directement l'alias qu'il ajoute.
const I18N_REQUEST = "./src/i18n/request.ts";

const nextConfig: NextConfig = {
  // Application entièrement dynamique (par utilisateur, derrière l'auth) : pas de Cache Components.
  // Image Docker légère : serveur autonome avec seulement les dépendances utilisées (voir Dockerfile).
  output: "standalone",
  serverExternalPackages: ["pg-boss", "web-push"],
  async headers() {
    // Production seulement : en dev, nosniff casse les mises à jour à chaud et provoque des rechargements en boucle.
    if (process.env.NODE_ENV !== "production") return [];
    return [
      { source: "/(.*)", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
