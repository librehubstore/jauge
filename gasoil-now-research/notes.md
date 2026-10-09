# Notes de recherche — Gasoil Now (Essence / Gasoil Now, SAS 03 JULY)

Contexte utilisateur : usage interne, auth email/mot de passe + Google, vérification email (anti-inscriptions frauduleuses), emails via Brevo (compte librehub), couverture européenne, multilingue, stack à proposer.

Aucun site officiel / centre d'aide public trouvé (gasoilnow.fr inexistant). Sources officielles = fiches stores. Contact : gasoilnow@03july.com, @03julyHello.

## Track A — Fonctionnalités (officiel)
- Stations les plus proches / moins chères au litre / moins chères au plein ; "combien vais-je économiser" [Official] — https://play.google.com/store/apps/details?id=com.toj.gasnow&hl=fr
- Signalements communautaires des stations épuisées (rupture), en direct [Official] — https://play.google.com/store/apps/details?id=com.toj.gasnow&hl=fr
- Sources OpenData : FR prix-carburants.gouv.fr, ES geoportalgasolineras.es, PT precoscombustiveis.dgeg.gov.pt, IT carburanti.mise.gov.it ; BE/LU/AD/MC prix saisis uniquement par utilisateurs [Official] — https://play.google.com/store/apps/details?id=com.toj.gasnow&hl=fr
- Carburants : B7, B7+, B10, XTL, Gasoil/Gazole/Diesel, Diesel+, E5/SP95, SP98, E10, GPLc, Ethanol/Bioéthanol, E85, AdBlue, H2, GNV, GNC/CNG, BioGNC, GNL/LNG [Official] — https://apps.apple.com/fr/app/essence-gasoil-now/id681463839
- Pas d'inscription requise ; géolocalisation [Official] — https://apps.apple.com/fr/app/essence-gasoil-now/id681463839
- Langues FR, EN, ES, IT, PT [Official] — https://apps.apple.com/fr/app/essence-gasoil-now/id681463839
- Achats intégrés : option annuelle 0,99 €, suppression pub 0,99 € [Official] — https://apps.apple.com/fr/app/id681463839
- Carte centrale + liste des pompes + filtres en bas ; barre de recherche d'une zone ; menu profil / véhicules / réglages [Official] — https://iphonesoft.fr/2019/04/08/gasoil-now-4-0-l-app-trouver-l-essence-bornes-electriques-gonfleurs
- Filtres bornes électriques, gonflage, lavage [Official] — idem
- Guidage vers station via Waze / Apple Plans / Google Maps (choix de l'app GPS) [Official] — https://iphonesoft.fr/2022/04/02/profitez-baisse-prix-essence-app-gasoil-now ; https://apps.apple.com/fr/app/essence-gasoil-now/id681463839?see-all=reviews
- Profil véhicule : catégorie, carburant, volume réservoir, consommation moyenne → coût du plein par station [Official] — https://iphonesoft.fr/2022/04/02/profitez-baisse-prix-essence-app-gasoil-now
- Plusieurs véhicules [Official] — https://worldsapps.com/fr/reviews-gas-now-gas-price-comparator
- Code couleur des stations selon prix ; filtres par carburant et par marque/enseigne (exclusion de marques) ; guidage avec coût du trajet [Official] — https://play.google.com/store/apps/details?id=com.toj.gasnow&hl=fr (avis R. Chevrier 2024) ; worldsapps
- Tri prix / distance / favoris ; favoris [Official] — https://www.journaldugeek.com/telecharger/loisirs/automobile/gasoil-now.html
- Filtres moyen de paiement (carte / espèces), toilettes, gonfleur [Official] — https://media.roole.fr/quotidien/au-volant/crushtest-gasoil-now-pour-trouver-la-station-service-la-moins-chere (via snippet, page 429) ; avis App Store LUDOMP05
- Stations fermées (icône zzz) ; dates de mise à jour des prix [Official] — https://lecafedugeek.fr/gasoil-now-connaitre-prix-lessence-autour-soi/ ; worldsapps
- Stations le long d'un itinéraire ; rayon de recherche ; mode paysage (premium 2016) [Official] — https://iphonesoft.fr/2016/02/16/gasoil-now-renforce-modele-payant-in-app
- Alerte de prix (existe en 2026 selon avis) [Inferred] — https://apps.apple.com/fr/app/essence-gasoil-now/id681463839?see-all=reviews (avis XénonXé, janv. 2026)
- Signalement de prix par utilisateurs en France pour corriger [Official] — https://www.journaldugeek.com/telecharger/loisirs/automobile/gasoil-now.html
- Pseudo utilisateur (compte optionnel) [Inferred] — Play avis Carine Ost 2026
- Suggestions / Problèmes dans Paramètres (support) [Official] — Play réponse éditeur 2018
- Licence base État : coûts ~10 k€ (2016) [Official] — https://iphonesoft.fr/2016/02/16/gasoil-now-renforce-modele-payant-in-app

## Track B — Douleurs / demandes
- Pubs invasives, non fermables, redirections (Temu/AliExpress), crash après pub — majorité des avis 2026 [Fix → hors sujet en interne : pas de pub] — https://play.google.com/store/apps/details?id=com.toj.gasnow&hl=fr
- Abonnement anti-pub expiré sans prévenir ; pseudo changé tout seul [Fix] — Play (Carine Ost, 19/08/2026)
- Forcer géolocalisation [Fix : recherche par adresse sans géoloc] — Play (Laurent Domin, 15/09/2026)
- Incompatibilité vieux Android (11) après MAJ [Fix : PWA / support large] — Play (Mr baba, 13/08/2026)
- Bug écran blanc [Fix] — Play (R. Chevrier 2024)
- Savoir si trajet le plus économique vs le plus rapide ; aller-retour [Requested] — Play (R. Chevrier, 83 votes utiles)
- Classement tenant compte du coût du trajet [Requested] — worldsapps
- Alerte prix sous seuil + historique de prix par station (tendance) [Requested] — https://apps.apple.com/fr/app/essence-gasoil-now/id681463839?see-all=reviews (B.eva 2023) ; worldsapps
- Indiquer rupture de carburant [Requested → existe depuis] — iphonesoft 2022 (gwaview)
- Prix pas à jour / fausses infos [Fix : afficher fraîcheur, source, fiabilité] — App Store dbo1950 2022 ; lecafedugeek
- Filtrer carte : masquer bornes électriques ; ne montrer que les stations vendant le carburant choisi [Requested] — worldsapps
- Diesel premium non distinguable → trajet inutile [Fix : carburants premium distincts] — App Store Lutetius 2019
- Signaler changement d'enseigne, GPL 24/24 [Requested] — worldsapps
- Stations manquantes (Total Access Lésigny, Martinique/DOM) [Fix : DOM-TOM inclus, signalement station manquante] — worldsapps
- Supprimer un favori pas clair ; libellés carburant obscurs [Fix] — worldsapps
- Batterie en arrière-plan [Fix] — worldsapps
- CarPlay [Requested] — worldsapps
- Extension Allemagne, Suisse, Belgique, Luxembourg [Requested] — worldsapps ; iphonesoft 2019 (prix hors France)
- Pas de bouton retour à ma position [Requested] — https://iphonesoft.fr/2022/10/10/app-gratuite-trouver-essence-penurie
- Hors service pendant pénurie 2022 (montée en charge) [Fix] — idem
- App non installable en Belgique (région store) [Fix] — https://iphonesoft.fr/2020/01/19/gasoil-now-liste-prix-carburant-belgique-espagne-italie-portugal
- Qualité/composition du carburant (demande) [Requested, faible] — https://iphonesoft.fr/2022/04/02/profitez-baisse-prix-essence-app-gasoil-now
- Station fermée à l'arrivée (horaires) [Fix : horaires et ouvert maintenant] — iphonesoft 2022-10

## Sources de données européennes (prix par station)
- FR : flux instantané (~10 min) + instantané_ruptures + quotidien + annuel (depuis 2007), XML zippé ; champs pdv id/lat/lon(/100000)/cp/type A|R, horaires + automate 24/24, services, prix (Gazole, SP95, SP98, GPLc, E10, E85) + maj, ruptures (temporaire/définitive), fermetures ; PAS de nom ni d'enseigne ; Licence Ouverte 2.0 [Official] — https://www.prix-carburants.gouv.fr/rubrique/opendata/
- FR enseignes via OpenStreetMap par proximité [Inferred] — https://github.com/aslafy-z/plein
- ES : API REST MITECO ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres (JSON/XML, ~30 min, ~11 500 stations, historique par jour EstacionesTerrestresHist/{dd-mm-yyyy}), enseigne incluse ; blocages connexions cloud signalés [Official] — https://datos.gob.es/en/catalogo/e05068001-precio-de-carburantes-en-las-gasolineras-espanolas ; https://github.com/carlosveny/fuel-price-api
- IT : MIMIT CSV quotidien anagrafica_impianti_attivi.csv + prezzo_alle_8.csv (jointure idimpianto, séparateur "|" depuis 10/02/2026), IODL 2.0, ~23 900 stations, archives trimestrielles [Official] — https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti ; https://www.mimit.gov.it/images/stories/documenti/Metadati_prezzi_carburanti_20260128.pdf
- PT : portail DGEG, continent seul, pas d'E10 ni horaires ; pas d'API documentée publiquement [Inferred] — https://precoscombustiveis.dgeg.gov.pt/ ; https://github.com/aslafy-z/plein
- AD : flux Govern d'Andorra (sans adresses ni horaires) [Inferred] — https://github.com/aslafy-z/plein
- DE : MTS-K via Tankerkönig (clé API gratuite, CC BY 4.0, Diesel/Super/E10 seulement, pas GPL/GNC, ≥5 min entre requêtes) [Official] — https://www.openhab.org/addons/bindings/tankerkoenig/ ; https://community.openstreetmap.org/t/undiskutierter-cng-import/72791?page=2
- AT : E-Control Spritpreisrechner, seulement les 5 stations les moins chères par district publiées ; hausses de prix autorisées à midi uniquement [Inferred] — https://euenergyprices.eu/en/fuel/at/stations ; https://apify.com/rainminer/spritpreisrechner-at-scraper/api
- UK : Fuel Finder (live 02/02/2026), OAuth2 client credentials, ~8 300 stations, MAJ < 30 min, horaires + services, OGL v3 [Official] — https://www.gov.uk/guidance/access-the-latest-fuel-prices-and-forecourt-data-via-api-or-email
- HR, SI, DK, IS, RO : prix par station disponibles selon agrégateur (sources non nommées) [Inferred] — https://www.fuel-prices.eu/live/
- BE : prix maximum officiel quotidien seulement ; LU : prix max réglementés / moyennes hebdo ; GR : moyennes par préfecture ; SE : prix de liste [Inferred] — https://www.fuel-prices.eu/live/
- Moyennes nationales hebdo : EU Weekly Oil Bulletin [Official] — https://www.fuel-prices.eu/ai/catalog.json
- Sources HR/SI/RO officielles non vérifiées (recherche sans résultat) — à valider.

## Concurrents / comparaisons
- Fuel Flash : alerte prix (prix cible, stations favorites, carburant), historique graphique par station, recherche par adresse, rayon 25 km [Requested chez Gasoil Now] — https://www.clubic.com/telecharger-fiche437277-fuel-flash.html
- Plein (open source) : meilleur choix prix+distance avec coût du détour, plan carburant d'itinéraire (où s'arrêter, combien de litres, 3 stratégies), éviter autoroutes/péages, lien partageable, PWA hors-ligne, thème clair/sombre, fraîcheur des prix signalée, horaires en clair [Requested] — https://github.com/aslafy-z/plein
- Petroly : prix le long de l'itinéraire, 9-11 pays [Requested] — https://www.appbrain.com/app/petroly-cheap-fuel-finder/tech.pertiller.petroly
- ADAC : comparaison le long d'une route = fonction n°1 ; mehr-tanken : prévision meilleur moment pour faire le plein ; fraîcheur des prix = plainte récurrente [Requested] — https://www.mietwagen-talk.de/forum/thread/16308-tankstellen-apps-im-vergleich/ ; https://www.appgefahren.de/?p=24861
- Flotte : plafonds de dépense par conducteur/véhicule, rapprochement cartes carburant, rapports de coûts [Inferred, V2 si usage flotte] — https://www.samsara.com/fr/products/telematics/fleet-fuel-management-system ; https://www.lafabriquedunet.fr/logiciel/suivideflotte

## Familles de sources Track B
- Stores (Play, App Store) : OK. Presse/tests (iphonesoft, roole, lecafedugeek) : OK. Comparaisons/concurrents : OK. GitHub (Plein) : OK.
- Reddit : 3 recherches (FR, DE, EU) sans aucun fil pertinent → rien.
- Pas de feedback board public ni de centre d'aide officiel pour Gasoil Now.
- Non lus : media.roole.fr (HTTP 429), lalibre.be.
- Écartés : zylalabs, oilpriceapi (commerciaux, moyennes nationales, hors sujet).
