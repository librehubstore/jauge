# Jauge — Prompt de régénération

Ce document décrit entièrement une application existante, nommée **Jauge**, pour qu'un assistant de code puisse en reconstruire un équivalent fonctionnel sans accès au code d'origine. Il décrit des comportements, pas une implémentation : la pile technique est libre, sauf mention contraire dans la section 6.
---


## 1. Intention

Jauge est une application web installable sur smartphone (application web progressive) qui indique **où faire le plein au meilleur coût réel**, partout en Europe. Elle s'adresse aux **salariés d'une organisation** qui conduisent pour leur travail : ils ouvrent l'application dehors ou en voiture à l'arrêt, d'une main, et doivent choisir une station en moins de dix secondes ou préparer les arrêts d'un long trajet.

Le problème résolu : les prix affichés seuls trompent. Jauge classe les stations selon le **coût total** (prix du plein selon le véhicule, plus le carburant brûlé pour faire le détour). Elle tient compte de l'ouverture, des ruptures et de l'ancienneté du prix, et planifie les arrêts carburant d'un itinéraire. Les données viennent des **sources publiques officielles** de chaque pays, complétées par les signalements des utilisateurs.

Elle remplace l'application grand public *Essence / Gasoil Now* : financée par la publicité, avec une option payante annuelle, limitée à quelques pays et à une seule langue. Jauge est un **outil interne**, sans publicité, sans achat ni abonnement, en sept langues, avec une nomenclature européenne harmonisée des carburants et plusieurs devises.

---

## 2. Périmètre fonctionnel

Toutes les fonctions, sauf les écrans d'authentification, exigent un compte actif et connecté.

### 2.1 Compte et accès

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Crée un compte avec nom affiché, email et mot de passe | Envoie un email de vérification valable 24 h et affiche « un email vient d'être envoyé à … ». Le compte ne peut pas encore se connecter. |
| Crée un compte ou se connecte avec Google (si l'option est configurée) | Crée le compte directement vérifié, puis le connecte, ou le met en attente de validation si l'instance l'exige. |
| Clique sur le lien de vérification | Affiche « adresse vérifiée, vous pouvez vous connecter », ou « un administrateur doit encore valider votre compte ». Un lien déjà utilisé ou expiré affiche une erreur. |
| Se connecte avec email et mot de passe | Ouvre l'application sur la page demandée avant la redirection, sinon sur la carte. Si l'email n'est pas vérifié : message d'erreur, bouton « renvoyer l'email de vérification », et nouvel envoi automatique. |
| Demande la réinitialisation de son mot de passe | Affiche toujours le même message (le compte existe ou non) et envoie un lien valable 1 h si le compte existe. |
| Choisit un nouveau mot de passe via le lien | Change le mot de passe et ferme toutes les sessions ouvertes. |
| Change la langue (écrans de connexion ou réglages) | Rafraîchit l'interface dans la langue choisie et la mémorise (navigateur et compte). |
| Se déconnecte | Revient à l'écran de connexion. |

### 2.2 Recherche de stations sur carte

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Ouvre la carte | Affiche aussitôt la dernière zone consultée (ou Paris), puis recentre sur sa position si la géolocalisation aboutit. Si elle est refusée : message invitant à chercher une ville ou une adresse. |
| Tape une ville ou une adresse | Propose jusqu'à 6 lieux pendant la frappe ; le choix recentre la carte et relance la recherche. |
| Appuie sur « Autour de moi » ou « Recentrer » | Recentre sur sa position. |
| Déplace la carte à la main | Affiche un bouton « Rechercher dans cette zone » ; l'appui relance la recherche au nouveau centre, avec un rayon égal à la moitié de la diagonale visible. |
| Choisit véhicule, carburant, tri, rayon | Relance la recherche ; choisir un véhicule impose son carburant. |
| Ouvre « Filtres » | Règle le niveau actuel du réservoir (0 à 90 %), coche des filtres, choisit des services obligatoires, exclut des enseignes présentes dans les résultats. |
| Consulte la liste | Pour chaque station : enseigne ou nom, adresse, prix à l'unité, classe de prix (bas, moyen, élevé) ou état, distance, fermeture actuelle, ancienneté du prix, coût du plein, détour (distance, coût, durée ou mention « estimé ») et économie par rapport à la médiane de la zone. |
| Touche un point de la carte | Met la station en évidence dans la liste et fait défiler jusqu'à elle. |
| Touche une station de la liste | Ouvre sa fiche. |
| Partage l'adresse de la page | L'adresse reflète la zone, le carburant, le rayon, le tri et les filtres ; l'ouvrir restitue cette vue. |
| Est hors ligne | Voit la dernière recherche connue, avec la date des données. |

### 2.3 Fiche station

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Ouvre une fiche | Affiche identité, adresse, état d'ouverture du moment, type de voie, prix par carburant (ancienneté, provenance officielle ou communautaire, rupture, tendance sur 7 jours), conseil « faire le plein maintenant ou attendre », historique des prix, horaires, services, source et licence. |
| Lance la navigation | Ouvre son application de navigation préférée (Google Maps, Apple Plans, Waze ou OpenStreetMap) vers la station ; les autres sont proposées en liens secondaires. |
| Ajoute ou retire des favoris | Met à jour immédiatement. |
| Consulte l'historique | Choisit carburant et période (7 jours, 30 jours, 1 an) ; voit le prix de la station et la médiane de la zone en escalier, une infobulle au survol et un tableau des derniers changements. |
| Exporte l'historique | Télécharge un CSV d'un an, tous carburants. |
| Crée une alerte sur la station | Choisit carburant et seuil (proposé : prix actuel moins 0,02). |
| Signale un prix, une rupture, une fermeture, une enseigne ou des horaires | Reçoit « publié » ou « sera vérifié par un modérateur ». |
| Appuie sur « J'ai fait le plein ici » | Ouvre le journal de pleins avec la station et son prix préremplis. |

### 2.4 Itinéraire et plan carburant

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Saisit départ, arrivée et jusqu'à 3 étapes | Propose des lieux pendant la frappe. |
| Choisit véhicule, niveau de départ du réservoir (5 à 100 %) et options (réserve 10 à 25 %, couloir 1 à 20 km, éviter péages, éviter autoroutes) | Mémorise les choix pour le calcul. |
| Lance le calcul | Affiche distance, durée, nombre de stations candidates, tracé sur carte. Trois stratégies en onglets : **coût minimal**, **équilibré** (2 arrêts au plus), **moins d'arrêts**. |
| Choisit une stratégie | Voit le coût total, la quantité achetée, l'économie par rapport à la stratégie « moins d'arrêts », puis la liste ordonnée des arrêts (kilomètre, ville, quantité, coût, détour, prix) et le carburant restant à l'arrivée. Message « aucun arrêt nécessaire » ou « plan impossible » selon le cas. |
| Ouvre tout dans Google Maps | Ouvre l'itinéraire avec les arrêts en étapes. |
| Partage l'itinéraire | Copie une adresse qui, ouverte, préremplit le formulaire et relance le calcul. |

### 2.5 Favoris

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Ouvre ses favoris | Voit chaque station avec le prix du jour pour le carburant de son véhicule par défaut, son ancienneté et l'écart avec le prix d'il y a 24 h. |
| Retire un favori | Le retire aussitôt, avec un bouton « Annuler » pendant 5 secondes. |
| Exporte ses favoris | Télécharge un CSV (une ligne par station et par carburant). |

### 2.6 Alertes de prix

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Crée une alerte « favoris » ou « zone » (lieu géocodé et rayon) avec carburant et seuil | L'ajoute à sa liste. |
| Met une alerte en pause, la reprend ou la supprime | Met à jour la liste. |
| Attend | Reçoit une notification dans l'application (et en push si activé, par email si choisi) quand le meilleur prix concerné passe sous le seuil, au plus une fois par 24 h. |

### 2.7 Notifications

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Voit un badge de notifications non lues | Ouvre la page Notifications : les 100 dernières, avec un lien vers la station concernée. Toutes passent en « lues ». |
| Active les notifications push sur l'appareil (réglages) | Demande l'autorisation au navigateur, puis enregistre l'appareil. Il peut les désactiver. |

### 2.8 Véhicules

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Ajoute, modifie ou supprime un véhicule (nom, carburant principal, carburant secondaire facultatif parmi GPL, GNC et E85, capacité du réservoir, consommation aux 100 km) | Met la liste à jour ; le premier véhicule devient le véhicule par défaut. |
| Choisit le véhicule par défaut | Ce véhicule sert de valeur par défaut à la recherche, aux favoris, aux alertes et au journal. |

### 2.9 Journal de pleins

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Ajoute un plein (quantité, montant, compteur kilométrique facultatif, date, plein complet ou partiel, note) | L'ajoute à l'historique du véhicule. Si la station est connue, le montant se calcule à partir de la quantité (modifiable). |
| Consulte ses statistiques | Voit la consommation réelle, le coût aux 100 km, le prix moyen payé et les dépenses par mois. |
| Accepte de remplacer la consommation déclarée par la consommation réelle | Met à jour le véhicule (proposé si l'écart dépasse 5 %). |
| Supprime un plein, change de véhicule, exporte en CSV | Met à jour ou télécharge. |

### 2.10 Signalements communautaires

| Ce que fait l'utilisateur | Ce que le système répond |
|---|---|
| Signale une station manquante (adresse géocodée, nom, enseigne, adresse, ville, pays) | Envoie en modération ; la station apparaît après validation. |
| Signale depuis une fiche (voir 2.3) | Publication immédiate ou modération, selon les règles de la section 4.7. |
| Voit sa contribution validée ou refusée | Reçoit une notification (avec le motif en cas de refus). |

### 2.11 Réglages personnels

Langue, carburant par défaut, rayon par défaut, âge maximal des prix pris en compte, affichage en gris des stations au prix trop ancien, unité de distance (km ou miles), application de navigation, thème (système, clair, sombre), devise d'affichage (devise d'origine ou conversion au taux du jour), alertes par email, notifications push sur l'appareil.

### 2.12 Modération (modérateurs et administrateurs)

| Ce que fait le modérateur | Ce que le système répond |
|---|---|
| Ouvre la file de modération | Voit les 100 plus anciennes contributions en attente : type, station, valeurs, auteur et sa réputation. Pour un prix, il voit aussi la médiane locale et le prix actuel ; pour une station manquante, un lien vers la position sur OpenStreetMap. |
| Valide ou refuse, avec un motif facultatif | Applique ou écarte la contribution, met à jour la réputation et prévient l'auteur. |

### 2.13 Administration (administrateurs)

| Ce que fait l'administrateur | Ce que le système répond |
|---|---|
| Liste et filtre les comptes (texte sur email ou nom, statut) | Affiche les 200 plus récents. |
| Valide un compte en attente, désactive ou réactive un compte, change un rôle | Met à jour ; la désactivation coupe toutes les sessions ; la validation prévient l'intéressé. |
| Envoie un lien de réinitialisation ou renvoie l'email de vérification | Envoie l'email. |
| Règle les domaines email autorisés et l'obligation de validation des comptes | Enregistre. |
| Consulte l'état des connecteurs de données, en active ou désactive un, en lance un tout de suite | Affiche santé, dernier succès, dernière exécution, erreurs ; lance l'exécution en arrière-plan. |
| Lance l'enrichissement des enseignes françaises | Le lance en arrière-plan. |
| Consulte le journal d'audit | Voit les 200 dernières actions d'administration et de modération. |

### 2.14 Divers

- **Page « À propos »** : liste des sources par pays, avec attribution, lien et licence, et mention des données OpenStreetMap.
- **Écran de lancement animé** : une fois par onglet.
- **Bandeau hors ligne** : affiché tant que l'appareil n'a pas de réseau.
- **Installation** : l'application s'installe sur l'écran d'accueil.

---

## 3. Modèle de données

Conventions : les dates sont des instants avec fuseau. Les positions sont des points géographiques WGS84 (longitude, latitude). « Obligatoire » signifie non nul. Les montants de prix ont 3 décimales (7 chiffres significatifs), les montants de dépense 2 décimales.

### 3.1 Utilisateur

| Champ | Type | Contraintes et défaut |
|---|---|---|
| identifiant | texte | clé primaire |
| nom | texte | obligatoire |
| email | texte | obligatoire, **unique**, stocké en minuscules pour l'administrateur initial |
| email vérifié | booléen | obligatoire, défaut faux |
| image | texte | facultatif |
| créé le, modifié le | date | obligatoires, défaut maintenant |
| rôle | énumération `user`, `moderator`, `admin` | obligatoire, défaut `user` ; jamais fourni par l'utilisateur à l'inscription |
| statut | énumération `pending_verification`, `pending_approval`, `active`, `disabled` | obligatoire, défaut `pending_verification` |
| langue | code parmi `fr`, `en`, `es`, `it`, `pt`, `de`, `nl` | obligatoire, défaut `fr`, fournie à l'inscription |
| préférences | document structuré (voir ci-dessous) | obligatoire, défaut vide |
| réputation | entier | obligatoire, défaut 0 |

**Préférences** (toutes facultatives, valeur par défaut entre parenthèses) :
- unité de distance `km` ou `mi` (km) ;
- carburant par défaut (B7) ;
- rayon par défaut, de 1 à 50 km (10) ;
- application de navigation `google`, `apple`, `waze` ou `osm` (google) ;
- thème `system`, `light` ou `dark` (system) ;
- alertes par email, booléen (faux) ;
- devise d'affichage, vide ou une devise de la liste en 4.12 (vide = devise d'origine) ;
- âge maximal des prix en jours, entier de 1 à 60, l'interface proposant 1, 2, 3, 7, 14 ou 30 (14) ;
- afficher les prix trop anciens, booléen (faux).

