# Jauge

Comparateur interne des prix des carburants en Europe : carte, coût réel du plein (détour inclus), favoris, véhicules, ruptures signalées. Spécification : `../gasoil-now-prompt.md`. Choix d'implémentation : `DECISIONS.md`.

## Démarrage (développement)

```bash
cp .env.example .env          # puis renseigner BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d db       # PostgreSQL 16 + PostGIS sur le port 5433
npm install
npm run ingest                # migrations + admin initial + ingestion FR/ES/IT (~1 min 30)
npx tsx scripts/osm-once.mts  # enseignes FR depuis OpenStreetMap (~1 min)
npm run dev                   # http://localhost:3000
npm run worker                # optionnel : ingestions planifiées (pg-boss)
```

Sans `BREVO_API_KEY`, les emails (vérification, réinitialisation) sont écrits dans la console du serveur.

## Production (Docker Compose)

```bash
docker compose --profile full up -d --build
```

Trois services : `db`, `worker` (migrations, admin initial, ingestions planifiées) et `app`. Au tout premier démarrage, l'app peut répondre avant la fin des migrations faites par le worker : attendre que le worker affiche `[worker] prêt`.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL avec PostGIS |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sessions (secret de 32 caractères minimum) et URL publique |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Premier administrateur, créé une seule fois |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Connexion Google (bouton masqué si absent) |
| `BREVO_API_KEY`, `MAIL_FROM` | Emails transactionnels (compte Brevo librehub) |
| `PHOTON_URL`, `NEXT_PUBLIC_MAP_STYLE`, `VALHALLA_URL` | Géocodage, fond de carte et routage auto-hébergés (facultatif) |
| `HISTORY_DAYS` | Fenêtre d'import de l'historique FR (365 par défaut, `npm run import-history`) |

URI de redirection Google à déclarer : `${BETTER_AUTH_URL}/api/auth/callback/google`.

## Tests

```bash
docker compose exec db psql -U jauge -c "CREATE DATABASE jauge_test"   # une fois
npm test
```

22 tests : connecteurs FR/ES/IT sur fixtures réelles, calculs de coût et classement, fuseaux horaires, argon2id, domaines autorisés, ingestion idempotente sur une vraie base.

## Sources de données

| Pays | Source | Fréquence | Licence |
|---|---|---|---|
| FR | prix-carburants.gouv.fr (flux instantané avec ruptures) | 10 min | Licence Ouverte 2.0 |
| ES | MITECO — API EstacionesTerrestres | 30 min | Réutilisation libre |
| IT | MIMIT — CSV quotidien | quotidien | IODL 2.0 |
| FR (enseignes) | OpenStreetMap via Overpass | hebdomadaire | ODbL |
