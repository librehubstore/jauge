Tu vas produire le PROMPT DE RÉGÉNÉRATION de l'application présente dans ce dépôt.

Objectif : un document autonome qui permet à n'importe quel assistant de code, SANS AUCUN accès à ce dépôt, de reconstruire une application fonctionnellement équivalente.

Analyse l'intégralité du code, puis rédige le document avec ces sept sections.

1. INTENTION
   Ce que fait l'application, pour qui, quel problème elle résout, et quel logiciel payant elle remplace. Une personne qui découvre le projet doit comprendre en cinq lignes.

2. PÉRIMÈTRE FONCTIONNEL
   La liste exhaustive des fonctionnalités, du point de vue de l'utilisateur. Pour chacune : ce que l'utilisateur fait, ce que le système répond. Aucun vocabulaire d'implémentation.

3. MODÈLE DE DONNÉES
   Les entités, leurs champs, leurs types, leurs relations, leurs contraintes. Précise ce qui est unique, ce qui est indexé, ce qui est obligatoire, et les valeurs par défaut.

4. RÈGLES MÉTIER
   Les invariants, les validations, les autorisations par rôle, les cas limites, les comportements en cas d'erreur. C'est la section la plus souvent omise et la plus coûteuse à redécouvrir : sois exhaustif.

5. INTERFACES
   Les écrans, ce qu'ils affichent, les parcours entre eux, les états vides et les états d'erreur. Puis les points d'entrée d'API : verbe, chemin, forme de la requête, forme de la réponse, codes de statut.

6. CONTRAINTES TECHNIQUES
   Ce qui est réellement imposé et pourquoi : type de base de données, exigences d'hébergement, variables d'environnement nécessaires, intégrations externes. Distingue les contraintes réelles des choix d'opportunité du premier auteur.

7. CRITÈRES D'ACCEPTATION
   Comment vérifier qu'une régénération est réussie. Des assertions vérifiables une par une, pas des intentions.

RÈGLES DE RÉDACTION

- Écris pour un lecteur qui n'a AUCUN accès au code. Ne renvoie jamais à un fichier, une fonction ou une ligne du dépôt.
- Décris le comportement, pas l'implémentation. « Le mot de passe est stocké haché avec un algorithme à coût de calcul configurable » et non « bcrypt avec 10 tours ».
- Ne fige une bibliothèque ou une version que si le comportement en dépend réellement. Une régénération doit pouvoir choisir une autre stack.
- Quand tu ne peux pas déduire une intention du code, dis-le explicitement dans une section « Points à confirmer par l'auteur » plutôt que d'inventer une justification.
- Ne recopie pas de code. Si un algorithme est subtil, décris-le en français.
- Vise un document complet et lisible d'un bout à l'autre. Mieux vaut long et exact que court et ambigu.

Produis uniquement ce document, sans préambule ni commentaire sur ta démarche.
