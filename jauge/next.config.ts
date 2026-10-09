import type { NextConfig } from "next";

// next-intl sans son plugin (qui charge @swc/core natif) : on pose directement l'alias qu'il ajoute.
const I18N_REQUEST = "./src/i18n/request.ts";

const nextConfig: NextConfig = {
  // Application entièrement dynamique (par utilisateur, derrière l'auth) : pas de Cache Components.
  serverExternalPackages: ["pg-boss"],
  turbopack: {
    resolveAlias: { "next-intl/config": I18N_REQUEST },
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
