Je souhaite ajouter une nouvelle catégorie dédiée aux fléchettes (darts) qui s’intègre parfaitement dans l’architecture et le design du dashboard existant qui est responsive pour l'utiliser sur pc/tablette/téléphone.

L’objectif est de créer un module complet de gestion de parties de fléchettes, avec une expérience utilisateur fluide, moderne et visuellement cohérente avec le reste du dashboard.

Le module doit proposer une interface claire, avancée et esthétique, adaptée à un usage fréquent et rapide pendant une partie.

Objectif du module

Permettre aux utilisateurs de :

créer et gérer des parties de fléchettes

jouer en mode local ou en ligne

suivre les scores automatiquement

afficher les finishes possibles

consulter des statistiques détaillées

accéder à l’historique des parties

visualiser leur progression via des graphiques

bénéficier d’une sauvegarde automatique des parties

1. Création d'une partie

Un utilisateur doit pouvoir créer une partie en configurant plusieurs paramètres.

Modes de jeu

Deux modes doivent être disponibles :

Mode local

plusieurs joueurs peuvent jouer sur le même compte

idéal pour jouer sur un seul appareil

Mode en ligne

plusieurs comptes différents peuvent rejoindre la même partie

chaque compte peut gérer un ou plusieurs joueurs

Exemple :

Partie :

Compte A

Joueur 1

Joueur 2

Compte B

Joueur 3

2. Jeux supportés

Le module doit permettre de jouer à plusieurs variantes populaires :

501

301

Cricket

Le système doit être extensible pour permettre l’ajout d’autres modes de jeu à l’avenir.

3. Options de règles

Lors de la création de la partie, plusieurs règles doivent être configurables :

nombre de legs (1, 3, 5, 7, etc.)

Straight In

Double In

Double Out

Master Out

Ces règles doivent être automatiquement prises en compte dans la logique de calcul du score.

4. Gestion du score

Le système doit gérer automatiquement :

les tours de jeu

l'entrée de 3 fléchettes par tour

le calcul du score restant

les bust

l’application des règles choisies

L’entrée des scores doit être rapide et intuitive, adaptée à un usage en temps réel pendant une partie.

Exemple d'entrée :

20
T20
D16

5. Suggestions de finisher

Lorsque le score le permet, le système doit :

détecter automatiquement les finishes possibles

proposer les combinaisons optimales

les afficher clairement dans l’interface

Exemples :

170 → T20 T20 Bull
167 → T20 T19 Bull
100 → T20 D20

Ces suggestions doivent apparaître dynamiquement pendant la partie.

6. Interface de jeu

L’interface pendant la partie doit afficher clairement :

le score restant de chaque joueur

l’ordre de jeu

l’historique des tours

la moyenne par joueur

le nombre de fléchettes lancées

les finishes disponibles

L’interface doit rester :

lisible

rapide à utiliser

visuellement moderne

cohérente avec l’UI/UX du dashboard existant

7. Historique des parties

Le module doit inclure un historique complet des parties jouées.

Chaque partie enregistrée doit inclure :

la date

les joueurs

le type de jeu

les règles appliquées

le score final

les statistiques principales

Les utilisateurs doivent pouvoir :

consulter leurs parties passées

ouvrir le détail d'une partie

revoir les statistiques associées.

8. Statistiques et graphiques de progression

Le système doit générer des statistiques détaillées et permettre de visualiser la progression des joueurs dans le temps.

Statistiques possibles :

moyenne par partie

moyenne 3 fléchettes

nombre de 180

nombre de 140+

taux de checkout

meilleur tour

meilleure moyenne

Ces données doivent être visualisées à l’aide de graphiques clairs et modernes, permettant par exemple :

évolution de la moyenne dans le temps

progression des performances

comparaison entre joueurs.

9. Sauvegarde automatique

Les parties doivent être automatiquement sauvegardées afin d’éviter toute perte de progression.

Le système doit :

enregistrer l’état de la partie en continu

permettre de reprendre une partie interrompue

restaurer les scores et les tours déjà joués.

10. Statistiques de fin de partie

À la fin d'une partie, un écran de résumé détaillé doit être affiché.

Pour chaque joueur :

moyenne 3 fléchettes

meilleur tour

nombre de 180

nombre de 140+

checkout réussi

taux de checkout

Statistiques globales :

durée de la partie

nombre total de tours

score moyen.