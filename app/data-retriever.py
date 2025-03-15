import json, re, requests
from bs4 import BeautifulSoup

category_skip_list = ["Disclaimer:", "Table of Contents:", "Cetus Bounty Rewards:", "Orb Vallis Bounty Rewards:", "Cambion Drift Bounty Rewards:", "Zariman Bounty Rewards:", "Albrecht's Laboratories Bounty Rewards:", "Hex Bounty Rewards:", "Mod Drops by Source:", "Mod Drops by Mod:", "Blueprint/Item Drops by Source:", "Blueprint/Item Drops by Blueprint/Item:", "Resource Drops by Source:", "Resource Drops by Resource:", "Sigil Drops by Source:", "Additional Item Drops by Source:", "Relic Drops by Source:",]

# category_skip_list = ["Disclaimer:", "Table of Contents:", "Relics:", "Keys:", "Dynamic Location Rewards:", "Arbitrations:", "Derelict Vault:", "Phorid Assassination:", "Nightmare Mode Rewards:", "Fomorian Sabotage:", "Razorback:", "Kuva Siphon:", "Kuva Flood:", "Hallowed Flame Mission Caches:", "Hallowed Flame Endurance Caches:", "Granum Void:", "Extended Granum Void:", "Nightmare Granum Void:", "Void Storm (Earth):", "Void Storm (Venus):", "Void Storm (Saturn):", "Void Storm (Neptune):", "Void Storm (Pluto):", "Void Storm (Veil Proxima):", "Duviri Full Experience:", "Duviri Circuit:", "Deep Archimedea Silver Rewards:", "Deep Archimedea Gold Rewards:", "Deep Archimedea Arcane:", "Faceoff: Single Squad:", "Faceoff: Single Squad (Steel Path):", "Faceoff: Squad VS Squad:", "Faceoff: Squad VS Squad (Winner):", "Faceoff: Squad VS Squad (Steel Path):", "Faceoff: Squad VS Squad (Steel Path Winner:", "Sorties:", "Cetus Bounty Rewards:", "Orb Vallis Bounty Rewards:", "Cambion Drift Bounty Rewards:", "Zariman Bounty Rewards:", "Albrecht's Laboratories Bounty Rewards:", "Hex Bounty Rewards:", "Mod Drops by Source:", "Mod Drops by Mod:", "Blueprint/Item Drops by Source:", "Blueprint/Part Drops by Source:", "Blueprint/Part Drops by Item:", "Resource Drops by Source:", "Sigil Drops by Source:", "Additional Item Drops by Source:", "Resource Drops by Resource:", "Resource Drops by Source:", "Relic Drops by Source:", "Blueprint/Item Drops by Blueprint/Item:"]

# URL du site web
print(f"Retrieve Warframe Drop Table Data")
url = "https://warframe-web-assets.nyc3.cdn.digitaloceanspaces.com/uploads/cms/hnfvc0o3jnfvc873njb03enrf56.html"

# Récupérer le contenu HTML
response = requests.get(url)

# Vérifie si la requête a réussi
if response.status_code == 200:
    # Parser le contenu HTML avec BeautifulSoup
    soup = BeautifulSoup(response.content, 'html.parser')

    # Initialiser un dictionnaire pour stocker les données
    data = {}

    # Trouver toutes les balises <h3> pour les catégories
    categories = soup.find_all('h3')

    # Parcourir chaque catégorie
    for category in categories:

        category_name = category.text.strip()  # Nom de la catégorie
        if category_name in category_skip_list:
            print(f"Skipping Category {category_name}")
            continue
        else:
            print(f"Parsing Category {category_name}")
            data[category_name] = []

        # Trouver le tableau suivant après la balise <h3>
        table = category.find_next('table')

        # Initialiser les variables pour stocker les informations de la mission
        current_mission = ""
        current_rotation = ""

        # Parcourir les lignes du tableau
        for row in table.find_all('tr'):
            # Ignorer les lignes vides (balise <tr class="blank-row">) et réinitialisation des variables missions & rotation
            if 'blank-row' in row.get('class', []):
                current_mission = ""
                current_rotation = ""
                # print("row table empty")
                # print(f" Reset Mission : {current_mission}")
                # print(f" Reset Rotation : {current_rotation}")
                continue

            # Vérifie si la ligne contient une nouvelle mission (balise <th colspan="2">)
            if row.find('th', colspan="2") and current_mission == "":
                mission_name = row.find('th', colspan="2").text.strip()
                print(f"  Detected Mission : {mission_name}")

                # Extraire le type de mission entre parenthèses
                mission_type_match = re.search(r'\((.*?)\)', mission_name)
                mission_type = mission_type_match.group(1) if mission_type_match else "no_mission_type"

                if mission_name != current_mission:
                    current_mission = mission_name
                    current_rotation = ""
                continue

            # Vérifie si la ligne contient une nouvelle rotation (balise <th colspan="2">)
            elif row.find('th', colspan="2") and current_mission != "":
                rotation_name = row.find('th', colspan="2").text.strip()
                current_rotation = rotation_name
                print(f"    Detected Rotation : {current_rotation}")

            # Extraire les données de la ligne (balise <td>)
            else:
                cols = row.find_all('td')
                if len(cols) == 2:
                    objet = cols[0].text.strip()
                    details = cols[1].text.strip()

                    # Extraire la catégorie et le pourcentage
                    if "(" in details and ")" in details:
                        categorie_objet = details.split("(")[0].strip()
                        pourcentage = details.split("(")[1].replace(")", "").strip()
                    else:
                        categorie_objet = details
                        pourcentage = ""

                    # Remplace la valeur rotation par un placeholder
                    if current_rotation == "":
                        current_rotation = "no_rotation"

                    # Ajouter l'élément à la catégorie
                    data[category_name].append({
                        "Mission": current_mission,
                        "Type de Mission": mission_type,
                        "Rotation": current_rotation,
                        "Objet": objet,
                        "Catégorie": categorie_objet,
                        "Pourcentage": pourcentage
                    })

    # Enregistrer les données dans un fichier JSON
    with open("data/data.json", "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=4)
    print("Fichier JSON créé avec succès.")
else:
    print("Erreur lors de la récupération des données.")