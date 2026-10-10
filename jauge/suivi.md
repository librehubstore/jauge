1971# Suivi d'implémentation — Jauge

Légende : ✅ fait · 🔄 en cours · ⏳ à faire · ⚠️ bloqué / à valider

## MVP — ✅ terminé (commit `ac884a6`)
Auth (email + Google, vérification Brevo, domaines, validation admin), connecteurs FR/ES/IT, enseignes OSM, carte + liste, meilleur choix avec détour, fiche station, favoris, véhicules, ruptures, admin, i18n FR/EN. 22 tests.

## V1 — ✅ terminée (sauf UK)

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

### Phase 6 — Langues et devises (spec 4.12) ✅
- [x] Interface et emails en 7 langues : FR, EN, ES, IT, PT, DE, NL (381 chaînes chacune)
- [x] Test de parité : mêmes clés et mêmes variables ICU dans toutes les langues
- [x] Taux BCE quotidiens (worker, jours ouvrés 15 h 30 UTC), préférence « Convertir les prix en » (12 devises), prix convertis préfixés « ≈ » et mention « converti au taux BCE du jour »
- [x] Vérifié dans le navigateur (allemand + GBP) → 51 tests
- ⚠️ Graphique d'historique et page de modération restent dans la devise d'origine

### Phase 7 — PWA, push, partage ✅
- [x] Service worker écrit à la main (`public/sw.js`) : dernière recherche, pages Carte et Favoris, ressources Next et tuiles de carte (≤ 1 500) disponibles hors ligne
- [x] Bandeau « Hors ligne, données du … » sur la carte, bandeau général quand le navigateur est hors ligne
- [x] Web Push (VAPID, `web-push`) : abonnement par appareil dans Réglages, envoi traduit pour les alertes de prix et les comptes à valider, abonnements expirés supprimés
- [x] Lien partageable de la carte (zone, carburant, rayon, tri, filtres dans l'URL) ; itinéraires déjà partageables
- [x] Vérifié en production locale : service worker actif, données servies serveur arrêté, bandeau affiché ; 51 tests
- ⚠️ Push non vérifié de bout en bout (demande d'autorisation du navigateur impossible à accepter en automatique)

## Refonte mobile et correctifs — ✅ (commit `a1b7ed9`)
- [x] Bug : rechargements en boucle en dev (en-tête `nosniff` cassait les mises à jour à chaud) → liste de suggestions de l'itinéraire impossible à cliquer. En-têtes de sécurité désormais en production seulement
- [x] Barre d'onglets en bas (Carte, Itinéraire, Favoris, Alertes, Plus), carte plein écran, recherche flottante, panneau coulissant à 3 hauteurs, réglages en pastilles
- [x] Cibles tactiles ≥ 44 px, champs en 16 px (pas de zoom iOS), texte secondaire plus contrasté (lecture en plein soleil)
- [x] Saisie d'adresse : suggestions pendant la frappe, liste refermée au choix, lieu choisi affiché dans le champ
- [x] Itinéraire repliable après calcul, carte affichée seulement avec un résultat ; fiche station avec « Y aller » fixé en bas
- [x] `PRODUCT.md` : cadrage design (conducteurs en mobilité, utilitaire et rapide)

## V2 — plan

### Phase 8 — Journal de pleins (spec 4.13) ✅
- [x] Page `/log` (menu « Plus ») : saisie véhicule, date, quantité, montant, kilométrage, plein complet ou partiel, note ; suppression
- [x] « J'ai fait le plein ici » depuis la fiche station : station préremplie, montant calculé à partir du prix affiché
- [x] Consommation réelle plein à plein (pleins partiels cumulés, kilométrage incohérent ignoré), coût aux 100 km, prix moyen payé, dépenses par mois
- [x] Proposition de remplacer la consommation déclarée du véhicule par la valeur mesurée (écart > 5 %)
- [x] Export CSV (séparateur « ; », BOM Excel, formules neutralisées)
- [x] Vérifié sur mobile (2 pleins → 6 L/100 km) ; 55 tests

### Phase 9 — Prévision « attendre ou faire le plein » (spec 4.9) ✅
- [x] Profil hebdomadaire sur 12 semaines (écart de chaque jour à la moyenne de sa semaine), tendance sur 14 jours, horizon 3 jours, seuil de 0,01 €/L
- [x] Confiance : nombre de semaines complètes et régularité du jour conseillé (parmi les semaines où le prix a bougé)
- [x] Repli sur la médiane de la zone (10 km) si la station n'a pas assez d'historique
- [x] Fiche station : « Faites le plein maintenant » ou « Si vous pouvez, attendez lundi : environ 0,033 € de moins par litre », base et confiance affichées
- [x] Données réelles FR : cycle du lundi retrouvé (−0,02 €/L), calcul en 15–100 ms ; tests sur séries synthétiques → 58 tests

### Phase 10 — Nouveaux pays : HR, SI, DK, RO (spec 4.2) ✅
- [x] SI : API JSON de goriva.si (ministère de l'Économie), ~550 stations, toutes les 3 h
- [x] HR : fichier national `data.gz` du ministère (mzoe-gor.hr), ~900 stations avec horaires et services, toutes les 2 h
- [x] DK : API des enseignes (obligation § 16 a depuis janvier 2026) ; OK + Shell (~900 stations), toutes les heures. ⚠️ Partiel : Q8/F24 sans coordonnées, Circle K et Uno-X à accès restreint
- [x] RO : Monitorul Prețurilor (Consiliul Concurenței). ⚠️ L'API ne répond que par cercles de 5 km, un produit et 50 résultats par requête : centres de 12 grandes villes en planifié, puis rafraîchissement à la demande avant chaque recherche en Roumanie (budget 6 s)
- [x] Avertissement « couverture partielle » DK et RO dans la liste (7 langues) ; pays ajoutés au formulaire « station manquante »
- [x] Fixtures réelles + tests (62) ; recherche vérifiée à Ljubljana, Zagreb, Copenhague, Cluj et Sibiu (rafraîchissement à la demande)

## Journal
- 2026-10-10 — MVP commité. Plan V1 rédigé.
- 2026-10-10 — Phase 1 terminée (28 tests). Overpass renvoie parfois 504 : le réessai suffit, l'import est hebdomadaire.
- 2026-10-10 — Phase 2 codée, tests OK (30). Import d'archive FR lancé en arrière-plan ; graphique à valider visuellement.
- 2026-10-10 — Phase 2 validée visuellement. Début phase 3.
- 2026-10-10 — Phase 3 terminée (34 tests). Début phase 4 (itinéraire).
- 2026-10-10 — Phase 4 terminée (39 tests). Début phase 5 (nouveaux pays).
- 2026-10-10 — Phase 5 terminée hors UK (bloqué, identifiants requis). Début phase 6.
- 2026-10-10 — Phase 6 terminée (51 tests). Début phase 7.
- 2026-10-10 — Phase 7 terminée. V1 complète hors connecteur UK (identifiants requis).
- 2026-10-10 — Refonte mobile + correctif des rechargements en boucle (commit a1b7ed9). Plan V2 rédigé, début phase 8.
- 2026-10-10 — Phase 8 terminée (55 tests). Début phase 9.
- 2026-10-10 — Phase 9 terminée (58 tests). Début phase 10.
- 2026-10-10 — Phase 10 terminée (62 tests). V2 complète ; DK et RO en couverture partielle (limites des sources).