### 3.2 Session, compte d'authentification, vérification, limitation de débit

- **Session** : identifiant, expiration (obligatoire), jeton (**unique**), dates, adresse IP, agent utilisateur, utilisateur (obligatoire, suppression en cascade).
- **Compte d'authentification** : identifiant, identifiant chez le fournisseur, fournisseur (`credential` pour email et mot de passe, `google`), utilisateur (cascade), jetons du fournisseur et leurs expirations, portée, empreinte du mot de passe (pour `credential`), dates.
- **Vérification** : identifiant, identifiant visé, valeur, expiration, dates. Sert aux jetons de réinitialisation.
- **Compteur de limitation** : clé **unique**, nombre de requêtes, date de la dernière requête (millisecondes). Stocké en base pour être partagé entre instances.

### 3.3 Paramètre d'instance

Couple clé (clé primaire) et valeur (document structuré). Clés utilisées :
- `allowed_email_domains` : liste de domaines, vide par défaut (vide = tous autorisés) ;
- `require_admin_approval` : booléen, faux par défaut ;
- `ecb_rates` : date et table des taux de change de la BCE, base EUR, `EUR` = 1 ; absent par défaut.

Clés définies avec une valeur par défaut mais jamais lues : `active_countries` (FR, ES, IT), `stale_hours` (48), `excluded_days` (7). Voir la section 8.

### 3.4 Type de carburant

| Champ | Type | Contraintes |
|---|---|---|
| code | texte | clé primaire |
| unité | `L` ou `kg` | obligatoire, défaut `L` |
| symbole européen | texte | facultatif |
| ordre | petit entier | obligatoire, défaut 0 |

Référentiel fixe, dans cet ordre d'affichage :

| Code | Unité | Symbole UE | Libellé français |
|---|---|---|---|
| B7 | L | B7 | Gazole (B7) |
| B7_PREMIUM | L | B7 | Gazole premium (B7) |
| B10 | L | B10 | Gazole B10 |
| XTL | L | XTL | Gazole de synthèse / HVO (XTL) |
| E5 | L | E5 | Sans plomb 95 (E5) |
| E5_98 | L | E5 | Sans plomb 98 (E5) |
| E10 | L | E10 | Sans plomb 95-E10 |
| E85 | L | E85 | Superéthanol (E85) |
| LPG | L | LPG | GPL |
| CNG | kg | CNG | GNV / GNC |
| LNG | kg | LNG | GNL |
| H2 | kg | H2 | Hydrogène |
| ADBLUE | L | — | AdBlue |

Services normalisés (clés traduites) : gonflage, lavage, boutique, toilettes, bornes électriques, restauration, distributeur de billets, piste poids lourds, Wi-Fi, entretien et réparation, gaz en bouteille, carburant additivé, aire camping-cars, AdBlue à la pompe, carte 24/24.

### 3.5 Source de données

| Champ | Type | Contraintes et défaut |
|---|---|---|
| identifiant | texte court (`fr`, `es`…) | clé primaire |
| pays | code ISO à 2 lettres (ou `EU`) | obligatoire |
| nom, licence, attribution | texte | obligatoires |
| type | `official` ou `community` | obligatoire, défaut `official` |
| adresse web | texte | facultatif |
| planification | expression cron (UTC) | obligatoire (vide pour la source communautaire) |
| activée | booléen | obligatoire, défaut vrai |
| dernier succès | date | facultatif |
| échecs consécutifs | entier | obligatoire, défaut 0 |

Une source spéciale `community` (pays `EU`, désactivée, sans planification) accueille les stations créées par signalement.

### 3.6 Exécution d'ingestion

Identifiant auto-incrémenté, source (obligatoire, référence), début (défaut maintenant), fin, statut `running`, `success` ou `error` (défaut `running`), nombre de stations écrites, nombre de prix écrits (défauts 0), message d'erreur. **Index** sur (source, début).

### 3.7 Enseigne

Identifiant auto-incrémenté, nom **unique** obligatoire.

### 3.8 Station

| Champ | Type | Contraintes et défaut |
|---|---|---|
| identifiant | entier auto-incrémenté | clé primaire |
| source | référence | obligatoire |
| identifiant externe | texte | obligatoire ; **unique avec la source** |
| pays | code ISO | obligatoire |
| nom | texte | facultatif |
| enseigne | référence | facultative |
| provenance de l'enseigne | `source`, `osm` ou `community` | facultative |
| adresse, code postal, ville | texte | facultatifs |
| position | point WGS84 | obligatoire ; **index spatial** permettant les recherches par distance géodésique |
| type de voie | `road`, `motorway` ou `unknown` | obligatoire, défaut `unknown` |
| automate 24/24 | booléen | obligatoire, défaut faux |
| services | liste de clés | obligatoire, défaut vide |
| moyens de paiement | liste de textes | obligatoire, défaut vide (stockés, non affichés) |
| statut | `active`, `closed_temp`, `closed` ou `inactive` | obligatoire, défaut `active` |
| vue pour la dernière fois | date | obligatoire, défaut maintenant |

### 3.9 Horaires d'ouverture

Station (cascade), jour de la semaine (0 = lundi … 6 = dimanche), ouverture et fermeture au format `HH:MM` (facultatives), fermé (booléen, défaut faux). **Clé primaire** : (station, jour). Une seule plage par jour.

### 3.10 Prix courant

