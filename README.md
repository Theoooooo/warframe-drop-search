# Warframe Drop Search

![readme_gif](readme_gif.gif)

I created this website to be able to search through the drop table that is being exposed through the [Warframe Drop Table Website](https://warframe-web-assets.nyc3.cdn.digitaloceanspaces.com/uploads/cms/hnfvc0o3jnfvc873njb03enrf56.html#phoridassassination)

I was a bit tired to not being able to quickly find drop through mission and drop tables in an efficient wayo i made myself a website drafted from IA in the beginning to gain some timend then modify the content to be able to suit my use

The data.json file contains the datas being loaded inside the websiteo data refresh is configured yetut a daily refresh will be setuped through pipelines.

# Blacklist Categories

There's currently a filter that blacklist certain categories from the drop table website to prevent empty dataset and non-working parsing because some of the tables are formed differentely inside the website :
- "Disclaimer:"
- "Table of Contents:"
- "Cetus Bounty Rewards:"
- "Orb Vallis Bounty Rewards:"
- "Cambion Drift Bounty Rewards:"
- "Zariman Bounty Rewards:"
- "Albrecht's Laboratories Bounty Rewards:"
- "Hex Bounty Rewards:"
- "Mod Drops by Source:"
- "Mod Drops by Mod:"
- "Blueprint/Item Drops by Source:"
- "Blueprint/Item Drops by Blueprint/Item:"
- "Resource Drops by Source:"
- "Resource Drops by Resource:"
- "Sigil Drops by Source:"
- "Additional Item Drops by Source:"
- "Relic Drops by Source:"

## Implemented Features
- Search Bar working through the following categories
  - Missions
  - Relics
  - Keys
  - Dynamic Location Rewards
  - Sorties
  - Mod Drops by Mod
- Search Bar filtering results based on the Source (Mission Name / Mob) and the associated Loot (Reward / Mod)
- Visual Color based on Rotation (for missions) and Loot Rarity
- Visual feedback when no results are being found
- Category Selection to refine result view

## Following Features
- Adding average duration for each rotation and mission (manually setut you'll be able to see like "5 minutes for this drop" in average to get)
- Adding more loot categories
- Adding more style to the website