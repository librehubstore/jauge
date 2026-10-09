# Décisions d'implémentation (MVP)

Hypothèses retenues quand la spécification (`../gasoil-now-prompt.md`) laissait un choix ouvert ou bloquait sur une contrainte technique.

## Stack
- **Next.js 16 sans Cache Components** : le gabarit les active par défaut. L'app est entièrement dynamique (par utilisateur, derrière l'authentification), le cache de composants n'apportait que des contraintes (`<Suspense>` obligatoires).
- **next-intl sans son plugin** : le plugin charge `@swc/core` natif, refusé sur ce poste (ACL du dossier de cache `AppData\Local\swc`). Le plugin ne faisait que poser l'alias `next-intl/config`, désormais déclaré directement dans `next.config.ts` (`turbopack.resolveAlias`).
- **Langue sans préfixe d'URL** : cookie `NEXT_LOCALE`, sinon `Accept-Language`, sinon `fr`. La langue est enregistrée sur le compte (emails dans la langue de l'utilisateur).
- **MapLibre GL 5** et non 6 : le worker ESM séparé de la v6 demande une configuration de bundler spécifique. La v5 embarque son worker. À noter : un onglet en arrière-plan gèle `requestAnimationFrame`, et la carte ne s'y dessine pas (comportement normal du navigateur).
- **Pas de shadcn/ui** : quelques utilitaires Tailwind (`btn-*`, `input`, `card`) suffisent pour le MVP.
- **Emails en HTML simple**, sans React Email : trois gabarits courts, traduits via `messages/*.json` (clé `email`). Sans `BREVO_API_KEY`, les emails sont écrits dans la console (développement).
- **pg-boss** dans un processus `worker` séparé. Le bouton admin « Exécuter maintenant » lance le connecteur dans le processus web après la réponse (`after()`), sans passer par la file.
- **Type PostGIS personnalisé** `geometry(Point, 4326)` : drizzle-kit ignore le SRID du type `geometry` natif.

## Authentification (spec 4.1)
- **Argon2id natif de Node 24** (`crypto.argon2`), sans dépendance.
- **Mots de passe compromis** : courte liste locale et refus des caractères répétés (`ponytail:` dans `src/lib/password.ts`). L'API k-anonymat Have I Been Pwned est à brancher si besoin.
- **Domaines autorisés** vérifiés à deux endroits : avant `/sign-up/email`, pour un refus explicite (Better Auth renvoie sinon un faux succès anti-énumération), et à la création d'utilisateur, ce qui couvre Google.
- **Lien de vérification réutilisé** : les jetons Better Auth sont sans état. Un hook redirige vers `/verify?error=LINK_USED` si l'adresse est déjà vérifiée.
- **Verrouillage après 10 échecs** : approché par la limitation de débit Better Auth (10 tentatives / 15 min par IP sur `/sign-in/email`). Ce n'est pas un verrou par compte.
- **Rôles et statuts** gérés dans nos propres colonnes (`user.role`, `user.status`), sans le plugin admin de Better Auth. La désactivation supprime les sessions.
- **Session refusée** pour `pending_approval` et `disabled` (hook `session.create.before`).

## Données (spec 4.2)
- **Horodatage ES** : l'API MITECO ne donne qu'une date d'extraction globale, utilisée pour tous les prix.
- **Prix IT** : prix libre-service préféré au prix servi. Les dénominations commerciales premium sont regroupées en `B7_PREMIUM` / `E5_98`, les HVO en `XTL`.
- **Horaires ES** : seuls les formats simples (`L-D: HH:MM-HH:MM`, `L-D: 24H`) sont interprétés.
- **Coordonnées invalides** (hors plage ou 0,0) ignorées à l'ingestion.
- **Prix aberrants** : médiane calculée sur le jeu entrant (par carburant) ; hors de [0,3× ; 3×], prix mis en quarantaine.
- **Fuseau horaire** : un par pays, les DOM et les Canaries héritent du fuseau métropolitain (`ponytail:` dans `src/lib/hours.ts`).
- **Enseignes FR** : rapprochement OSM exact via `ref:FR:prix-carburants` (≈ 98 %), puis par proximité de 50 m. Résultat mesuré : 94 % des stations FR ont une enseigne.

## Recherche et coûts (spec 4.3 / 4.5)
- **Détour** estimé sans service de routage : vol d'oiseau × 1,3, aller-retour, toujours libellé « estimé ». OSRM/Valhalla (V1, itinéraires) le remplaceront.
- **Couleurs de prix et médiane** calculées sur les prix de moins de 7 jours : MIMIT et prix-carburants datent un prix de son **dernier changement**, et un prix inchangé depuis 3 jours reste valable. La mention « ancien » (plus de 48 h) reste affichée.
- **Géocodage** : instance publique Photon (komoot) en développement, `PHOTON_URL` pour un serveur auto-hébergé.
- **Fond de carte** : OpenFreeMap (positron), `NEXT_PUBLIC_MAP_STYLE` pour changer.
- **Position** : jamais envoyée ailleurs qu'à `/api/stations` et jamais stockée. La dernière zone est mémorisée en `localStorage`, côté navigateur uniquement.

## V1 — Contributions (spec 4.10)
- **Réputation** : +1 pour toute contribution publiée (automatiquement ou par un modérateur), −3 par rejet.
- **Prix communautaire** : il remplace le prix courant seulement si le prix officiel a plus de 24 h ; sinon il est conservé dans les contributions sans changer l'affichage. Il crée un point d'historique.
- **Fermeture, enseigne, horaires, station manquante** : toujours en modération. Les horaires sont une note libre (pas d'éditeur structuré).
- **Pays sans open data** (BE, LU, MC) : stations importées d'OpenStreetMap chaque semaine ; la source n'écrase ni un statut ni une enseigne validés par la modération.
- **Station manquante** : créée dans la source `community` après validation, position issue du géocodage de l'adresse.

## Hors MVP (prévu en V1/V2, voir spec section 3)
Itinéraire et plan carburant, alertes de prix, historique graphique, saisie de prix communautaire et file de modération, connecteurs PT/AD/DE/UK/AT, langues ES/IT/PT/DE/NL, conversion de devises, PWA hors ligne et Web Push, journal de pleins.
