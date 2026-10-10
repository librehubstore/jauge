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

### Phase 2 — Historique et tendances (spec 4.9) ✅
- [x] API `/api/stations/[id]/history` (7 j, 30 j, 1 an) + médiane de zone 10 km (quotidienne, hebdomadaire sur 1 an)
- [x] Graphique SVG maison sur la fiche station : escalier, légende, réticule + infobulle, vue tableau ; palette validée (bleu/orange)
- [x] Tendance 7 jours par carburant sur la fiche (seuil 0,01 €)
- [x] Import FR en flux (`npm run import-history`, fenêtre `HISTORY_DAYS` = 365) : 3 070 232 points
- [x] Vérifié dans le navigateur ; API 1 an servie en ~0,7 s
- ⚠️ Archives IT (trimestrielles, > 100 Mo) et ES (1 requête par jour) non importées : l'historique s'y construit au fil des ingestions

### Phase 3 — Alertes de prix (spec 4.8) ✅
- [x] Alertes station (depuis la fiche, seuil proposé = prix − 0,02), favoris, zone (adresse + rayon) ; page `/alerts` : suspendre, supprimer
- [x] Évaluation après chaque ingestion qui modifie des prix et après chaque prix communautaire publié : 1 fois / 24 h, réarmement au-dessus du seuil
- [x] Canaux : notification in-app (lien vers la station), email Brevo si « alertes par email » est coché dans les réglages
- [x] Tests : règle pure + critère spec (1,80 → 1,69 puis 3 ingestions à 1,69 = 1 notification) → 34 tests
- ⏳ Web Push : reporté en phase 7 (PWA)

### Phase 4 — Itinéraire et plan carburant (spec 4.7) ✅
- [x] Routage Valhalla (instance publique FOSSGIS, `VALHALLA_URL` pour l'auto-hébergement) : éviter péages / autoroutes, jusqu'à 3 étapes
- [x] Corridor PostGIS 1–20 km autour du tracé (prix < 7 j, hors ruptures), position le long de la route, détour estimé
- [x] Stratégies : coût minimal (programmation dynamique + pénalité de 0,5 € par arrêt + quantités exactes), équilibré (≤ 2 arrêts, énumération), moins d'arrêts
- [x] Page `/route` : carte avec tracé, arrêts (litres, coût, détour), économie vs « moins d'arrêts », Google Maps (trajet complet ou par arrêt), lien partageable
- [x] Détour routier réel (matrice Valhalla, aller-retour, km + minutes) pour les 25 premières stations du « meilleur choix » ; repli sur l'estimation si indisponible (~1 s par recherche)
- [x] Tests : FR → ES (arrêt côté ES), achat minimal côté FR, contraintes de réserve et de capacité → 39 tests
- Mesure réelle Toulouse → Barcelone : 398 km, 439 stations candidates, 2 arrêts, 38,88 € contre 45,51 € (−6,65 €)

### Phase 5 — Nouveaux pays (spec 4.2) ✅ (sauf UK)
- [x] PT : API DGEG `PesquisarPostos` par district (18) — 3 098 stations, toutes les 2 h
- [x] AD : couche ArcGIS du Govern d'Andorra — 54 stations, toutes les 2 h
- [x] AT : API E-Control par district (117 × 3 carburants) — 918 stations, horaire ; avertissement « couverture partielle » dans la liste
- [x] DE : Tankerkönig sur les zones `DE_ZONES` (rayon 25 km) ; source désactivée sans `TANKERKOENIG_API_KEY`
- ⚠️ DE non testé en conditions réelles (pas de clé) : parseur testé sur une fixture conforme à la documentation
- ⚠️ UK bloqué : portail développeur Fuel Finder inaccessible (403) et identifiants OAuth2 via GOV.UK One Login nécessaires — à reprendre avec un compte
- [x] Tests : 4 parseurs (fixtures réelles PT/AD/AT, fixture documentée DE) → 43 tests

### Phase 6 — Langues et devises (spec 4.12) 🔄
- [ ] Traductions ES, IT, PT, DE, NL (interface + emails)
- [ ] Taux BCE quotidiens, préférence « convertir en », mention « converti »

### Phase 7 — PWA, push, partage ⏳
- [ ] Service worker : dernière zone + favoris hors ligne, bandeau « hors ligne, données du … »
- [ ] Web Push (VAPID) pour les alertes
- [ ] Lien partageable : la vue (zone, carburant, filtres, itinéraire) dans l'URL

## Journal
- 2026-10-10 — MVP commité. Plan V1 rédigé.
- 2026-10-10 — Phase 1 terminée (28 tests). Overpass renvoie parfois 504 : le réessai suffit, l'import est hebdomadaire.
- 2026-10-10 — Phase 2 codée, tests OK (30). Import d'archive FR lancé en arrière-plan ; graphique à valider visuellement.
- 2026-10-10 — Phase 2 validée visuellement. Début phase 3.
- 2026-10-10 — Phase 3 terminée (34 tests). Début phase 4 (itinéraire).
- 2026-10-10 — Phase 4 terminée (39 tests). Début phase 5 (nouveaux pays).
- 2026-10-10 — Phase 5 terminée hors UK (bloqué, identifiants requis). Début phase 6.
