# CONTENT_SUMMARY — Warframe Drop Search

**Version courante : 0.1.0**

## Objet du projet

Site statique de recherche dans les tables de drop officielles de Warframe. Les données proviennent de la page publiée par Digital Extremes :
`https://warframe-web-assets.nyc3.cdn.digitaloceanspaces.com/uploads/cms/hnfvc0o3jnfvc873njb03enrf56.html`

Le site est publié via GitHub Pages à l'adresse `https://theoooooo.github.io/warframe-drop-search/`. Cette adresse doit rester le point d'accès du site.

## Arborescence utile

```
.github/workflows/daily-data-update.yml   # CI : rafraîchissement quotidien des données
data-retriever.py                         # Extraction de la page officielle vers JSON
docs/                                     # Racine servie par GitHub Pages
├── index.html                            # Page unique
├── script.js                             # Recherche, filtres par catégorie, tri, rendu des tableaux
├── styles.css                            # Styles
└── data/data.json                        # Jeu de données généré (~10,8 Mo, ~43 000 lignes)
memory/CONTENT_SUMMARY.md                 # Mémoire et historique des versions
ai-rules/                                 # Règles de travail (ignoré par Git, non versionné ici)
README.md, readme_gif.gif, requirements.md
```

## Stack

- **Extraction** : Python 3.10 (CI), `requests` + `beautifulsoup4`. Script unique à la racine, sans `pyproject.toml`, sans lockfile, sans tests.
- **Site** : HTML, CSS et JavaScript natifs, sans étape de build ni dépendance.
- **Hébergement** : GitHub Pages servant le dossier `docs/` de la branche `master`.

## Points d'entrée

- `python data-retriever.py` : télécharge la page officielle et écrit `docs/data/data.json`.
- `docs/index.html` : charge `data/data.json` côté navigateur puis filtre en mémoire.

## Fonctionnement des données

`data.json` est un objet dont chaque clé est une catégorie de la page officielle (titre `<h3>`, deux-points inclus) et chaque valeur une liste de lignes. La clé `Timers` porte la date de génération. Quatre familles de structure existent :

| Famille | Catégories | Colonnes affichées |
|---|---|---|
| Standard | Missions, Relics, Keys, Dynamic Location Rewards, Sorties | Mission, Mission Type, Rotation, Loot, Category, Percentage |
| Par objet | Mod Drops by Mod, Blueprint/Item Drops by Blueprint/Item, Resource Drops by Resource | Source, Mod Drop Chance, Mod, Rarity, Percentage, Actual Chance |
| Primes | Cetus, Orb Vallis, Cambion Drift, Zariman, Albrecht's Laboratories, Hex | Bounty, Rotation, Stage, Reward, Rarity, Percentage |
| Par source | Sigil Drops by Source, Additional Item Drops by Source, Relic Drops by Source | Source, Loot Drop Chance, Loot, Rarity, Percentage, Actual Chance |

« Actual Chance » est le produit de la chance de drop de la source par la chance de l'objet dans la table.

Catégories de la page officielle non prises en charge en 0.1.0 : `Mod Drops by Source`, `Blueprint/Item Drops by Source`, `Resource Drops by Source`. Leur structure HTML est identique à celle de la famille « Par source ».

## Fonctionnement de l'interface

- Recherche sur le nom du loot ou de la source, à partir de 3 caractères, avec temporisation de 500 ms.
- Boutons de catégorie avec compteur de résultats ; un clic isole une catégorie, un second clic la désélectionne.
- Tri par clic sur un en-tête de colonne.
- Couleur de fond selon la rotation (A, B, C) et la rareté.
- Date de dernière mise à jour du jeu de données affichée en haut à droite.

## Déploiement et automatisation

- Le workflow `Daily Data Update` s'exécute chaque jour à 01:00 UTC (et à la demande), lance `data-retriever.py`, puis committe et pousse `docs/data/data.json` directement sur `master` sous le message `Daily Update <date>`.
- Aucune étape de build : toute modification poussée dans `docs/` sur `master` est en ligne.

## Points d'attention connus

- Sélectionner une catégorie sans recherche affiche toutes ses lignes d'un coup et peut figer le navigateur (jusqu'à ~19 000 lignes).
- Dans la vue « catégorie isolée », les en-têtes des familles « Primes » et « Par source » ne correspondent pas aux cellules affichées.
- Le robot quotidien pousse directement sur `master`, ce qui déroge à la règle de branche protégée du workflow Git.

---

# Historique des versions

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
