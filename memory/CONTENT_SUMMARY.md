# CONTENT_SUMMARY — Warframe Drop Search

**Version courante : 0.3.0**

## Objet du projet

Site statique de recherche dans les tables de drop officielles de Warframe. Les données proviennent de la page publiée par Digital Extremes :
`https://warframe-web-assets.nyc3.cdn.digitaloceanspaces.com/uploads/cms/hnfvc0o3jnfvc873njb03enrf56.html`

Le site est publié via GitHub Pages à l'adresse `https://theoooooo.github.io/warframe-drop-search/`. Cette adresse doit rester le point d'accès du site.

## Contraintes structurantes

- **Aucune étape de build, aucune dépendance** : ni pour le site (HTML, CSS, JavaScript natifs), ni pour l'extraction (bibliothèque standard Python), ni pour les tests (`unittest`). La partie « stack » de `ai-rules/WORKFLOW_SHADCN.md` (Next.js, shadcn/ui, npm) n'est donc pas applicable ; le site reprend seulement le langage visuel de shadcn (tokens de thème, cartes, badges, dialogues).
- Pas de script externe, pas de `innerHTML` : tout le rendu passe par `createElement` et `textContent`.
- Pas de `alert()`, `confirm()` ni `prompt()` : les confirmations sont intégrées à l'interface (exemple : « Delete all » en deux clics).

## Arborescence utile

```
.github/workflows/daily-data-update.yml   # CI : rafraîchissement quotidien des données
data-retriever.py                         # Extraction de la page officielle vers JSON
tests/
├── test_data_retriever.py                # Tests du parseur et de l'historique des données
└── test_version_consistency.py           # Cohérence docs/version.js <-> cette mémoire
docs/                                     # Racine servie telle quelle par GitHub Pages
├── index.html                            # Page unique
├── script.js                             # Recherche, tableaux, sauvegardes, tracker, historiques
├── styles.css                            # Tokens de thème et styles
├── theme.js                              # Applique le thème avant le premier rendu
├── version.js                            # Historique des versions affiché dans l'interface
├── favicon.svg
└── data/data.json                        # Jeu de données généré (~12,8 Mo, ~53 000 lignes)
memory/CONTENT_SUMMARY.md                 # Mémoire et historique des versions
ai-rules/                                 # Règles de travail (ignoré par Git)
README.md, readme_gif.gif, requirements.md
```

## Stack

- **Extraction** : Python 3.10 ou plus, bibliothèque standard uniquement (`html.parser`, `urllib`, `argparse`).
- **Tests** : `unittest`, lancés par `python3 -m unittest discover -s tests`. Le script étant nommé avec un tiret, les tests le chargent via `importlib`.
- **Site** : HTML, CSS et JavaScript natifs (style ES5, une IIFE dans `script.js`).
- **Hébergement** : GitHub Pages servant le dossier `docs/` de la branche `master`.

## Points d'entrée

- `python3 data-retriever.py` : télécharge la page officielle et écrit `docs/data/data.json`. Options `--input <fichier.html>` et `--output <fichier.json>`.
- `docs/index.html` : charge `data/data.json` côté navigateur puis filtre en mémoire.
- `python3 -m http.server 8000 --directory docs --bind 127.0.0.1` : service local du site.

## Fonctionnement des données

`data.json` est un objet. Trois clés de métadonnées précèdent les catégories :

| Clé | Contenu |
|---|---|
| `Timers` | Horodatage de la dernière extraction. |
| `Vaulted Relics` | Noms des reliques vaultées. |
| `Update History` | Jours où les données ont changé, le plus récent en premier. |

Viennent ensuite une clé par catégorie de la page officielle (titre `<h3>`, deux-points inclus), chacune avec sa liste de lignes. Les 20 catégories de la page sont prises en charge.

Le parseur reconnaît une table par sa **structure** et non par son nom. Quatre familles existent :

| Famille | Catégories | Colonnes affichées |
|---|---|---|
| Standard | Missions, Relics, Keys, Dynamic Location Rewards, Sorties | Mission, Mission Type, Rotation, Loot, Category, Percentage |
| Primes | Cetus, Orb Vallis, Cambion Drift, Zariman, Albrecht's Laboratories, Hex | Bounty, Rotation, Stage, Reward, Rarity, Percentage |
| Par objet | Mod Drops by Mod, Blueprint/Item Drops by Blueprint/Item, Resource Drops by Resource | Source, Mod Drop Chance, Mod, Rarity, Percentage, Actual Chance |
| Par source | Mod, Blueprint/Item, Resource, Sigil, Additional Item et Relic Drops by Source | Source, Loot Drop Chance, Loot, Rarity, Percentage, Actual Chance |

Une table de structure inconnue est ignorée et signalée par une annotation `::warning::` dans le job quotidien. Une catégorie reconnue mais vide fait échouer l'extraction, sans écraser le fichier existant.

Règles d'extraction à connaître :

