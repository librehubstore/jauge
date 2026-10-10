# Étape de build : dépendances complètes, build Next (sortie standalone) et worker/scripts empaquetés par esbuild.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx next build \
 && npx esbuild src/worker.ts scripts/*.mts --bundle --platform=node --target=node24 --format=esm \
      --outdir=dist --out-extension:.js=.mjs \
      "--banner:js=import{createRequire as __cr}from'module';const require=__cr(import.meta.url);"

# Image finale : une seule pour l'app web et le worker (commande différente dans docker-compose).
# Sans node_modules complet ni cache de build : seulement ce que Next a tracé pour le serveur.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "server.js"]
