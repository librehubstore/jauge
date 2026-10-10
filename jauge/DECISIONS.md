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

## V1 — Historique et alertes (spec 4.8 / 4.9)
- **Archives** : seul le FR est importé (`npm run import-history`, en flux, 3 M de points sur un an). Les archives IT (trimestrielles, > 100 Mo) et ES (une requête par jour) ne le sont pas : l'historique s'y construit au fil des ingestions.
- **Médiane de zone** : prix en vigueur chaque jour pour chaque station à moins de 10 km (dernier relevé de moins de 30 jours), un point par jour, ou par semaine sur un an.
- **Tendance** : écart entre le prix actuel et celui d'il y a 7 jours, seuil de 0,01.
- **Alertes** : prix récents seulement (< 7 j, hors quarantaine, station active). Évaluées après une ingestion qui change des prix et après un prix communautaire publié, pas sur un minuteur.
- **Graphique** : SVG maison, palette catégorielle de référence validée (bleu `--series-1`, orange `--series-2`).

## V1 — Itinéraire (spec 4.7)
- **Valhalla seul** (pas OSRM) : il gère l'évitement des péages et des autoroutes. Instance publique en développement, `VALHALLA_URL` en production.
- **Détour vers une station du trajet** : distance au tracé × 1,3 × 2 (estimé), sans appel de routage par station.
- **Coût minimal** : programmation dynamique sur des niveaux de réservoir discrétisés (50), une station retenue par tronçon de 10 km, **pénalité fixe de 0,5 € par arrêt** (sinon l'optimum enchaîne des micro-arrêts pour quelques centimes). Les quantités sont ensuite recalculées exactement pour la suite d'arrêts retenue ; le résultat n'est jamais pire que « équilibré ».
- **Économie** affichée par rapport à la stratégie naïve « moins d'arrêts », au même volume acheté.
- **Recherche autour de soi** : détour routier réel (matrice Valhalla, aller-retour = 2 × aller) pour les 25 premières stations des tris « meilleur choix » et « prix du plein » ; au-delà et en cas d'échec, estimation × 1,3 libellée « estimé ».

## V1 — Nouveaux pays (spec 4.2)
- **Points d'accès PT et AD** : non documentés publiquement ; identifiés grâce au projet open source Plein (MIT, github.com/aslafy-z/plein). Le code des connecteurs est propre à Jauge.
- **PT** : produit « especial » pris seulement si la station ne vend pas le produit simple (sauf gazole premium → `B7_PREMIUM`). Continent seul (Açores et Madère hors flux).
- **AD** : pas d'adresse ni d'horaires dans le flux ; position = centre de l'emprise de la station ; les distributeurs de fioul seuls sont exclus.
- **AT et DE** : pas d'horodatage par prix dans ces API → date de récupération. AT : la loi ne publie que les moins chères par district ; avertissement dans la liste et dans l'attribution.
- **DE** : l'API Tankerkönig ne fait que des recherches par rayon (≤ 25 km) ; seules les zones `DE_ZONES` sont couvertes, toutes les 15 min.
- **UK** : non livré (documentation inaccessible, identifiants requis).

## V1 — Langues et devises (spec 4.12)
- **7 langues** : traductions rédigées pour l'interface et les emails ; à faire relire par des locuteurs natifs avant diffusion large. Le géocodage Photon ne gère que fr/en/de/it (sinon langue par défaut).
- **Devises** : toutes les sources actuelles publient en EUR. La conversion (taux BCE, base EUR) est un affichage : « ≈ » + mention, valeurs stockées inchangées. Le graphique d'historique et la modération restent en devise d'origine.

## V1 — PWA (spec 4.8 / 10)
- **Service worker écrit à la main** plutôt que Serwist : une centaine de lignes, sans dépendance ni configuration de bundler. Enregistré en production seulement (`NEXT_PUBLIC_SW=1` pour le tester en dev).
- **Hors ligne** : réseau d'abord pour l'API de recherche et les pages Carte/Favoris, dernière réponse sinon, marquée par l'en-tête `x-jauge-offline` (date) ; cache d'abord pour les ressources versionnées et les tuiles.
- **Push** : envoyé pour les alertes de prix et les comptes à valider, en plus de la notification in-app. Désactivé si les clés VAPID manquent.

## Reste à faire
- **V1** : connecteur UK (Fuel Finder), bloqué faute d'identifiants GOV.UK One Login.
- **V2** (spec section 3) : journal de pleins, prévision « attendre ou faire le plein », connecteurs HR/SI/DK/RO (sources officielles à identifier).