- **Rotation** : la page l'écrit soit dans une cellule d'en-tête sur deux colonnes (Missions), soit dans une cellule d'en-tête suivie d'une cellule vide (Dynamic Location Rewards). Les deux formes sont lues.
- **Type de mission** : dernière parenthèse du nom de la source (`Saturn/(Variant) Annihilation (Conclave)` donne `Conclave`).
- **Rareté et pourcentage** : découpe sur la dernière parenthèse ouvrante (`Beyond Legendary (Under Review) (0.00%)`).
- **Relique vaultée** : relique présente dans `Relics:` mais jamais listée comme loot dans une autre catégorie. Limité aux tiers Lith, Meso, Neo et Axi, car la page ne liste pas les sources des Requiem sous leur nom exact.
- **Historique des données** : à chaque extraction, le script relit le `data.json` précédent et compare les lignes de chaque catégorie, sans tenir compte de leur ordre. Une entrée n'est ajoutée que s'il y a une différence. Elle contient la date, les nombres exacts de lignes ajoutées et retirées, et les lignes elles-mêmes (500 au plus par catégorie et par sens). L'historique garde 30 entrées. Une ligne modifiée compte pour une retirée et une ajoutée. Une correction du parseur apparaît aussi comme un changement de données.

« Actual Chance » est le produit de la chance de drop de la source par la chance de l'objet dans la table.

## Fonctionnement de l'interface