| Champ | Type | Contraintes et défaut |
|---|---|---|
| station | référence | cascade |
| carburant | référence au type de carburant | — |
| prix | décimal 3 décimales | obligatoire |
| devise | code ISO | obligatoire, défaut EUR |
| date côté source | date | obligatoire (date du dernier changement, ou de la récupération si la source n'en donne pas) |
| date d'ingestion | date | obligatoire, défaut maintenant |
| provenance | `official` ou `community` | obligatoire, défaut `official` |
| en quarantaine | booléen | obligatoire, défaut faux |

**Clé primaire** : (station, carburant). Un seul prix courant par couple.

### 3.11 Historique des prix

Station (cascade), carburant, prix, devise (défaut EUR), valable à partir de (obligatoire). **Clé primaire** : (station, carburant, valable à partir de). Un point par **changement** de prix.

### 3.12 Rupture

Identifiant, station (cascade), carburant, type `temporary` ou `permanent` (défaut `temporary`), début (défaut maintenant), fin (facultative ; vide = en cours), provenance `official` ou `community` (défaut `official`), signalée par (utilisateur, mis à vide si supprimé). **Index** sur la station.

### 3.13 Véhicule

Identifiant, utilisateur (cascade), nom (obligatoire), carburant principal (référence, obligatoire), carburant secondaire (référence, facultatif), capacité du réservoir (réel, obligatoire, en L ou kg selon le carburant), consommation aux 100 km (réel, obligatoire), par défaut (booléen, défaut faux). Au plus un véhicule par défaut par utilisateur (garanti par les opérations, voir 4.9).

### 3.14 Plein

Identifiant, utilisateur (cascade), véhicule (cascade), station (facultative, mise à vide si supprimée), date du plein (obligatoire), carburant (référence, obligatoire), quantité (réel, obligatoire), montant total (décimal 2 décimales, obligatoire), devise (défaut EUR), compteur kilométrique (entier, facultatif), plein complet (booléen, défaut vrai), note (facultative), créé le. **Index** sur (véhicule, date du plein).

### 3.15 Favori

Utilisateur (cascade), station (cascade), créé le. **Clé primaire** : (utilisateur, station).

### 3.16 Contribution

| Champ | Type | Contraintes et défaut |
|---|---|---|
| identifiant | entier | clé primaire |
| auteur | référence utilisateur | mis à vide si supprimé |
| station | référence | cascade ; vide pour une station manquante avant validation |
| type | `outage`, `price`, `closed`, `brand_change`, `missing_station` ou `hours` | obligatoire |
| contenu | document structuré | obligatoire (voir 4.7) |
| statut | `pending`, `published`, `rejected` ou `expired` | obligatoire, défaut `pending` |
| modérateur | référence utilisateur | mis à vide si supprimé |
| motif | texte | facultatif |
| créé le | date | défaut maintenant |

### 3.17 Alerte de prix

| Champ | Type | Contraintes et défaut |
|---|---|---|
| identifiant | entier | clé primaire |
| utilisateur | référence | cascade |
| portée | `station`, `favorites` ou `area` | obligatoire |
| station | référence | cascade ; renseignée pour `station` |
| centre | point | renseigné pour `area` |
| libellé | texte | libellé du lieu pour `area` |
| rayon (km) | réel | renseigné pour `area` |
| carburant | référence | obligatoire |
| seuil | décimal 3 décimales | obligatoire |
| active | booléen | défaut vrai |
| armée | booléen | défaut vrai |
| dernier déclenchement | date | facultatif |
| créée le | date | défaut maintenant |

**Index** sur « active ».

### 3.18 Abonnement push

Adresse de l'abonnement (**clé primaire**), utilisateur (cascade, **index**), clé publique de l'appareil, secret d'authentification, créé le.

### 3.19 Notification

Identifiant, utilisateur (cascade), type (texte), données (document structuré, défaut vide), lue le (facultatif), créée le. **Index** sur (utilisateur, date de création).

Types : `price_alert` (station, identifiant de station, carburant, prix, devise, seuil), `account_pending_approval` (identifiant et email du compte), `account_approved`, `contribution_approved`, `contribution_rejected` (motif), `connector_failing` (identifiant de source).

### 3.20 Journal d'audit

Identifiant, auteur (utilisateur, mis à vide si supprimé), action (texte), type de cible, identifiant de cible (facultatif), données (facultatives), date.

---

## 4. Règles métier

### 4.1 Authentification, statuts et rôles

1. **Accès** : toute page et toute API, hors pages d'authentification, contrôle de santé et points d'entrée d'authentification, exigent une session. Sans session, une page redirige vers la connexion en conservant la page visée (`next`), et une API répond 401. Ce premier contrôle est optimiste (présence du cookie) ; chaque page et chaque API revérifie ensuite côté serveur que l'utilisateur existe et a le statut `active`. Sinon, il est traité comme non connecté.
2. **Mot de passe** :
   - de 12 à 128 caractères ;
   - refusé s'il figure dans une courte liste de mots de passe très courants (comparaison sans tenir compte de la casse) ou s'il répète un seul caractère (erreur « mot de passe trop courant ») ;
   - stocké haché avec un algorithme résistant à la force brute, salé, à coût de calcul configurable et paramètres enregistrés dans l'empreinte ;
   - comparé en temps constant.
3. **Inscription par email** :
   - refusée explicitement (erreur « inscription impossible avec cette adresse ») si une liste de domaines autorisés existe et que le domaine de l'email n'y figure pas (comparaison sans casse) ;
   - pas de connexion automatique ; le rôle est toujours `user` et le statut `pending_verification` ;
   - un email de vérification part aussitôt.
4. **Vérification de l'email** :
   - le lien est valable 24 h ;
   - s'il est réutilisé alors que l'adresse est déjà vérifiée, la page d'atterrissage affiche une erreur ;
   - après vérification, le statut passe à `active`, ou à `pending_approval` si le paramètre `require_admin_approval` est vrai ; dans ce cas, chaque administrateur reçoit une notification `account_pending_approval` ;
   - la vérification ne connecte pas l'utilisateur.
5. **Connexion par email** :
   - un compte non vérifié est refusé (« email non vérifié ») et un nouveau lien lui est envoyé à chaque tentative ;
   - aucune session n'est créée pour un compte `pending_approval` (« compte en attente de validation ») ou `disabled` (« compte désactivé ») ;
   - mauvais identifiants : « email ou mot de passe incorrect », sans dire lequel.
6. **Google** (seulement si les identifiants sont configurés, sinon le bouton n'apparaît pas) :
   - refusé si Google indique l'email non vérifié ;
   - soumis à la même liste de domaines ;
   - un compte créé par Google est considéré comme vérifié : son statut est directement `active` ou `pending_approval` selon le paramètre ;
   - un compte Google n'est rattaché à un compte local existant que si ce dernier a déjà vérifié son email.
7. **Réinitialisation** : réponse identique que le compte existe ou non ; lien valable 1 h ; le nouveau mot de passe suit la règle 2 ; toutes les sessions de l'utilisateur sont fermées.
8. **Sessions** : durée de 30 jours, prolongée au plus une fois par jour d'activité.
9. **Limitation de débit**, par route et par adresse IP, partagée entre instances :

   | Opération | Limite |
   |---|---|
   | Inscription | 5 par heure |
   | Renvoi de l'email de vérification | 3 par heure |
   | Demande de réinitialisation | 3 par heure |
   | Connexion | 10 par 15 minutes |

   Au-delà : erreur « trop de tentatives ».
10. **Rôles** :
    - `user` : utilise l'application ;
    - `moderator` : utilisateur avec accès en plus à la modération ;
    - `admin` : modérateur avec accès en plus à l'administration.

    Une page réservée visitée sans le rôle redirige vers la carte. Une opération réservée appelée sans le rôle est refusée.
11. **Administrateur initial** : au démarrage, si un email et un mot de passe d'administrateur sont configurés et qu'aucun compte n'a cet email (en minuscules), un compte nommé « Admin » est créé, vérifié, actif, rôle `admin`. L'opération est idempotente.
12. **Langue** : choisie par cookie, sinon d'après la langue du navigateur (premier code à deux lettres pris en charge), sinon `fr`. Changer de langue la mémorise un an dans le navigateur et sur le compte. Les emails et les notifications push sont rédigés dans la langue du compte.

### 4.2 Ingestion des données

1. **Planification** : chaque source officielle est interrogée selon sa planification (voir 6.4), par un processus d'arrière-plan distinct du serveur web. Une source désactivée est ignorée.
2. **Premier démarrage** : chaque source activée qui n'a jamais réussi est lancée immédiatement. La source allemande est créée désactivée si sa clé d'accès manque. Les métadonnées des sources (nom, licence, attribution, adresse, planification, type) sont mises à jour à chaque démarrage, sans toucher à l'activation.
3. **Appels réseau** : chaque appel vers une source est tenté 3 fois (attentes de 2 puis 4 secondes), avec un délai maximal de 120 secondes par tentative et un agent utilisateur identifiant l'application.
4. **Journalisation** : chaque exécution crée une ligne d'exécution.
   - En cas de succès : statut `success`, compteurs remplis, dernier succès de la source mis à jour, échecs consécutifs remis à zéro. Si des prix ont changé, les alertes sont évaluées.
   - En cas d'échec : statut `error`, message enregistré, échecs consécutifs incrémentés. À exactement 3 échecs consécutifs, chaque administrateur reçoit `connector_failing`.
5. **Nettoyage du lot entrant** : stations aux coordonnées impossibles ignorées (latitude hors ±90, longitude hors ±180, ou 0,0). En cas d'identifiant externe en double dans le lot, seule la dernière occurrence est gardée.
6. **Prix aberrants** : pour chaque carburant, on calcule la médiane des prix du lot entrant. Un prix inférieur à 0,3 fois ou supérieur à 3 fois cette médiane est enregistré **en quarantaine** : jamais affiché, jamais utilisé dans un calcul, jamais historisé.
7. **Écriture des stations** : création ou mise à jour sur le couple (source, identifiant externe). Mise à jour de nom, adresse, code postal, ville, position, type de voie, automate, services, moyens de paiement, date de dernière vue, et statut sauf pour les sources dites « à statut conservé » (voir 4.2.12). **Enseigne** :
   - une enseigne validée par la modération (provenance `community`) n'est jamais remplacée ;
   - sinon l'enseigne fournie par la source l'emporte ;
   - à défaut, l'enseigne existante (par exemple enrichie depuis OpenStreetMap) est conservée.

   Les enseignes inconnues sont créées à la volée.
8. **Horaires et ruptures officielles** : remplacés intégralement à chaque passage pour les stations du lot. Les ruptures communautaires sont conservées. Une rupture dont la source indique une date de fin n'est pas importée.
9. **Prix** : pour chaque prix du lot :
   - ignoré s'il est identique au prix courant officiel (même montant et même date côté source) ;
   - ignoré si le prix courant est communautaire et plus récent que le prix entrant ;
   - sinon le prix courant est remplacé (provenance officielle, quarantaine selon la règle 6) ;
   - un point d'historique n'est ajouté que si le prix n'est pas en quarantaine **et** si le montant diffère du précédent ; il est daté de la date côté source et ignoré s'il existe déjà.
10. **Carburant disparu** : un carburant absent du lot n'est pas supprimé. Son prix vieillit et sort de l'affichage par la règle de fraîcheur.
11. **Stations disparues** : une station de la source non vue depuis 30 jours passe au statut `inactive`. Elle redevient `active` si elle réapparaît (sauf source à statut conservé).
12. **Pays sans données de prix publiques** (Belgique, Luxembourg, Monaco) : les stations sont importées chaque semaine depuis OpenStreetMap. Elles n'ont pas de prix officiels : les prix viennent des contributions. Ces sources conservent le statut existant (une fermeture validée n'est pas annulée).
13. **Enrichissement des enseignes françaises** (hebdomadaire, et une fois cinq minutes après le premier démarrage si aucune station n'a encore d'enseigne issue d'OpenStreetMap) : le flux officiel français ne donne pas l'enseigne. On récupère les stations-service françaises d'OpenStreetMap. On rapproche d'abord par l'identifiant officiel quand OpenStreetMap le porte, puis, pour les stations restées sans enseigne, par la plus proche à moins de 50 m. On renseigne l'enseigne (provenance `osm`) et le nom s'il manquait. On ne remplace jamais une enseigne de provenance `source` ou `community`.
14. **Roumanie à la demande** : la source roumaine ne répond que par cercles de 5 km et 50 résultats au plus. Avant chaque recherche dont le centre est en Roumanie :
    - on découpe la zone (rayon plafonné à 10 km) en cercles espacés de 7 km ;
    - on interroge ceux qui n'ont pas été consultés depuis 2 heures, deux par deux ;
    - on ingère le résultat.

    La recherche n'attend pas plus de 6 secondes ; au-delà, les données arrivent pour la recherche suivante. Les dates de consultation sont gardées en mémoire du processus web.
15. **Taux de change** : les taux quotidiens de la BCE sont récupérés les jours ouvrés à 15 h 30 UTC, et au démarrage s'ils sont absents. Ils sont stockés dans le paramètre `ecb_rates`.

### 4.3 Fraîcheur d'un prix

- **Récent** : 48 heures au plus.
- **Ancien** : plus de 48 heures, sans dépasser l'âge maximal choisi par l'utilisateur. Il est utilisable, avec la mention « ancien ».
- **Exclu** : plus vieux que l'âge maximal (14 jours par défaut).

Un prix exclu n'entre ni dans le classement, ni dans la médiane, ni dans les classes de prix, ni dans les coûts. Raison : plusieurs sources ne datent un prix que de son dernier changement, et un prix stable depuis plusieurs jours reste valable.

### 4.4 Recherche autour d'un point

1. **Paramètres** :
   - position ;
   - rayon (1 à 50 km, 10 par défaut ; ramené dans cet intervalle) ;
   - carburant (obligatoire) ;
   - tri : `best`, `price`, `fill` ou `distance` (`best` par défaut) ;
   - niveau du réservoir de 0 à 1 (0,25 par défaut) ;
   - véhicule ;
   - filtres booléens : seulement les stations qui vendent ce carburant (vrai par défaut), masquer les ruptures, ouvert maintenant, automate 24/24, inclure les prix anciens, favoris d'abord (tous faux par défaut) ;
   - enseignes à inclure, enseignes à exclure, services obligatoires.
2. **Véhicule** : le véhicule choisi, sinon le véhicule par défaut, sinon un véhicule générique de 50 L consommant 6 L aux 100 km.
3. **Candidats** : stations au statut `active` ou `closed_temp` situées dans le rayon (distance géodésique), triées par distance, **500 au plus**. Chacune porte son prix courant pour le carburant demandé.
4. **Rupture en cours** pour le carburant demandé, s'il existe une rupture sans date de fin qui remplit l'une des deux conditions :
   - elle est officielle ;
   - elle est communautaire, date de moins de 12 heures, et aucun prix plus récent que son début n'existe.
5. **Prix utilisable** : présent, hors quarantaine, et non exclu (sauf si le filtre « inclure les prix anciens » est actif).
6. **Ouverture actuelle** :
   - automate 24/24 : ouvert ;
   - horaires connus : calculés à l'heure locale du pays de la station ;
   - sinon : inconnue.

   Calcul avec horaires connus : jour fermé = fermé ; ouverture égale à la fermeture = ouvert 24 h ; plage passant minuit gérée.
7. **Filtres** :
   - « seulement les stations qui vendent » écarte les stations sans prix utilisable ;
   - « masquer les ruptures » écarte les stations en rupture ;
   - « ouvert maintenant » écarte seulement les stations **fermées** (une ouverture inconnue est gardée) ;
   - « automate 24/24 » garde les automates ;
   - « enseignes incluses » et « enseignes exclues » agissent sur l'enseigne (une station sans enseigne est traitée comme une enseigne fictive) ;
   - « services » exige tous les services cochés.
8. **Médiane et classes de prix** : calculées sur les prix utilisables, non exclus et hors rupture des stations retenues.
   - Classes en tiers : on trie les prix ; le premier seuil est le prix au rang « partie entière de n/3 », le second au rang « partie entière de 2n/3 ».
   - Un prix inférieur ou égal au premier seuil est **bas**, inférieur ou égal au second **moyen**, sinon **élevé**.
9. **Station classée** : prix utilisable, non exclu, hors rupture. Seules les stations classées reçoivent une classe, un coût de plein, un coût de détour, un coût total et une économie. Les autres sont affichées sans coût, en gris.
10. **Coûts** :
    - **quantité à ajouter** : capacité × (1 − niveau), niveau ramené entre 0 et 1, jamais négative ;
    - **coût du plein** : prix × quantité ;
    - **détour estimé** : distance à vol d'oiseau × 1,3 × 2 (aller-retour) ;
    - **coût du détour** : détour × consommation / 100 × prix ;
    - **coût total** : plein + détour ;
    - **économie** : (médiane − prix) × quantité − coût du détour.

    L'économie n'est affichée que si elle dépasse un demi-centime.
11. **Tri** :
    - favoris d'abord si demandé ;
    - puis selon la clé : distance ; ou, pour les autres tris, coût total (`best`), prix (`price`) ou coût du plein (`fill`) ;
    - les stations non classées passent toujours après les stations classées ;
    - à égalité, la plus proche d'abord.
12. **Détour routier réel** : pour les tris `best` et `fill`, les 25 premières stations classées reçoivent la distance et la durée routières réelles depuis la position (aller × 2). On recalcule leurs coûts, puis on retrie. Le service de routage dispose de 3 secondes ; en cas d'échec ou de valeur manquante, l'estimation est conservée et libellée « estimé ».
13. **Confidentialité** : la position sert à la requête et n'est jamais stockée côté serveur. Le navigateur mémorise seulement la dernière zone, localement.
14. **Couverture partielle** : si les résultats contiennent des stations d'Autriche, du Danemark ou de Roumanie, un avertissement explique la couverture partielle de ce pays (voir 6.4).

### 4.5 Fiche station

1. **Prix affichés** : seulement les prix hors quarantaine, dans l'ordre du référentiel.
   - Libellé « ancien » au-delà de 48 h.
   - Une rupture officielle s'affiche toujours. Une rupture communautaire s'affiche si elle date de moins de 12 h et qu'aucun prix plus récent que son début n'existe.
   - En rupture, le prix est barré.
   - Les ruptures définitives des carburants sans prix sont listées à part.
2. **Statut d'ouverture** (dans cet ordre) :
   - « ouvert 24 h/24 » pour un automate ;
   - « ouvert jusqu'à HH:MM » si ouvert avec une fermeture connue différente de l'ouverture ;
   - « ouvre à HH:MM » si fermé, que l'ouverture du jour n'est pas encore passée et que le jour n'est pas fermé ;
   - « fermé » si fermé ;
   - « ouvert 24 h/24 » si ouvert sans plage ;
   - sinon « horaires inconnus ».

   Bandeau d'avertissement pour une station fermée définitivement ou temporairement.
3. **Tendance** : écart entre le prix en vigueur maintenant et celui d'il y a 7 jours. Hausse au-delà de 0,01, baisse en deçà de −0,01, sinon stable ; rien si l'un des deux manque.
4. **Conseil** : pour le carburant du véhicule par défaut s'il est vendu, sinon le premier carburant vendu (algorithme en 4.6).
5. **Historique** :
   - périodes de 7, 30 ou 365 jours ;
   - la série de la station contient les changements de la période, précédés du dernier prix connu avant la période ;
   - la série de la zone est la médiane, pour chaque jour (chaque semaine au-delà de 60 jours), des prix en vigueur dans les stations actives ou temporairement fermées à moins de 10 km ; le prix en vigueur d'une station est son dernier point d'historique de moins de 30 jours.
6. **Seuil d'alerte proposé** : prix actuel moins 0,02, et au moins 0,1.

### 4.6 Conseil « faire le plein maintenant ou attendre »

Entrée : la série des changements de prix (un prix vaut jusqu'au suivant) sur 90 jours, d'abord celle de la station, sinon celle de la médiane quotidienne de sa zone. Le fuseau est celui du pays de la station.

1. **Pas de conseil** si la série a moins de 4 points.
2. **Prix journaliers** : on relève le prix en vigueur chaque jour à la même heure sur les 84 derniers jours (12 semaines). Moins de 28 jours disponibles : pas de conseil.
3. **Semaines** : on découpe en semaines commençant le lundi et on ne garde que les semaines complètes. Moins de 3 semaines complètes : pas de conseil.
4. **Profil hebdomadaire** : pour chaque semaine complète, on calcule l'écart de chaque jour à la moyenne de sa semaine. L'effet d'un jour est la moyenne de ses écarts.
   - Une semaine « a bougé » si son écart maximal dépasse 0,0005.
   - Si tous les effets sont nuls et que le prix n'a jamais changé : pas de conseil.
5. **Tendance** : pente des moindres carrés (prix par jour) sur les 14 derniers jours relevés.
6. **Meilleur jour** : pour k = 1, 2, 3 jours, la variation attendue vaut « effet du jour visé − effet d'aujourd'hui + pente × k ». On retient la variation la plus négative.
7. **Décision** : « attendre k jours » si la baisse attendue atteint au moins 0,01 par unité, sinon « maintenant ».
8. **Confiance** : on mesure la régularité, c'est-à-dire la part des semaines qui ont bougé dans lesquelles le jour visé était sous la moyenne.
   - Élevée : au moins 8 semaines et une régularité d'au moins 0,6.
   - Moyenne : au moins 5 semaines et une régularité d'au moins 0,4.
   - Sinon faible.
9. **Affichage** : jour conseillé et gain par unité (dans la devise du premier prix de la station), nombre de semaines, base utilisée (station ou zone) et confiance. Pour « maintenant », on ajoute « pas de baisse attendue dans les 3 prochains jours ».

### 4.7 Contributions et modération

1. **Contenu attendu par type** :

   | Type | Contenu |
   |---|---|
   | `outage` | un carburant |
   | `price` | un carburant et un prix entre 0,1 et 20 |
   | `closed` | `temporary` ou `permanent` |
   | `brand_change` | nom d'enseigne, 1 à 60 caractères après suppression des espaces |
   | `hours` | note libre, 3 à 500 caractères |
   | `missing_station` | nom (≤ 80, facultatif), enseigne (≤ 60, facultative), adresse (≤ 160, facultative), ville (≤ 80, facultative), pays (2 lettres, mises en majuscules), latitude et longitude valides |

   Tout type sauf `missing_station` exige une station.
2. **Médiane locale** d'un prix : médiane des prix de ce carburant, hors quarantaine, de moins de 7 jours, dans les stations à moins de 10 km de la station visée.
3. **Statut initial** :
   - réputation de l'auteur strictement inférieure à −5 : toujours en attente ;
   - rupture : publiée ;
   - prix : en attente s'il existe une médiane locale et que l'écart relatif au prix dépasse 15 %, sinon publié ;
   - fermeture, enseigne, horaires et station manquante : toujours en attente.
4. **Publication immédiate** : la contribution est appliquée (règle 6) et l'auteur gagne 1 point de réputation.
5. **Modération** : seules les contributions en attente peuvent être traitées ; le motif est coupé à 300 caractères.
   - Validation : la contribution est appliquée, son statut passe à `published` et l'auteur gagne 1 point.
   - Refus : statut `rejected`, l'auteur perd 3 points.
   - Dans les deux cas, l'auteur reçoit une notification (avec le motif en cas de refus) et l'action est auditée.
6. **Application** :
   - **rupture** : crée une rupture communautaire temporaire signalée par l'auteur ;
   - **prix** :
     - si le prix courant est officiel et date de moins de 24 h, rien ne change à l'affichage ; la contribution est seulement conservée ;
     - sinon le prix courant devient ce prix, de provenance communautaire, daté de maintenant, hors quarantaine. Sa devise est celle du prix courant existant, sinon GBP pour une station au Royaume-Uni, sinon EUR ;
     - les alertes sont évaluées, et un point d'historique est ajouté si le montant change ;
   - **fermeture** : statut de la station `closed` (définitive) ou `closed_temp` (temporaire) ;
   - **enseigne** : crée l'enseigne si besoin et l'attribue à la station avec la provenance `community`, que les sources ne remplaceront plus ;
   - **horaires** : aucun effet automatique, la note est lue par le modérateur ;
   - **station manquante** : crée une station dans la source communautaire (identifiant externe dérivé de l'identifiant de la contribution, enseigne `community` si fournie) et la rattache à la contribution.

### 4.8 Alertes de prix

1. **Création** : seuil entre 0,1 et 20.
   - Une alerte de portée `station` exige une station.
   - Une alerte de portée `area` exige un centre valide, un rayon de 1 à 50 km et un libellé de 160 caractères au plus.
   - Une alerte de portée `favorites` porte sur les favoris du moment.
2. **Meilleur prix** d'une alerte active : le plus bas prix courant du carburant, hors quarantaine, de moins de 7 jours, dans une station `active` couverte par la portée. Ce sont la station visée, les favoris de l'utilisateur, ou les stations situées dans le rayon autour du centre.
3. **Décision** :
   - aucun meilleur prix : rien ;
   - meilleur prix strictement sous le seuil, alerte armée et dernier déclenchement plus vieux que 24 h (ou absent) : **déclenchement** ;
   - meilleur prix supérieur ou égal au seuil alors que l'alerte est désarmée : **réarmement**.
4. **Déclenchement** :
   - l'alerte est désarmée et datée ;
   - une notification `price_alert` est créée (et envoyée en push si l'utilisateur a des appareils abonnés) ;
   - si l'utilisateur a choisi les alertes par email, un email part avec la station, le prix et un lien vers la fiche ; un échec d'email n'interrompt pas l'évaluation.
5. **Moment de l'évaluation** : après chaque ingestion qui a changé au moins un prix, et après chaque prix communautaire appliqué. Pas de minuterie.
6. **Pause et reprise** : la mise en pause rend l'alerte inactive ; la reprise la réactive et la réarme. Un utilisateur n'agit que sur ses propres alertes.

### 4.9 Véhicules

1. **Validation** :
   - nom de 1 à 60 caractères ;
   - carburant principal du référentiel ; l'interface masque l'AdBlue ;
   - carburant secondaire facultatif ; l'interface propose GPL, GNC ou E85 ;
   - capacité de 1 à 2 000 ;
   - consommation de 0,1 à 100.
2. **Véhicule par défaut** : un véhicule enregistré devient le véhicule par défaut s'il est demandé comme tel, si l'utilisateur n'en avait aucun, ou s'il est son unique véhicule. Tous ses autres véhicules perdent alors ce statut. Choisir un véhicule par défaut retire le statut aux autres. Supprimer le véhicule par défaut le transfère à un autre véhicule restant.
3. **Isolation** : un utilisateur ne lit et ne modifie que ses véhicules.

### 4.10 Journal de pleins

1. **Validation** :
   - véhicule appartenant à l'utilisateur, sinon erreur ;
   - quantité de 0,1 à 2 000 ;
   - montant de 0,01 à 100 000 ;
   - compteur entier de 0 à 5 000 000, facultatif ;
   - date au plus 24 h dans le futur ;
   - note de 200 caractères au plus.

   Le carburant est celui du véhicule. La devise est celle du prix courant de la station pour ce carburant, sinon EUR. L'interface propose comme minimum du compteur le dernier relevé connu.
2. **Consommation réelle** (méthode plein à plein) : on parcourt les pleins par date.
   - Le premier plein complet avec compteur sert d'ancre.
   - Les pleins suivants (partiels compris) cumulent quantité et montant.
   - Au plein complet suivant avec compteur, on obtient un segment : distance = écart de compteur, consommation = quantité cumulée / distance × 100. Ce plein devient la nouvelle ancre.
   - Un compteur inférieur ou égal à celui de l'ancre annule le segment en cours ; on repart de ce plein s'il est complet, sinon on attend une nouvelle ancre.
   - Un plein complet sans compteur annule le segment en cours.
3. **Statistiques** :
   - consommation moyenne = quantité des segments / distance des segments × 100 ;
   - coût aux 100 km = montant des segments / distance × 100 ;
   - prix moyen payé = montant total / quantité totale ;
   - dépenses et quantités par mois civil, du plus récent au plus ancien.

   Sans segment : « il faut au moins deux pleins complets avec kilométrage ».
4. **Appliquer la consommation réelle** : valeur arrondie au dixième, acceptée entre 0,5 et 100. Proposé quand l'écart relatif avec la valeur déclarée dépasse 5 %.
5. **Préremplissage depuis une station** : la station et son prix pour le carburant du véhicule sont repris ; le montant se calcule à la saisie de la quantité.

### 4.11 Favoris

L'ajout est idempotent. Sur la page des favoris, le carburant affiché est celui du véhicule par défaut, sinon le carburant par défaut des préférences, sinon B7. L'écart affiché est la différence entre le prix courant et le prix en vigueur il y a 24 h ; il n'apparaît qu'à partir de 0,001.

### 4.12 Devises

- **Stockage** : toutes les valeurs restent dans la devise de la source (EUR, sauf DKK au Danemark et RON en Roumanie).
- **Conversion** : si l'utilisateur choisit une devise d'affichage différente et que les deux taux existent, le montant est converti via l'euro et préfixé de « ≈ ». Une mention « converti au taux BCE du jour » apparaît au-dessus de la liste. Un taux manquant laisse le montant dans sa devise d'origine.
- **Devises proposées** : EUR, GBP, CHF, DKK, SEK, NOK, PLN, CZK, HUF, RON, ISK, USD.
- **Exceptions** : le graphique d'historique, le conseil et la modération restent en devise d'origine.

### 4.13 Administration

1. **Actions sur soi-même** : un administrateur ne peut ni changer son propre statut ni son propre rôle ; ses actions n'apparaissent pas sur sa propre ligne.
2. **Désactivation** : supprime toutes les sessions du compte.
3. **Validation d'un compte** : la réactivation d'un compte `pending_approval` lui envoie la notification `account_approved`.
4. **Emails** : l'envoi d'un lien de réinitialisation n'est proposé que pour un compte vérifié ; le renvoi de vérification seulement pour un compte non vérifié.
5. **Domaines autorisés** : la saisie est découpée sur les espaces, virgules et points-virgules, mise en minuscules, débarrassée d'un `@` initial et dédoublonnée.
6. **« Exécuter maintenant »** : lance le connecteur après la réponse à l'administrateur, hors de la file planifiée.
7. **Audit** : chaque action est tracée avec l'auteur, la cible et les données utiles.

   | Action | Code d'audit |
   |---|---|
   | Activation et désactivation de compte | `user.activate`, `user.disable` (avec le statut précédent) |
   | Changement de rôle | `user.role` |
   | Lien de réinitialisation | `user.reset_password` |
   | Renvoi de vérification | `user.resend_verification` |
   | Paramètres d'instance | `settings.update` |
   | Activation d'une source | `source.enable` |
   | Lancement d'une source | `source.run` |
   | Lancement de l'enrichissement des enseignes | `osm.run` |
   | Modération | `contribution.approve`, `contribution.reject` |
8. **Santé d'un connecteur** :
   - vert si aucun échec consécutif et au moins un succès ;
   - rouge à partir de 3 échecs consécutifs ;
   - orange sinon.

   La dernière exécution affichée est la plus récente parmi les 60 dernières toutes sources confondues.

### 4.14 Notifications push

- **Types envoyés** : seuls `price_alert` (ouvre la fiche de la station) et `account_pending_approval` (ouvre l'administration filtrée sur les comptes en attente) partent en push, en plus de la notification dans l'application.
- **Message** : titre « Jauge », texte traduit dans la langue du compte, durée de vie de 1 heure.
- **Abonnements** : un abonnement que le service push déclare disparu (codes 404 ou 410) est supprimé.
- **Sans configuration** : si les clés push ne sont pas configurées, rien n'est envoyé et l'interface indique que le push est indisponible.

### 4.15 Erreurs et cas limites

- **Paramètres invalides** : une recherche ou un historique avec des paramètres invalides répond 400 avec le détail ; une adresse de station non numérique répond 400 (API) ou « page introuvable » (fiche).
- **Itinéraire** : un échec du routage répond 502 « ROUTING_FAILED » ; l'interface affiche « calcul impossible ».
- **Géocodage** : moins de 2 caractères renvoie une liste vide ; une panne du service renvoie une liste vide avec le statut 502 ; l'interface affiche « aucun résultat ».
- **Recherche côté navigateur** : une erreur affiche un message ; un 401 renvoie à la connexion ; la requête précédente est annulée quand une nouvelle part (attente de 200 ms avant envoi).
- **Emails** : sans service d'envoi configuré, l'email est écrit dans le journal du serveur (développement). Une réponse d'erreur du service produit l'erreur « l'email n'a pas pu être envoyé ».
- **Entrées libres** : le contenu des emails est échappé. Les cellules CSV qui commencent par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot sont préfixées d'une apostrophe (protection contre l'injection de formules).

---

## 5. Interfaces

### 5.1 Principes d'écran

- **Mobile d'abord** : cibles tactiles d'au moins 44 px, champs en 16 px sur mobile (pour éviter le zoom automatique), actions principales dans la moitié basse de l'écran.
- **Navigation mobile** : barre d'onglets en bas avec Carte, Itinéraire, Favoris, Alertes et « Plus ». « Plus » ouvre un panneau avec Notifications, Journal, Véhicules, Réglages, Modération (modérateurs et administrateurs), Administration (administrateurs), À propos et Déconnexion. Le nombre de notifications non lues apparaît en pastille sur « Plus ».
- **Navigation sur bureau** : barre en haut avec logo, liens (sans Notifications ni À propos), cloche des notifications avec pastille, déconnexion.
- **Thème** : clair, sombre ou système. Neutres légèrement chauds, accent vert pétrole. Trois couleurs d'état (bas = vert, moyen = ambre, élevé = rouge) et un gris « sans prix ». Une couleur est toujours doublée d'un libellé. Les listes déroulantes natives et les cases à cocher suivent le thème.
- **Typographie** : une famille sans empattement pour le texte et une famille à chasse fixe et chiffres tabulaires pour les prix.
- **Accessibilité** : WCAG 2.1 AA, mouvement réduit respecté, navigation au clavier sur bureau.

### 5.2 Écrans d'authentification

Gabarit commun : logo, nom et accroche, sélecteur de langue, carte centrale.

- **Connexion** :
  - bouton Google (si configuré) puis « ou » ;
  - email, mot de passe ;
  - message d'erreur traduit selon le code ;
  - lien « renvoyer l'email de vérification » après une erreur « email non vérifié » ;
  - liens « mot de passe oublié » et « créer un compte » ;
  - affiche aussi une erreur transmise par l'adresse (retour Google).
- **Inscription** :
  - bouton Google ;
  - nom affiché (80 caractères au plus), email, mot de passe (indication « 12 caractères minimum ») ;
  - après envoi, le formulaire est remplacé par « un email de vérification vient d'être envoyé à … (valable 24 h) ».
- **Mot de passe oublié** : email, puis message neutre « si un compte existe… lien valable 1 h ».
- **Nouveau mot de passe** :
  - lien sans jeton ou en erreur : « lien invalide ou expiré » ;
  - succès : « mot de passe modifié » et lien vers la connexion.
- **Atterrissage de vérification** :
  - erreur : « lien invalide ou expiré » et bouton vers la connexion ;
  - succès : « adresse vérifiée » et bouton de connexion, ou « en attente de validation » sans bouton si l'instance exige la validation.

### 5.3 Carte (écran d'accueil)

- **Mobile** :
  - carte plein écran ;
  - champ de recherche de lieu et bouton « Autour de moi » flottants en haut ;
  - panneau de résultats coulissant en bas, à trois hauteurs (34 %, 58 %, presque plein) : toucher la poignée fait passer à la hauteur suivante, la glisser ajuste puis se cale sur la plus proche.
- **Bureau** : colonne de 420 px à gauche (recherche puis résultats), carte à droite avec boutons de zoom.
- **Carte** :
  - points colorés selon la classe (gris si sans classe ou en rupture), prix affiché au-dessus des points à partir d'un zoom de ville ;
  - point bleu pour la position de l'utilisateur ;
  - anneau autour de la station mise en évidence ;
  - bouton de recentrage ;
  - bouton « Rechercher dans cette zone » après un déplacement manuel, avec un rayon ramené entre 2 et 50 km.
- **En-tête du panneau** :
  - nombre de stations (ou « chargement ») et médiane de la zone ;
  - rangée défilante de pastilles : véhicule (si plusieurs), carburant, tri (meilleur choix, prix au litre, prix du plein, distance), rayon (2, 5, 10, 20, 30, 50) ;
  - bouton Filtres avec le nombre de filtres actifs.
- **Panneau des filtres** : curseur du niveau de réservoir, six cases de filtres, puces de services, puces d'exclusion d'enseignes (enseignes présentes dans les résultats), bouton « Voir les stations ».
- **Liste**, dans l'ordre :
  - bandeau hors ligne avec la date des données ;
  - mention de conversion de devise ;
  - avertissements de couverture partielle ;
  - erreur ;
  - état vide « aucune station ne correspond, élargissez le rayon ou retirez des filtres » ;
  - les stations ;
  - lien « Une station manque ? ».
- **Ligne d'une station** :
  - enseigne ou nom ou ville, cœur si favori, adresse ;
  - prix et unité, ou « pas de prix récent » ;
  - pastille de classe (bas, moyen, élevé, sans prix), « rupture temporaire » si en rupture, ou « données datant de N jours » pour un prix trop ancien affiché en gris ;
  - distance, « fermé » si fermé, ancienneté du prix (avec « ancien » et « communauté ») ;
  - coût du plein, détour (distance, coût, minutes ou « estimé »), économie en vert.
- **Mémorisation** : le niveau du réservoir est retenu pour la session du navigateur, la dernière zone dans le navigateur. Le filtre « inclure les prix anciens » démarre coché si la préférence « afficher les prix trop anciens » est active.

### 5.4 Fiche station

En-tête (nom, sous-nom, mention « enseigne issue d'OpenStreetMap », adresse, statut d'ouverture coloré, type de voie), bouton favori.

Actions de navigation :
- **mobile** : barre fixe en bas avec « Y aller · application préférée » et favori, plus des liens vers les autres applications ;
- **bureau** : bouton principal et liens secondaires.

Sections, dans l'ordre :
1. bandeaux de fermeture ;
2. prix ;
3. conseil (fond vert pour « maintenant », ambre pour « attendre ») ;
4. historique (sélecteur de carburant, boutons de période, légende station et zone, graphique, tableau repliable des 60 derniers changements) et lien d'export ;
5. « J'ai fait le plein ici » ;
6. création d'alerte ;
7. panneau de signalement à onglets (Prix, Rupture, Fermeture, Enseigne, Horaires et services) ; les carburants proposés sont ceux vendus, sinon tous sauf l'AdBlue ;
8. horaires (tableau des jours, jour courant en gras, « 24 h » ou « fermé ») ;
9. services ;
10. source et licence.

États vides : « pas de prix récent », « horaires inconnus ». Une station inconnue mène à une page introuvable.

### 5.5 Itinéraire

- **Formulaire** :
  - départ, étapes ajoutables et supprimables (3 au plus), arrivée, avec suggestions ;
  - véhicule, curseur du niveau de départ ;
  - options repliables (réserve, couloir, péages, autoroutes) ;
  - bouton « Calculer », désactivé tant que départ et arrivée manquent.
- **Après calcul** :
  - résumé « départ → arrivée », distance, durée et nombre de candidates, bouton « Modifier » ;
  - onglets de stratégie avec une phrase d'aide ;
  - trois chiffres (coût total, quantité, économie) ;
  - liste numérotée des arrêts avec lien de navigation pour chacun ;
  - carburant restant à l'arrivée ;
  - boutons « Ouvrir dans Google Maps » et « Partager » (puis « copié »).
- **Carte** : tracé et arrêts ; sur mobile, elle n'apparaît qu'avec un itinéraire calculé.
- **États** : « aucun arrêt nécessaire », « plan impossible avec ces réglages », « calcul impossible ».
- **Adresse partageable** : départ, arrivée, étapes, stratégie, niveau, réserve, couloir, péages, autoroutes.

### 5.6 Autres écrans

- **Favoris** :
  - titre, lien d'export (s'il y a des favoris), carburant utilisé ;
  - liste (nom, adresse, ancienneté, prix, écart 24 h coloré, bouton retirer) ;
  - bandeau « retiré · annuler » ;
  - état vide.
- **Alertes** :
  - liste (carburant < seuil, portée et lien, dernier déclenchement ou « jamais »), avec pause, reprise et suppression ; une alerte en pause apparaît atténuée ;
  - formulaire de création (favoris ou zone, lieu, rayon, carburant par défaut, seuil) ;
  - rappel de l'état des alertes email avec lien vers les réglages ;
  - état vide.
- **Notifications** : liste (texte traduit, lien vers la station, ancienneté) ; les non lues sont mises en valeur ; état vide.
- **Journal** :
  - sans véhicule : message et bouton « ajouter un véhicule » ;
  - sinon : sélecteur de véhicule (si plusieurs), lien d'export, trois statistiques, suggestion d'appliquer la consommation réelle, dépenses mensuelles repliables, formulaire d'ajout, historique (date, mention « partiel », quantité, prix unitaire, compteur, station, note, montant, suppression), état vide.
- **Véhicules** : liste (nom, mention « par défaut », carburants, capacité, consommation), « rendre par défaut », modifier, supprimer, formulaire. Le formulaire est ouvert d'office s'il n'y a aucun véhicule.
- **Réglages** : langue, formulaire des préférences (« enregistré » après succès), bloc notifications push (activé, désactivé, refusé par le navigateur ou indisponible), lien « À propos ».
- **Signaler une station manquante** : recherche d'adresse, puis position avec lien OpenStreetMap et formulaire (nom, enseigne, adresse préremplie, ville, pays parmi FR, ES, IT, PT, BE, LU, MC, AD, DE, AT, SI, HR, DK, RO, GB, CH, NL), puis message de résultat.
- **Modération** : cartes de contributions avec actions (motif, valider, refuser) ; état vide.
- **Administration**, quatre onglets :
  - **Comptes** : recherche, filtre de statut, tableau avec actions (valider, désactiver, réactiver, rôle, réinitialisation ou renvoi de vérification, coche de confirmation) ;
  - **Paramètres** : domaines autorisés et validation obligatoire ;
  - **Connecteurs** : une ligne par source avec pastille de santé, dernier succès relatif, dernière exécution (statut, stations, prix, durée), échecs, erreur, case « activé », bouton « exécuter maintenant » (puis « en file ») ; une ligne pour l'enrichissement des enseignes FR ;
  - **Audit**.
- **À propos** : texte, sources, mention OpenStreetMap.

### 5.7 Fonctionnement hors ligne et installation

- **Manifeste** : nom « Jauge », affichage autonome, fond clair, couleur de thème vert pétrole, icône vectorielle.
- **Travailleur de service** (production seulement) :
  - ressources statiques versionnées : cache d'abord ;
  - API de recherche : réseau d'abord ; chaque réponse est mise en cache avec sa date et gardée comme « dernière recherche » ; hors ligne, la réponse en cache (ou la dernière recherche) est servie avec un en-tête portant la date des données, sinon une erreur 503 « OFFLINE » ;
  - pages Carte et Favoris : réseau d'abord, copie hors ligne ;
  - tuiles de carte : cache d'abord, 1 500 tuiles au plus ;
  - affiche les notifications push et ouvre ou focalise la page associée au clic.
- **Développement** : un travailleur de service resté installé est désinstallé et ses caches vidés.
- **Écran de lancement** : environ 1,5 seconde, une fois par onglet. La jauge du logo se remplit, puis l'écran s'efface. Mouvement réduit : affichage fixe puis fondu.

### 5.8 Points d'entrée d'API

Toutes les réponses sont en JSON sauf les CSV. Sans session valide : 401 `{ "error": "UNAUTHORIZED" }` (texte « UNAUTHORIZED » pour les CSV).

**`GET /api/stations`** — recherche (règles 4.4).
- **Paramètres** :

  | Paramètre | Valeur |
  |---|---|
  | `lat`, `lon` | obligatoires |
  | `radius` | 1 à 50, 10 par défaut |
  | `fuel` | code obligatoire |
  | `sort` | `best`, `price`, `fill` ou `distance` |
  | `level` | 0 à 1, 0,25 par défaut |
  | `vehicleId` | facultatif |
  | `onlySelling`, `hideOutages`, `openNow`, `automat24`, `includeOld`, `favoritesFirst` | `0` ou `1` |
  | `brands`, `excludeBrands` | listes d'identifiants séparés par des virgules |
  | `services` | liste de clés séparées par des virgules |

- **Réponse 200** : `{ stations: [...], median: nombre | null }`, cacheable 60 s pour l'utilisateur seulement.
- **Champs d'une station** : identifiant, nom, identifiant et nom d'enseigne, provenance de l'enseigne, adresse, ville, pays, latitude, longitude, distance (km), statut, automate, services, favori, prix (ou null), devise, date du prix (ISO), provenance, fraîcheur (`fresh`, `stale`, `excluded` ou null), rupture, ouvert maintenant (vrai, faux ou null), classe (0, 1, 2 ou null), coût du plein, détour (km), coût du détour, détour estimé (booléen), minutes de détour (ou null), coût total, économie.
- **Réponse 400** : `{ error: "BAD_REQUEST", issues: [...] }`.

**`POST /api/route`** — plan carburant.
- **Corps** :

  | Champ | Valeur |
  |---|---|
  | `points` | liste de 2 à 5 couples `{ lat, lon }` (départ, étapes, arrivée) |
  | `vehicleId`, `fuel` | facultatifs ; carburant par défaut : véhicule, puis préférence, puis B7 |
  | `startLevel` | 0 à 1, 0,25 par défaut |
  | `reserve` | 0,05 à 0,5, 0,15 par défaut |
  | `corridorKm` | 1 à 20, 5 par défaut |
  | `avoidTolls`, `avoidHighways` | faux par défaut |

- **Réponse 200** : `{ route: { coords: [[lon, lat]...] (3 000 points au plus), km, minutes }, median, candidates, plans: { cheapest, balanced, fewest } }`. Chaque plan vaut null s'il est impossible, sinon `{ feasible, stops, amount, fuelCost, endFuel, saving }`. Champs d'un arrêt : identifiant, libellé, adresse, ville, latitude, longitude, devise, kilomètre sur le trajet, prix, détour (km), quantité, coût, carburant à l'arrivée.
- **Réponse 400** : `{ error: "BAD_REQUEST" }`.
- **Réponse 502** : `{ error: "ROUTING_FAILED" }`.

**`GET /api/geocode?q=…&lang=…`**
- **Paramètres** : `lang` vaut `fr`, `en`, `de` ou `it` ; sinon la langue par défaut du service.
- **Réponse 200** : jusqu'à 6 résultats `[{ label, lat, lon }]`, types de lieu ville, rue, adresse, localité ou quartier. Le libellé assemble nom (ou numéro et rue), code postal, ville si différente du nom, et pays.
- **Requête trop courte** : `[]` pour moins de 2 caractères.
- **Réponse 502** : `[]` si le service est en panne.

**`GET /api/stations/{id}/history?fuel=…&days=7|30|365`**
- **Réponse 200** : `{ station: [[instant ms, prix]...], zone: [[instant ms, prix]...] }`, cacheable 300 s.
- **Réponse 400** : identifiant ou paramètres invalides.

**`GET /api/stations/{id}/history.csv`** : colonnes `valid_from`, `fuel`, `price`, `currency` sur 365 jours, triées par carburant puis date. 400 si l'identifiant est invalide.

**`GET /api/favorites.csv`** : colonnes `station_id`, `station`, `address`, `city`, `country`, `lat`, `lon`, `fuel`, `price`, `currency`, `updated_at`, `origin`. Une ligne par favori et par prix hors quarantaine, favoris les plus récents d'abord.

**`GET /api/log.csv?v={véhicule}`**
- **Colonnes** : `date`, `fuel`, `amount`, `unit_price` (3 décimales), `total_cost` (2 décimales), `currency`, `odometer_km`, `full_tank` (1 ou 0), `station`, `note`, par date croissante.
- **Réponse 404** : véhicule inconnu ou d'un autre utilisateur.

**Format CSV commun** : séparateur point-virgule, fin de ligne CRLF, marque d'ordre des octets UTF-8 en tête (pour les tableurs européens), guillemets doublés si nécessaire, protection contre les formules (4.15), téléchargement en pièce jointe avec un nom de fichier explicite.

**`GET /api/health`** : `{ ok: true }` si la base répond, sinon 503 `{ ok: false }`. Public.

**Authentification `/api/auth/...`** (public) : inscription par email, connexion par email, déconnexion, vérification d'email (le lien du message ; il redirige toujours vers la page d'atterrissage de vérification), renvoi de vérification, demande de réinitialisation, réinitialisation, connexion Google et retour Google (`/api/auth/callback/google`). Les erreurs portent un code parmi `INVALID_EMAIL_OR_PASSWORD`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_DISABLED`, `SIGNUP_NOT_ALLOWED`, `EMAIL_NOT_VERIFIED_BY_PROVIDER`, `USER_ALREADY_EXISTS`, `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_COMMON`, `MAIL_SEND_FAILED`, ou le statut 429. L'interface traduit chaque code et affiche un message générique sinon.

**Opérations de modification** (exposées sous la forme la plus naturelle pour la pile choisie, toujours authentifiées et limitées aux données de l'utilisateur) :

| Domaine | Opérations |
|---|---|
| Favoris | ajouter ou retirer |
| Véhicules | enregistrer, rendre par défaut, supprimer |
| Préférences | enregistrer (fusion avec l'existant, validation 3.1) |
| Langue | changer |
| Contributions | soumettre (renvoie `published` ou `pending`) |
| Notifications | tout marquer comme lu |
| Alertes | créer, activer ou mettre en pause, supprimer |
| Push | enregistrer ou supprimer un abonnement (adresse valide de 1 000 caractères au plus, clés bornées) |
| Journal | ajouter ou supprimer un plein, appliquer la consommation réelle |
| Administration (admin) | changer le statut ou le rôle d'un compte, envoyer une réinitialisation, renvoyer une vérification, enregistrer les paramètres, activer une source, lancer une source, lancer l'enrichissement des enseignes |
| Modération (modérateur ou admin) | traiter une contribution |

---

## 6. Contraintes techniques

### 6.1 Contraintes réelles

- **Base relationnelle avec calcul géospatial** : les fonctions principales reposent sur des requêtes spatiales en base, avec un index spatial :
  - distance géodésique et recherche dans un rayon ;
  - recherche le long d'une ligne (couloir d'itinéraire), position relative d'un point sur la ligne et distance au tracé ;
  - plus proche voisin à moins de 50 m.

  Il faut aussi des médianes (centile 50) dans les requêtes. La première version utilise PostgreSQL avec PostGIS ; tout équivalent offrant ces opérations convient.
- **Deux processus** : un serveur web et un processus d'arrière-plan qui exécute les ingestions planifiées (crons en UTC), les taux de change et l'enrichissement des enseignes. Ce processus doit exister une seule fois. Il applique les migrations de schéma et crée les référentiels au démarrage.
- **Instance web unique** tant que le cache de rafraîchissement roumain reste en mémoire ; sinon, il faut le déplacer en base.
- **HTTPS obligatoire** en production (notifications push, géolocalisation, cookies sécurisés, travailleur de service). La première version tourne derrière un proxy inverse qui gère le TLS et transmet hôte et protocole d'origine. L'URL publique doit être configurée pour que les liens des emails et le retour Google soient corrects.
- **En-têtes de sécurité en production** : interdiction du reniflage de type de contenu, intégration en cadre limitée à la même origine, politique de référent « origine stricte en cross-origin ». Le fichier du travailleur de service est servi sans cache.
- **Sortie** : les prix restent dans la devise de la source ; aucune donnée de position utilisateur n'est stockée.
- **Journalisation des appels sortants** : chaque appel HTTP sortant (app et processus d'arrière-plan) écrit une ligne structurée : méthode, URL, statut ou erreur, durée. Les valeurs des paramètres dont le nom évoque une clé, un jeton, un secret, un mot de passe, une authentification ou une signature sont masquées.

### 6.2 Intégrations externes

| Besoin | Service | Remplaçable par |
|---|---|---|
| Géocodage (recherche de lieu, géocodage des adresses Q8/F24 au Danemark) | Photon (OpenStreetMap), instance publique par défaut | Tout géocodeur ; Photon auto-hébergé recommandé en production |
| Routage : itinéraire avec évitement des péages et des autoroutes, géométrie encodée ; matrice de distances et durées depuis un point | Valhalla, instance publique par défaut | Tout moteur offrant les deux fonctions et l'évitement |
| Fond de carte vectoriel | Style « positron » d'OpenFreeMap, sans clé | Tout style de tuiles vectorielles |
| Emails transactionnels | API d'envoi Brevo (expéditeur nommé) | Tout service d'envoi |
| Notifications push | Web Push avec clés VAPID | — (standard du navigateur) |
| Taux de change | Fichier quotidien de la BCE (base EUR) | — |
| Enseignes FR et stations BE, LU, MC | API Overpass d'OpenStreetMap | Extrait OpenStreetMap |

### 6.3 Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| URL de base de données | oui | Base avec extension géospatiale |
| Secret de session (32 caractères au moins) | oui | Signature des sessions et jetons |
| URL publique | oui | Liens des emails et des alertes, retour OAuth |
| Email et mot de passe de l'administrateur initial | recommandé | Création du premier administrateur |
| Identifiant et secret Google | non | Active la connexion Google |
| Clé du service d'email, expéditeur (« Nom \<adresse\> ») | non en dev | Sans clé, emails écrits dans le journal |
| URL du géocodeur, du style de carte, du routeur | non | Instances auto-hébergées |
| Clé publique VAPID (exposée au navigateur), clé privée, sujet (mailto) | non | Active le push |
| Clé Tankerkönig, zones allemandes (« lat,lon;lat,lon… ») | non | Active et délimite l'Allemagne |
| Fenêtre d'import de l'historique français (jours, 365 par défaut) | non | Import ponctuel des archives |
| Activation du travailleur de service en développement | non | Tests hors ligne en dev |

### 6.4 Sources de données par pays (contrat avec l'extérieur)

Ces sources sont imposées par la réalité : ce sont les publications officielles disponibles. Planifications en UTC.

| Pays | Source et accès | Fréquence | Points d'attention |
|---|---|---|---|
| FR | Flux instantané avec ruptures de prix-carburants.gouv.fr (archive ZIP contenant un XML en ISO-8859-1) | 10 min | Coordonnées parfois multipliées par 100 000. Horaires par jour (une plage). Ruptures temporaires ou définitives (sans date de fin = en cours). Fermeture temporaire ou définitive. Type de voie (autoroute ou route). Automate 24/24. Services à traduire. Prix datés de leur dernier changement, heure de Paris. Pas d'enseigne (enrichie via OpenStreetMap). Carburants : Gazole → B7, SP95 → E5, SP98 → E5_98, E10, E85, GPLc → LPG. |
| ES | API REST du ministère (MITECO), JSON | 30 min | Une seule date d'extraction globale (heure de Madrid) pour tous les prix. Décimales à virgule. Horaires interprétés seulement s'ils couvrent toute la semaine (une plage, ou « 24H »). Douze carburants dont GNC, GNL, hydrogène, AdBlue, diesel renouvelable (XTL). Enseigne = libellé commercial. |
| IT | Deux CSV quotidiens du MIMIT (stations ; prix de 8 h), séparateur « \| », deux lignes d'en-tête | quotidien 9 h 30 | Lignes malformées ignorées. Prix libre-service préféré au prix servi, puis le moins cher. Dénominations commerciales regroupées (premium → B7_PREMIUM ou E5_98, HVO → XTL, méthane → CNG). « Pompe Bianche » = sans enseigne. Type de voie. |
| PT | API de la DGEG, un appel par district (18, continent) | 2 h | Produit « especial » pris seulement si le produit simple manque, sauf le gazole spécial (→ B7_PREMIUM). Prix entre 0,3 et 5. Marque « Genérico » = sans enseigne. Autoroute ou route. |
| AD | Couche cartographique publique du gouvernement d'Andorre | 2 h | Une ligne par station et produit. Position = centre de l'emprise. Prix entre 0,3 et 5. Les distributeurs de fioul seuls (sans carburant routier) sont exclus. |
| AT | API publique E-Control, par district et par carburant (gazole, super, GNC) | 1 h | La loi ne publie que les moins chères par district : **couverture partielle**, signalée. Pas de date par prix (date de récupération). Horaires par jour, « 24:00 » = minuit. |
| DE | API Tankerkönig (MTS-K), clé gratuite, recherche par rayon de 25 km sur les zones configurées | 15 min | Seulement gazole, E5, E10. Pas de date par prix. Désactivée sans clé. Intervalle minimal demandé par l'opérateur. |
| SI | API JSON paginée de goriva.si et liste des enseignes | 3 h | Pas de date par prix. 0,001 = valeur vide. « 98 » prime sur « 100 » pour E5_98. Nom d'enseigne débarrassé de la forme sociale. Ouvert 24 h détecté dans le texte des horaires. |
| HR | Fichier national compressé du ministère croate | 2 h | Latitude et longitude parfois inversées (corrigées selon la plage plausible). Gazole : le moins cher → B7, le plus cher → B7_PREMIUM. Prix au-delà de 4 ignorés. Horaires par type de jour (ouvrés, samedi, dimanche), plages coupées fusionnées. Options → services et 24 h. |
| DK | API publiées par les enseignes (obligation légale) : OK, Shell, Q8/F24 | 1 h | Prix en **DKK**. « 95 » = E10, E5 nommé explicitement, HVO → XTL, gazole extra ou premium → B7_PREMIUM. Q8/F24 sans coordonnées : géocodage de l'adresse une seule fois (code postal vérifié, une requête par seconde), positions réutilisées ensuite. F24 = automate. Circle K et Uno-X absents : **couverture partielle**, signalée. |
| RO | API du Monitorul Prețurilor, recherche par cercle de 5 km, un produit par requête, 50 résultats au plus | 2 h (12 grandes villes) + à la demande (4.2.14) | Prix en **RON**. Réponse JSON seulement si demandée. Date portée par la station. **Couverture partielle**, signalée. |
| BE, LU, MC | Stations OpenStreetMap | hebdomadaire (lundi 5 h) | Pas de prix officiels. Stations désaffectées exclues. Services et 24/7 déduits des étiquettes. |

### 6.5 Choix d'opportunité du premier auteur (libres)

Framework web à rendu serveur et composants React ; bibliothèque d'authentification avec tables en base ; ORM ; file de tâches stockée dans PostgreSQL ; bibliothèque cartographique WebGL ; traduction par fichiers de messages ; service d'email Brevo ; image Docker en deux étapes avec serveur autonome et processus d'arrière-plan empaqueté ; algorithme de hachage argon2id natif ; graphique SVG fait maison ; travailleur de service écrit à la main ; polices IBM Plex Sans et Mono. Aucun de ces choix ne conditionne le comportement.

---

## 7. Critères d'acceptation

### Authentification et comptes
1. Une inscription avec un mot de passe de 11 caractères est refusée ; avec « password1234 » elle est refusée comme trop courante.
2. Si la liste des domaines autorisés contient `exemple.eu`, une inscription en `@autre.com` est refusée avec un message explicite, par email comme par Google.
3. Après inscription, la connexion est refusée avec le code `EMAIL_NOT_VERIFIED` tant que le lien n'est pas cliqué.
4. Cliquer deux fois sur le même lien de vérification affiche une erreur la seconde fois.
5. Avec la validation obligatoire, un compte vérifié reçoit `ACCOUNT_PENDING_APPROVAL` à la connexion, et chaque administrateur a une notification `account_pending_approval`.
6. Un compte désactivé perd immédiatement l'accès : ses sessions sont supprimées et une nouvelle connexion est refusée avec `ACCOUNT_DISABLED`.
7. La demande de réinitialisation affiche le même message pour une adresse inconnue et pour une adresse connue.
8. La onzième tentative de connexion en 15 minutes depuis la même adresse IP reçoit 429.
9. Sans session, `GET /api/stations` répond 401 et `/favorites` redirige vers `/login?next=/favorites`.
10. Un utilisateur sans rôle qui ouvre `/admin` ou `/moderation` est renvoyé sur la carte.
11. Au premier démarrage avec un email et un mot de passe d'administrateur, un compte administrateur actif existe ; au second démarrage, aucun doublon n'est créé.

### Ingestion
12. Ingérer deux fois le même lot ne crée aucun prix ni aucun point d'historique supplémentaire.
13. Un prix égal à 3,5 fois la médiane du lot pour son carburant est en quarantaine, n'apparaît nulle part et n'est pas historisé.
14. Une station aux coordonnées (0, 0) n'est pas importée.
15. Un lot contenant deux fois le même identifiant externe est ingéré sans erreur, avec une seule station.
16. Une station absente de sa source depuis 31 jours a le statut `inactive` et n'apparaît plus dans les recherches.
17. Une enseigne validée par la modération n'est pas remplacée par l'enseigne de la source à l'ingestion suivante.
18. Un prix communautaire saisi après le dernier prix officiel n'est pas écrasé par un prix officiel plus ancien.
19. Après trois échecs consécutifs d'une source, les administrateurs reçoivent `connector_failing` une seule fois.

### Recherche et coûts
20. Pour un réservoir de 50 L au quart plein, la quantité à ajouter est 37,5 L.
21. Une station à 10 km à vol d'oiseau a un détour estimé de 26 km libellé « estimé » (si le routage est indisponible).
22. Une station sans prix pour le carburant demandé n'apparaît pas quand « seulement les stations qui vendent » est actif.
23. Une station à 1,780 à 15 km est classée après une station à 1,800 à 1 km en « meilleur choix », et avant en « prix au litre ».
24. Avec l'âge maximal par défaut, un prix de 11 jours est affiché avec « ancien » et un prix de 19 jours est écarté. Avec « inclure les prix anciens », ce dernier apparaît après les prix récents, sans classe ni coût, avec « données datant de 19 jours ».
25. Avec un âge maximal réglé à 1 jour, un prix de 3 jours est écarté.
26. Un prix en quarantaine n'apparaît pas ; « masquer les ruptures » écarte une station en rupture.
27. « Ouvert maintenant » conserve une station aux horaires inconnus et écarte une station fermée à l'heure locale de son pays.
28. Une plage 22:00-06:00 est ouverte à 23 h et à 3 h, fermée à 12 h ; 00:00-00:00 est ouvert toute la journée.
29. Les classes de prix répartissent les prix récents en trois tiers et la médiane affichée correspond aux prix récents hors rupture.
30. Une recherche autour d'une adresse roumaine déclenche la consultation de la source roumaine au plus une fois toutes les 2 heures pour une même cellule, et la réponse arrive en moins de 7 secondes même si la source est lente.

### Fiche station, historique, conseil
31. Une rupture communautaire disparaît dès qu'un prix plus récent que son début est ingéré.
32. La tendance vaut « hausse » si le prix actuel dépasse de plus de 0,01 celui d'il y a 7 jours.
33. Le conseil n'apparaît pas pour une station ayant moins de 4 changements de prix et dont la zone n'en a pas assez non plus.
34. Pour une série où le prix baisse chaque samedi de 0,04 depuis 12 semaines, le conseil un jeudi est « attendre samedi », avec un gain d'environ 0,04 et une confiance élevée.
35. L'export d'historique produit un CSV qui s'ouvre correctement accentué dans un tableur européen, avec point-virgule comme séparateur.

### Contributions et modération
36. Un prix communautaire à 1,20 alors que la médiane locale est 1,75 part en modération et n'est pas visible avant validation.
37. Un prix communautaire proche de la médiane est publié immédiatement si le prix officiel a plus de 24 h ; si le prix officiel a moins de 24 h, la contribution est publiée mais l'affichage ne change pas.
38. Une rupture signalée est publiée immédiatement ; une fermeture, une enseigne, des horaires ou une station manquante passent toujours en modération.
39. Un auteur à −6 de réputation voit toutes ses contributions passer en modération.
40. Un refus retire 3 points à l'auteur et lui envoie une notification avec le motif ; une validation ajoute 1 point.
41. Une station manquante validée apparaît dans les recherches à la position fournie.

### Alertes et notifications
42. Une alerte à 1,700 se déclenche quand le meilleur prix couvert passe à 1,699, une seule fois en 24 h, puis se réarme quand le prix repasse à 1,700 ou plus.
43. Un prix de plus de 7 jours ne déclenche pas d'alerte.
44. Avec les alertes email activées, un déclenchement envoie un email contenant un lien vers la fiche de la station.
45. Ouvrir la page Notifications remet le compteur de non lues à zéro.

### Itinéraire
46. Pour un trajet plus court que l'autonomie (au-dessus de la réserve), les trois stratégies proposent zéro arrêt.
47. Aucun plan proposé ne fait passer le carburant sous la réserve à un arrêt ou à l'arrivée, ni ne dépasse la capacité du réservoir.
48. « Équilibré » ne propose jamais plus de 2 arrêts ; « coût minimal » ne coûte jamais plus que « équilibré », pénalité de 0,5 par arrêt comprise.
49. Si aucune station n'est atteignable, la stratégie affiche « plan impossible ».
50. L'adresse partagée d'un itinéraire, ouverte dans un autre navigateur connecté, relance le même calcul.

### Journal, véhicules, favoris
51. Pleins complets à 10 000 km puis 10 600 km (36 L), avec un plein partiel de 10 L entre les deux : consommation de (10 + 36) / 600 × 100 ≈ 7,67 L/100 km.
52. Un compteur qui recule n'aboutit à aucune consommation aberrante.
53. Un plein daté de plus de 24 h dans le futur est refusé.
54. Le premier véhicule créé est le véhicule par défaut ; supprimer le véhicule par défaut transfère ce statut à un autre.
55. Retirer un favori puis appuyer sur « Annuler » dans les 5 secondes le rétablit.

### Devises, langues, hors ligne
56. Avec la devise d'affichage CHF, un prix danois en DKK s'affiche converti, préfixé de « ≈ », avec la mention de conversion.
57. Changer la langue en allemand traduit l'interface ; les emails suivants de ce compte sont en allemand.
58. Hors ligne, la carte affiche la dernière recherche avec la date des données et un bandeau hors ligne.
59. Une notification push d'alerte ouvre la fiche de la station au clic.

### Sécurité
60. Un utilisateur ne peut lire ni modifier les véhicules, pleins, alertes ou favoris d'un autre : les opérations visant l'identifiant d'un autre n'ont aucun effet et l'export du journal répond 404.
61. Une note de plein commençant par « =SOMME » est exportée préfixée d'une apostrophe.
62. Les journaux d'appels sortants ne contiennent jamais la valeur d'un paramètre `apikey`.

---

## 8. Points à confirmer par l'auteur

1. **Âge maximal des prix non appliqué partout** : la médiane locale qui décide de la modération d'un prix et l'évaluation des alertes utilisent toujours une limite fixe de 7 jours, alors que la recherche, la fiche et l'itinéraire suivent le réglage de l'utilisateur (14 jours par défaut). Ce décalage est-il voulu ?
2. **Paramètres d'instance inertes** : `stale_hours`, `excluded_days` et `active_countries` sont définis mais jamais lus. Les seuils réels sont fixes (48 h, puis le réglage utilisateur) et tous les pays sont actifs. Fallait-il les rendre réglables par l'administrateur ?
3. **Fin des ruptures** : aucune fonction ne renseigne la date de fin d'une rupture communautaire ; elle cesse d'être visible au bout de 12 h ou dès qu'un prix plus récent arrive. Faut-il un signalement « rupture terminée » ?
4. **Statut `expired` des contributions** : prévu mais jamais attribué. Les contributions en attente n'expirent pas.
5. **Signalement d'horaires** : il n'a aucun effet automatique (note libre lue par le modérateur), et aucun éditeur d'horaires n'existe. Est-ce suffisant ?
6. **Devise d'un prix communautaire** sur une station qui n'a encore aucun prix : EUR, sauf GBP au Royaume-Uni. Une station danoise ou roumaine sans prix recevrait donc un prix en EUR. Probablement non voulu.
7. **Masquage d'un prix aberrant par un modérateur** : la spécification d'origine le prévoyait, mais aucune action ne permet à un modérateur de mettre un prix en quarantaine ou de l'en sortir.
8. **Carburant secondaire du véhicule et moyens de paiement des stations** : enregistrés mais utilisés nulle part (ni recherche, ni affichage). Usage prévu ?
9. **Filtre « enseignes incluses »** : accepté par l'API de recherche, mais l'interface ne propose que l'exclusion.
10. **Royaume-Uni** : référencé (devise GBP, fuseau, liste des pays du signalement), mais aucune source n'est branchée ; l'accès aux données officielles demande des identifiants qui manquaient.
11. **Montants de la modération** : toujours affichés en euros, même pour une station danoise ou roumaine.
12. **Verrouillage après échecs de connexion** : il est approché par une limite par adresse IP, et non par un verrou par compte. Ce niveau de protection est-il suffisant ?
13. **Couverture roumaine au centre de Bucarest** : le plafond de 50 résultats par cercle laisse des stations de côté dans les zones denses. Faut-il resserrer la grille quand une réponse atteint le plafond ?
14. **Validation des comptes et notifications** : la notification `account_approved` n'est pas envoyée en push, contrairement à la demande de validation. Choix délibéré ?
