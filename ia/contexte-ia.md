J'ai besoin de créer un site web avec une barre de recherche me permettant de trouver le contenu d'une string provenant du site web suivant : https://warframe-web-assets.nyc3.cdn.digitaloceanspaces.com/uploads/cms/hnfvc0o3jnfvc873njb03enrf56.html
Le code généré doit pouvoir tourner sur une page HTML avec du code Javascript
Les catégories sont les suivantes :
- Missions
- Relics
- Keys
- Dynamic Location Rewards
- Arbitrations
- Derelict Vault
- Phorid Assassination
- Nightmare Mode Rewards
- Fomorian Sabotage
- Razorback
- Kuva Siphon
- Kuva Flood
- Hallowed Flame Mission Caches
- Hallowed Flame Endurance Caches
- Granum Void
- Extended Granum Void
- Nightmare Granum Void
- Void Storm (Earth)
- Void Storm (Venus)
- Void Storm (Saturn)
- Void Storm (Neptune)
- Void Storm (Pluto)
- Void Storm (Veil Proxima)
- Duviri Full Experience
- Duviri Circuit
- Deep Archimedea Silver Rewards
- Deep Archimedea Gold Rewards
- Deep Archimedea Arcane
- Faceoff: Single Squad
- Faceoff: Single Squad (Steel Path)
- Faceoff: Squad VS Squad
- Faceoff: Squad VS Squad (Winner)
- Faceoff: Squad VS Squad (Steel Path)
- Faceoff: Squad VS Squad (Steel Path Winner)
- Sorties
- Cetus Bounty Rewards
- Orb Vallis Bounty Rewards
- Cambion Drift Bounty Rewards
- Zariman Bounty Rewards
- Albrecht's Laboratories Bounty Rewards
- Hex Bounty Rewards
- Mod Drops by Source
- Mod Drops by Mod
- Blueprint/Part Drops by Source
- Blueprint/Part Drops by Item
- Resource Drops by Source
- Sigil Drops by Source
- Additional Item Drops by Source

Chaque source de chaque item est définit avec la structure suivante :
- Source de l'objet (Mission/Ennemie)
- Rotation de récompense de l'objet (Rotation)
- Objet en récompense (avec une catégorisation d'obtention et un pourcentage d'obtention)

Je veux qu'une barre de recherche soit présente en haut, est lors de la sélection de recherche, affiche toutes les méthodes d'obtentions de cet objet par catégorie

Je voudrais que tu récupère le contenu du site web "https://warframe-web-assets.nyc3.cdn.digitaloceanspaces.com/uploads/cms/hnfvc0o3jnfvc873njb03enrf56.html" et que tu me fasse le code python qui permet de découper le contenu et de le ressortie en json

Le code HTML est structurée de la manière suivante :
- Chaque catégorie est séparée par une balise HTML <h3>
- Chaque tableau commence par une balise <th colspan="2">, qui peut ensuite contenir plusieurs autres balises <th colspan="2"> indiquant les différentes rotations au sein des missions ou des tables de loot, et est séparée par une balise <tr class="blank-row">. Chaque tableau séparée par la balise <tr class="blank-row"> indique donc une source de loot différente

[exemple code drop table](exemple-code-drop-table.md)

La mission doit être retenue 

Le début du découpage ne doit se faire qu'à partir de la catégorie "Mission:"