- **Recherche** : sur le nom du loot ou de la source, à partir de 3 caractères, avec temporisation de 300 ms et indicateur de chargement. Menu déroulant des catégories avec compteurs ; choisir une catégorie sans recherche la parcourt entièrement. Bouton d'effacement dans la barre. L'URL suit la recherche (`?q=&and=&category=`).
- **Conditions « AND »** : le bouton « AND » de la barre ajoute jusqu'à 5 champs supplémentaires. Une ligne est gardée si elle contient le texte principal et chaque condition non vide, dans la source ou le loot. Les conditions ne s'appliquent que si la recherche principale est active (3 caractères).
- **Tableaux** : compacts, triables, paginés par 100 lignes. Badges de couleur pour la rareté et les rotations A, B, C. La colonne Rotation est masquée dans une catégorie où aucune ligne n'a de rotation. Un clic sur un nom de source ou de loot relance la recherche sur ce nom, toutes catégories confondues. Badge « Vault » à droite des reliques vaultées.
- **Historique de recherche** : les 10 dernières recherches validées, affichées sous la barre au focus.
- **Recherches sauvegardées** : onglet « Saved » du header. Sauvegarde du texte, des conditions « AND » et de la catégorie, renommage, suppression, champ de filtre. 20 au plus.
- **Tracker** : onglet « Tracker » du header. Un loot se suit depuis le bouton cible à droite de son nom dans un tableau ; il affiche alors « − quantité + » sur toutes ses lignes. À 0 il reste suivi par défaut ; l'option « Remove tracked items at 0 » le retire automatiquement. Hors de cette option, la suppression n'est possible que dans la fenêtre du tracker (une par une ou « Delete all »), qui a aussi un champ de filtre. Le préfixe de quantité est retiré du nom (`100X Oxium` et `200X Oxium` partagent le compteur `Oxium`). Les reliques se suivent aussi depuis la colonne source du tableau Relics, un compteur par raffinement ; `(Intact)` et l'absence de raffinement désignent le même élément. 30 au plus.
- **Changements de données** : bouton « Changes » à gauche de la date de mise à jour. Affiche les changements d'une date à la fois, la plus récente par défaut, en tableaux au format des résultats précédés d'une colonne `+` (ligne ajoutée) ou `−` (ligne retirée). Un bouton à côté du titre ouvre un calendrier où seuls les jours ayant des changements sont sélectionnables.
- **Options** : bouton à gauche de la bascule de thème. Une option à ce jour, sous forme d'interrupteur : retrait automatique des éléments suivis arrivés à 0 (désactivé par défaut).
- **Header** : onglets « Saved » et « Tracker » sur toute la hauteur, actifs tant que leur fenêtre est ouverte ; bouton « Changes », date de dernière mise à jour, version (cliquable, ouvre l'historique des versions), bascule de thème sombre ou clair.

Stockage côté navigateur, sans aucun envoi à un tiers :

| Nom | Type | Contenu |
|---|---|---|
| `wds_saved_searches` | cookie | Recherches sauvegardées |
| `wds_search_history` | cookie | Historique de recherche |
| `wds_tracked_items` | cookie | Éléments suivis et quantités |
| `wds_settings` | cookie | Options du site (absent tant qu'aucune option n'est modifiée) |
| `theme` | localStorage | Thème choisi |

Les cookies sont limités au chemin du site, durent 400 jours, sont en `SameSite=Lax` (et `Secure` en https) et plafonnés à environ 3 800 octets chacun. Leur contenu est revalidé à chaque lecture.

## Déploiement et automatisation

- Le workflow `Daily Data Update` s'exécute chaque jour à 01:00 UTC (et à la demande), lance `data-retriever.py`, puis committe et pousse `docs/data/data.json` directement sur `master` sous le message `Daily Update <date>`. Le fichier change chaque jour (horodatage), même sans changement de données.
- Aucune étape de build : toute modification poussée dans `docs/` sur `master` est en ligne.

## Points d'attention connus

- L'interface n'a pas de tests automatisés et n'a été vérifiée qu'à la main dans un navigateur.
- Le workflow quotidien installe encore `bs4` et `requests`, devenus inutiles, et ne lance pas les tests avant de publier.
- Le robot quotidien pousse directement sur `master`, ce qui déroge à la règle de branche protégée du workflow Git.
- `requirements.md` décrit l'ancien site et `readme_gif.gif` le montre.
- Le parseur ignore en silence une ligne dont il ne reconnaît pas la forme à l'intérieur d'une table reconnue ; c'est ainsi que les rotations de « Dynamic Location Rewards » ont été perdues avant correction.
- Dans « Dynamic Location Rewards », la parenthèse du nom n'est pas toujours un type de mission (`Void Storm (Earth)` donne `Earth`).
- Le favicon est un SVG seul : Safari ne l'affiche pas.

---

# Historique des versions

## Version 0.3.0 — 2026-11-15 18:35

Outils de suivi autour de la recherche : conditions « AND », tracker de loots, historique des changements de données et options.

### Ajouté
- Une recherche peut être affinée par 5 conditions « AND » au plus (exemple : une mission ET « Relic »). Les conditions figurent dans l'adresse partageable et dans les recherches sauvegardées.
- Un loot peut être suivi avec une quantité à décompter, depuis le bouton cible des tableaux et depuis l'onglet « Tracker ». Les lots d'une même ressource partagent un compteur.
- Les reliques peuvent être suivies depuis le tableau Relics, un compteur par raffinement.
- Le bouton « Changes » montre les jours où les tables officielles ont changé, avec les lignes ajoutées (`+`) et retirées (`−`) au format des tableaux de résultats. La date se choisit dans un calendrier qui affiche les totaux de chaque jour et repère la dernière extraction.
- Une fenêtre d'options, ouverte par un bouton à gauche de la bascule de thème, permet de retirer automatiquement du tracker un élément arrivé à 0.
- Les fenêtres « Saved » et « Tracker » ont un champ de filtre.
- Les sources de « Dynamic Location Rewards » (Arbitrations, Nightmare Mode, Granum Void, Faceoff, Nokko…) affichent leurs rotations A, B et C.
- L'historique des données et la cohérence des numéros de version sont couverts par des tests.

### Modifié
- Les accès « Saved » et « Tracker » sont des onglets sur toute la hauteur du header, actifs tant que leur fenêtre est ouverte.
- Le bouton de version a la taille de l'indicateur de dernière mise à jour.
- La fenêtre des recherches sauvegardées est plus grande.
- La croix de la barre de recherche efface aussi les conditions « AND ».
- `data.json` contient une clé `Update History`.

### Supprimé
[Aucun]

### Corrigé
- Le type de mission est lu dans la dernière parenthèse du nom : les missions Conclave « (Variant) » et The Index ne sont plus classées « Variant » ou « Low Risk ».

## Version 0.2.0 — 2026-11-15 18:00

Refonte complète du site et de l'extraction, sans étape de build ni dépendance.

### Ajouté
- Toutes les catégories de la page officielle sont consultables : `Mod Drops by Source`, `Blueprint/Item Drops by Source` et `Resource Drops by Source` s'ajoutent aux 17 précédentes.
- Les reliques vaultées portent un badge « Vault » à droite de leur nom.
- Un clic sur un nom de source ou de loot lance la recherche sur ce nom.
- La barre de recherche a un bouton d'effacement, un indicateur de chargement et un historique des 10 dernières recherches.
- Les recherches peuvent être sauvegardées, renommées et supprimées depuis le bouton « Saved ».
- Le numéro de version est affiché dans le header et ouvre l'historique des versions.
- Thèmes sombre et clair, favicon, adresse partageable qui suit la recherche.
- Le parseur est couvert par des tests.

### Modifié
- L'interface est entièrement redessinée : header, carte de recherche, tableaux compacts.
- Les catégories se choisissent dans un menu déroulant au lieu de boutons.
- Les tableaux sont paginés par 100 lignes ; parcourir une catégorie entière ne fige plus le navigateur.
- La rareté et les rotations sont signalées par des badges de couleur au lieu d'un fond de ligne.
- La colonne Rotation est masquée dans les catégories sans rotation (Relics, Sorties…).
- L'extraction n'utilise plus `requests` ni `beautifulsoup4`.
- Le README est réécrit.

### Supprimé
[Aucun]

### Corrigé
- Une rareté contenant elle-même des parenthèses (`Beyond Legendary (Under Review)`) n'est plus prise pour le pourcentage.
- Les en-têtes des tableaux de primes et « par source » correspondent aux cellules affichées.

## Version 0.1.0 — 2026-11-15 11:35

Création de la mémoire du projet. Cette entrée décrit l'état existant du site avant sa refonte ; elle n'apporte aucun changement fonctionnel.

### Ajouté
- Le projet dispose d'une mémoire décrivant son objet, son arborescence, sa stack, ses points d'entrée, son déploiement et ses points d'attention.

### Modifié
[Aucun]

### Supprimé
[Aucun]

### Corrigé
[Aucun]
