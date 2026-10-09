# Suivi d'implémentation — Jauge

Légende : ✅ fait · 🔄 en cours · ⏳ à faire · ⚠️ bloqué / à valider

## MVP — ✅ terminé (commit `ac884a6`)
Auth (email + Google, vérification Brevo, domaines, validation admin), connecteurs FR/ES/IT, enseignes OSM, carte + liste, meilleur choix avec détour, fiche station, favoris, véhicules, ruptures, admin, i18n FR/EN. 22 tests.

## V1 — plan

Ordre retenu : d'abord ce qui s'appuie sur les données déjà là (contributions, historique, alertes), puis le routage, puis l'extension géographique et linguistique, puis la PWA.

### Phase 1 — Contributions et modération (spec 4.10) ✅
- [x] Saisie d'un prix constaté (fiche station) ; jamais à la place d'un prix officiel < 24 h, mention « communauté »
- [x] Modération automatique : écart > 15 % de la médiane locale (10 km, < 7 j) ou réputation < −5 → `pending`
- [x] Signalements : rupture, fermeture, changement d'enseigne, horaires/services (note libre), station manquante (adresse géocodée)
- [x] File de modération `/moderation` (modérateur, admin) : contexte prix, valider/rejeter avec motif, réputation +1/−3, notification, audit
- [x] BE (3 027), LU (251), MC (3) : stations OSM (hebdomadaire), prix communautaires ; statut et enseigne modérés jamais écrasés par la source
- [x] Tests : 6 nouveaux (décision, 1,20 € invisible avant validation, priorité officielle, rejet, fermeture)
- ⚠️ Horaires : note libre lue par le modérateur, pas d'éditeur structuré (voir DECISIONS.md)

### Phase 2 — Historique et tendances (spec 4.9) ⏳
- [ ] API historique par station/carburant (7 j, 30 j, 1 an) + médiane de zone
- [ ] Graphique sur la fiche station (SVG maison, sans librairie)
- [ ] Indicateur de tendance 7 jours (hausse / stable / baisse)
- [ ] Import initial des archives (FR annuel, IT trimestriel, ES par jour), fenêtre 1 an configurable

### Phase 3 — Alertes de prix (spec 4.8) ⏳
- [ ] CRUD alertes : station, favoris, zone ; carburant ; seuil
- [ ] Déclenchement à l'ingestion : une fois par 24 h, réarmement au-dessus du seuil
- [ ] Canaux : in-app, email Brevo (option), Web Push (phase 7)
- [ ] Test : 1,80 → 1,69 (seuil 1,70) puis 3 ingestions à 1,69 = 1 seule notification

### Phase 4 — Itinéraire et plan carburant (spec 4.7) ⏳
- [ ] Service de routage (OSRM, Valhalla pour éviter péages/autoroutes) derrière une interface
- [ ] Stations dans un corridor de 1–20 km autour du tracé (PostGIS)
- [ ] Stratégies : moins d'arrêts, coût minimal, équilibré (≤ 2 arrêts)
- [ ] Page Itinéraire : départ, arrivée, ≤ 3 étapes, véhicule, niveau, réserve ; liste des arrêts, coût total, économie
- [ ] Détour routier réel dans le « meilleur choix » (remplace l'estimation × 1,3 quand dispo)
- [ ] Test : trajet FR → ES fictif, l'arrêt « coût minimal » est côté ES

### Phase 5 — Nouveaux pays (spec 4.2) ⏳
- [ ] PT (DGEG) — API à identifier
- [ ] AD (gouvernement d'Andorre)
- [ ] DE (Tankerkönig, clé `TANKERKOENIG_API_KEY`)
- [ ] UK (Fuel Finder, OAuth2, GBP)
- [ ] AT (E-Control, couverture partielle signalée)
- [ ] Fixtures + tests par connecteur ; connecteur désactivé si clé absente

### Phase 6 — Langues et devises (spec 4.12) ⏳
- [ ] Traductions ES, IT, PT, DE, NL (interface + emails)
- [ ] Taux BCE quotidiens, préférence « convertir en », mention « converti »

### Phase 7 — PWA, push, partage ⏳
- [ ] Service worker : dernière zone + favoris hors ligne, bandeau « hors ligne, données du … »
- [ ] Web Push (VAPID) pour les alertes
- [ ] Lien partageable : la vue (zone, carburant, filtres, itinéraire) dans l'URL

## Journal
- 2026-10-10 — MVP commité. Plan V1 rédigé.
- 2026-10-10 — Phase 1 terminée (28 tests). Overpass renvoie parfois 504 : le réessai suffit, l'import est hebdomadaire.
