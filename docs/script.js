const rarityTable = ["Very Common", "Common", "Uncommon", "Rare", "Ultra Rare", "Legendary"];
const rarityColor = ["#FFFFFF", "#FFF6FF", "#E1F8FF", "#92FFFF", "#A5FEB5", "#FAE470"];
const rotationTable = ["Rotation A", "Rotation B", "Rotation C"];
const rotationColor = ["#FFFFFF", "#CBFFCC", "#79FF7C"];

const standardLootCategories = ["Missions:", "Relics:", "Keys:", "Dynamic Location Rewards:", "Sorties:",]
const modLootCategories = ["Mod Drops by Mod:", "Blueprint/Item Drops by Blueprint/Item:", "Resource Drops by Resource:"]
const modBountyCategories = ["Cetus Bounty Rewards:", "Orb Vallis Bounty Rewards:", "Cambion Drift Bounty Rewards:", "Zariman Bounty Rewards:", "Albrecht's Laboratories Bounty Rewards:", "Hex Bounty Rewards:"]
const modSourceCategories = ["Sigil Drops by Source:", "Additional Item Drops by Source:", "Relic Drops by Source:"]

function extractColorCode(input, type) {
    let table, colorTable;

    if (type === "rarity") {
        table = rarityTable;
        colorTable = rarityColor;
    } else if (type === "rotation") {
        table = rotationTable;
        colorTable = rotationColor;
    } else {
        return null;
    }

    const index = table.indexOf(input);
    return index !== -1 ? colorTable[index] : null;
}

function createCategoryButtons(data, query) {
    const buttonContainer = document.getElementById('category-buttons');
    buttonContainer.innerHTML = ''; // Vider le conteneur avant d'ajouter les boutons

    Object.keys(data).forEach(category => {
        const filteredItems = data[category].filter(item =>
            item.Loot.toLowerCase().includes(query) || item.Source.toLowerCase().includes(query)
        );

        // Ne pas afficher le bouton si aucun résultat ne correspond
        if (filteredItems.length > 0) {
            const button = document.createElement('button');
            button.textContent = `${category} (${filteredItems.length})`;
            button.dataset.category = category;
            button.dataset.active = 'false'; // Par défaut, aucune catégorie n'est active
            button.style.padding = '5px 10px';
            button.style.border = '1px solid #cac6f5';
            button.style.borderRadius = '5px';
            button.style.cursor = 'pointer';
            button.style.backgroundColor = '#d7daf8';
            button.style.color = '#1c3272';
            button.addEventListener('click', () => toggleCategory(data, button)); // Passer data en paramètre

            buttonContainer.appendChild(button);
        }
    });
}

function toggleCategory(data, button) {
    const category = button.dataset.category;
    const isActive = button.dataset.active === 'true';

    // Réinitialiser tous les boutons
    const buttons = document.querySelectorAll('#category-buttons button');
    buttons.forEach(btn => {
        btn.dataset.active = 'false';
        btn.style.backgroundColor = '#d7daf8'; // Couleur par défaut
        btn.style.color = '#1c3272'; // Texte par défaut
    });

    // Activer ou désactiver le bouton cliqué
    if (!isActive) {
        button.dataset.active = 'true';
        button.style.backgroundColor = '#1c3272'; // Couleur pour le bouton actif
        button.style.color = '#ffffff'; // Texte blanc pour le bouton actif
    }

    // Masquer ou afficher la catégorie
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = ''; // Effacer les résultats précédents

    if (button.dataset.active === 'true') {
        // Afficher uniquement la catégorie sélectionnée
        displayCategory(data, category);
    } else {
        // Afficher toutes les catégories
        displayResults(data, '');
    }
}

function displayResults(data, query) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    let hasResults = false;

    // Mettre à jour les compteurs des boutons
    const buttons = document.querySelectorAll('#category-buttons button');
    buttons.forEach(button => {
        const category = button.dataset.category;
        const filteredItems = data[category].filter(item =>
            item.Loot.toLowerCase().includes(query) || item.Source.toLowerCase().includes(query)
        );
        button.textContent = `${category} (${filteredItems.length})`;
    });

    Object.keys(data).forEach(category => {
        const filteredItems = data[category].filter(item =>
            item.Loot.toLowerCase().includes(query) || item.Source.toLowerCase().includes(query)
        );

        if (filteredItems.length > 0) {
            hasResults = true;

            const categoryHeader = document.createElement('h2');
            categoryHeader.textContent = category;
            categoryHeader.id = category; // Identifiant unique pour la catégorie
            resultsContainer.appendChild(categoryHeader);

            const divTable = document.createElement('div');
            divTable.className = "tableContent";
            divTable.style.display = 'block'; // Afficher par défaut

            const table = document.createElement('table');
            table.style.width = '100%';
            table.setAttribute('cellpadding', '5');
            const tableBody = document.createElement('tbody');

            const tableHeader = document.createElement('thead');
            const headerRow = document.createElement('tr');

            if (standardLootCategories.includes(category)) {
                const headers = ["Mission", "Mission Type", "Rotation", "Loot", "Category", "Percentage"];

                headers.forEach((headerText, index) => {
                    const header = document.createElement('th');
                    header.textContent = headerText;
                    header.style.cursor = 'pointer';
                    header.style.position = 'relative';
                    header.style.paddingRight = '20px';
                    header.onclick = () => sortTable(index, table);
                    headerRow.appendChild(header);

                    const sortIcon = document.createElement('span');
                    sortIcon.style.position = 'absolute';
                    sortIcon.style.right = '5px';
                    sortIcon.style.top = '50%';
                    sortIcon.style.transform = 'translateY(-50%)';
                    sortIcon.textContent = '↕';
                    header.appendChild(sortIcon);
                });

                tableHeader.appendChild(headerRow);
                table.appendChild(tableHeader);
                divTable.appendChild(table);

                filteredItems.forEach(item => {
                    const row = document.createElement('tr');

                    const missionCell = document.createElement('td');
                    missionCell.textContent = item.Source;
                    row.appendChild(missionCell);

                    const missionTypeCell = document.createElement('td');
                    missionTypeCell.textContent = item["Mission Type"];
                    row.appendChild(missionTypeCell);

                    const rotationCell = document.createElement('td');
                    rotationCell.textContent = item.Rotation;
                    rotationCell.style.backgroundColor = extractColorCode(item.Rotation, "rotation");
                    row.appendChild(rotationCell);

                    const objetCell = document.createElement('td');
                    objetCell.textContent = item.Loot;
                    row.appendChild(objetCell);

                    const categorieCell = document.createElement('td');
                    categorieCell.textContent = item.Rarity;
                    categorieCell.style.backgroundColor = extractColorCode(item.Rarity, "rarity");
                    row.appendChild(categorieCell);

                    const pourcentageCell = document.createElement('td');
                    pourcentageCell.textContent = item.Percentage;
                    row.appendChild(pourcentageCell);

                    tableBody.appendChild(row);
                });

            } else if (modLootCategories.includes(category)) {
                const headers = ["Source", "Mod Drop Chance", "Mod", "Rarity", "Percentage", "Actual Chance"];

                headers.forEach((headerText, index) => {
                    const header = document.createElement('th');
                    header.textContent = headerText;
                    header.style.cursor = 'pointer';
                    header.style.position = 'relative';
                    header.style.paddingRight = '20px';
                    header.onclick = () => sortTable(index, table);
                    headerRow.appendChild(header);

                    const sortIcon = document.createElement('span');
                    sortIcon.style.position = 'absolute';
                    sortIcon.style.right = '5px';
                    sortIcon.style.top = '50%';
                    sortIcon.style.transform = 'translateY(-50%)';
                    sortIcon.textContent = '↕';
                    header.appendChild(sortIcon);
                });

                tableHeader.appendChild(headerRow);
                table.appendChild(tableHeader);
                divTable.appendChild(table);

                filteredItems.forEach(item => {
                    const row = document.createElement('tr');

                    const sourceCell = document.createElement('td');
                    sourceCell.textContent = item.Source;
                    row.appendChild(sourceCell);

                    const modDropChanceTypeCell = document.createElement('td');
                    modDropChanceTypeCell.textContent = item["Mod Drop Chance"];
                    row.appendChild(modDropChanceTypeCell);

                    const modCell = document.createElement('td');
                    modCell.textContent = item.Loot;
                    row.appendChild(modCell);

                    const categorieCell = document.createElement('td');
                    categorieCell.textContent = item.Rarity;
                    categorieCell.style.backgroundColor = extractColorCode(item.Rarity, "rarity");
                    row.appendChild(categorieCell);

                    const pourcentageCell = document.createElement('td');
                    pourcentageCell.textContent = item.Percentage;
                    row.appendChild(pourcentageCell);

                    const actualChanceCell = document.createElement('td');
                    actualChanceCell.textContent = ((parseFloat(item["Mod Drop Chance"]) / 100) * (parseFloat(item.Percentage) / 100) * 100).toFixed(3) + '%';
                    row.appendChild(actualChanceCell);

                    tableBody.appendChild(row);
                });

            } else if (modBountyCategories.includes(category)) {
                const headers = ["Bounty", "Rotation", "Stage", "Reward", "Rarity", "Percentage"];

                headers.forEach((headerText, index) => {
                    const header = document.createElement('th');
                    header.textContent = headerText;
                    header.style.cursor = 'pointer';
                    header.style.position = 'relative';
                    header.style.paddingRight = '20px';
                    header.onclick = () => sortTable(index, table);
                    headerRow.appendChild(header);

                    const sortIcon = document.createElement('span');
                    sortIcon.style.position = 'absolute';
                    sortIcon.style.right = '5px';
                    sortIcon.style.top = '50%';
                    sortIcon.style.transform = 'translateY(-50%)';
                    sortIcon.textContent = '↕';
                    header.appendChild(sortIcon);
                });

                tableHeader.appendChild(headerRow);
                table.appendChild(tableHeader);
                divTable.appendChild(table);

                filteredItems.forEach(item => {
                    const row = document.createElement('tr');

                    const sourceCell = document.createElement('td');
                    sourceCell.textContent = item.Source;
                    row.appendChild(sourceCell);

                    const rotationCell = document.createElement('td');
                    rotationCell.textContent = item.Rotation;
                    row.appendChild(rotationCell);

                    const stageCell = document.createElement('td');
                    stageCell.textContent = item.Stage;
                    row.appendChild(stageCell);

                    const modCell = document.createElement('td');
                    modCell.textContent = item.Loot;
                    row.appendChild(modCell);

                    const categorieCell = document.createElement('td');
                    categorieCell.textContent = item.Rarity;
                    categorieCell.style.backgroundColor = extractColorCode(item.Rarity, "rarity");
                    row.appendChild(categorieCell);

                    const pourcentageCell = document.createElement('td');
                    pourcentageCell.textContent = item.Percentage;
                    row.appendChild(pourcentageCell);

                    tableBody.appendChild(row);
                });
            } else if (modSourceCategories.includes(category)) {
                const headers = ["Source", "Loot Drop Chance", "Loot", "Rarity", "Percentage", "Actual Chance"];

                headers.forEach((headerText, index) => {
                    const header = document.createElement('th');
                    header.textContent = headerText;
                    header.style.cursor = 'pointer';
                    header.style.position = 'relative';
                    header.style.paddingRight = '20px';
                    header.onclick = () => sortTable(index, table);
                    headerRow.appendChild(header);

                    const sortIcon = document.createElement('span');
                    sortIcon.style.position = 'absolute';
                    sortIcon.style.right = '5px';
                    sortIcon.style.top = '50%';
                    sortIcon.style.transform = 'translateY(-50%)';
                    sortIcon.textContent = '↕';
                    header.appendChild(sortIcon);
                });

                tableHeader.appendChild(headerRow);
                table.appendChild(tableHeader);
                divTable.appendChild(table);

                filteredItems.forEach(item => {
                    const row = document.createElement('tr');

                    const sourceCell = document.createElement('td');
                    sourceCell.textContent = item.Source;
                    row.appendChild(sourceCell);

                    const lootDropChanceTypeCell = document.createElement('td');
                    lootDropChanceTypeCell.textContent = item["Loot Drop Chance"];
                    row.appendChild(lootDropChanceTypeCell);

                    const dropCell = document.createElement('td');
                    dropCell.textContent = item.Loot;
                    row.appendChild(dropCell);

                    const categorieCell = document.createElement('td');
                    categorieCell.textContent = item.Rarity;
                    categorieCell.style.backgroundColor = extractColorCode(item.Rarity, "rarity");
                    row.appendChild(categorieCell);

                    const pourcentageCell = document.createElement('td');
                    pourcentageCell.textContent = item.Percentage;
                    row.appendChild(pourcentageCell);

                    const actualChanceCell = document.createElement('td');
                    actualChanceCell.textContent = ((parseFloat(item["Loot Drop Chance"]) / 100) * (parseFloat(item.Percentage) / 100) * 100).toFixed(3) + '%';
                    row.appendChild(actualChanceCell);

                    tableBody.appendChild(row);
                });

            }

            table.appendChild(tableBody);
            divTable.appendChild(table);
            resultsContainer.appendChild(divTable);
        }
    });

    if (!hasResults) {
        const message = document.createElement('div');
        message.innerHTML = 'No Result found for your research.';
        message.style.textAlign = 'center';
        message.style.padding = '20px';
        message.style.backgroundColor = '#d7daf8';
        message.style.color = '#1c3272';
        message.style.border = '1px solid #cac6f5';
        message.style.borderRadius = '5px';
        message.style.marginTop = '20px';
        resultsContainer.appendChild(message);
    }
}

function displayCategory(data, category) {
    const resultsContainer = document.getElementById('results');
    const filteredItems = data[category];

    if (filteredItems.length > 0) {
        const categoryHeader = document.createElement('h2');
        categoryHeader.textContent = category;
        categoryHeader.id = category;
        resultsContainer.appendChild(categoryHeader);

        const divTable = document.createElement('div');
        divTable.className = "tableContent";

        const table = document.createElement('table');
        table.style.width = '100%';
        table.setAttribute('cellpadding', '5');
        const tableBody = document.createElement('tbody');

        const tableHeader = document.createElement('thead');
        const headerRow = document.createElement('tr');

        if (standardLootCategories.includes(category)) {
            const headers = ["Mission", "Mission Type", "Rotation", "Loot", "Category", "Percentage"];

            headers.forEach((headerText, index) => {
                const header = document.createElement('th');
                header.textContent = headerText;
                header.style.cursor = 'pointer';
                header.style.position = 'relative';
                header.style.paddingRight = '20px';
                header.onclick = () => sortTable(index, table);
                headerRow.appendChild(header);

                const sortIcon = document.createElement('span');
                sortIcon.style.position = 'absolute';
                sortIcon.style.right = '5px';
                sortIcon.style.top = '50%';
                sortIcon.style.transform = 'translateY(-50%)';
                sortIcon.textContent = '↕';
                header.appendChild(sortIcon);
            });

            tableHeader.appendChild(headerRow);
            table.appendChild(tableHeader);
            divTable.appendChild(table);

            filteredItems.forEach(item => {
                const row = document.createElement('tr');

                const missionCell = document.createElement('td');
                missionCell.textContent = item.Source;
                row.appendChild(missionCell);

                const missionTypeCell = document.createElement('td');
                missionTypeCell.textContent = item["Mission Type"];
                row.appendChild(missionTypeCell);

                const rotationCell = document.createElement('td');
                rotationCell.textContent = item.Rotation;
                rotationCell.style.backgroundColor = extractColorCode(item.Rotation, "rotation");
                row.appendChild(rotationCell);

                const objetCell = document.createElement('td');
                objetCell.textContent = item.Loot;
                row.appendChild(objetCell);

                const categorieCell = document.createElement('td');
                categorieCell.textContent = item.Rarity;
                categorieCell.style.backgroundColor = extractColorCode(item.Rarity, "rarity");
                row.appendChild(categorieCell);

                const pourcentageCell = document.createElement('td');
                pourcentageCell.textContent = item.Percentage;
                row.appendChild(pourcentageCell);

                tableBody.appendChild(row);
            });

        } else if (modLootCategories.includes(category)) {
            const headers = ["Source", "Mod Drop Chance", "Mod", "Rarity", "Percentage", "Actual Chance"];

            headers.forEach((headerText, index) => {
                const header = document.createElement('th');
                header.textContent = headerText;
                header.style.cursor = 'pointer';
                header.style.position = 'relative';
                header.style.paddingRight = '20px';
                header.onclick = () => sortTable(index, table);
                headerRow.appendChild(header);

                const sortIcon = document.createElement('span');
                sortIcon.style.position = 'absolute';
                sortIcon.style.right = '5px';
                sortIcon.style.top = '50%';
                sortIcon.style.transform = 'translateY(-50%)';
                sortIcon.textContent = '↕';
                header.appendChild(sortIcon);
            });

            tableHeader.appendChild(headerRow);
            table.appendChild(tableHeader);
            divTable.appendChild(table);

            filteredItems.forEach(item => {
                const row = document.createElement('tr');

                const sourceCell = document.createElement('td');
                sourceCell.textContent = item.Source;
                row.appendChild(sourceCell);

                const modDropChanceTypeCell = document.createElement('td');
                modDropChanceTypeCell.textContent = item["Mod Drop Chance"];
                row.appendChild(modDropChanceTypeCell);

                const modCell = document.createElement('td');
                modCell.textContent = item.Loot;
                row.appendChild(modCell);

                const categorieCell = document.createElement('td');
                categorieCell.textContent = item.Rarity;
                categorieCell.style.backgroundColor = extractColorCode(item.Rarity, "rarity");
                row.appendChild(categorieCell);

                const pourcentageCell = document.createElement('td');
                pourcentageCell.textContent = item.Percentage;
                row.appendChild(pourcentageCell);

                const actualChanceCell = document.createElement('td');
                actualChanceCell.textContent = ((parseFloat(item["Mod Drop Chance"]) / 100) * (parseFloat(item.Percentage) / 100) * 100).toFixed(3) + '%';
                row.appendChild(actualChanceCell);

                tableBody.appendChild(row);
            });

        } else if (modBountyCategories.includes(category)) {
            const headers = ["Bounty", "Rotation", "Stage", "Reward", "Rarity", "Percentage", "Actual Chance"];

            headers.forEach((headerText, index) => {
                const header = document.createElement('th');
                header.textContent = headerText;
                header.style.cursor = 'pointer';
                header.style.position = 'relative';
                header.style.paddingRight = '20px';
                header.onclick = () => sortTable(index, table);
                headerRow.appendChild(header);

                const sortIcon = document.createElement('span');
                sortIcon.style.position = 'absolute';
                sortIcon.style.right = '5px';
                sortIcon.style.top = '50%';
                sortIcon.style.transform = 'translateY(-50%)';
                sortIcon.textContent = '↕';
                header.appendChild(sortIcon);
            });

            tableHeader.appendChild(headerRow);
            table.appendChild(tableHeader);
            divTable.appendChild(table);

            filteredItems.forEach(item => {
                const row = document.createElement('tr');

                const sourceCell = document.createElement('td');
                sourceCell.textContent = item.Source;
                row.appendChild(sourceCell);

                const rotationCell = document.createElement('td');
                rotationCell.textContent = item.Rotation;
                row.appendChild(rotationCell);

                const stageCell = document.createElement('td');
                stageCell.textContent = item.Stage;
                row.appendChild(stageCell);

                const modCell = document.createElement('td');
                modCell.textContent = item.Loot;
                row.appendChild(modCell);

                const categorieCell = document.createElement('td');
                categorieCell.textContent = item.Rarity;
                categorieCell.style.backgroundColor = extractColorCode(item.Rarity, "rarity");
                row.appendChild(categorieCell);

                const pourcentageCell = document.createElement('td');
                pourcentageCell.textContent = item.Percentage;
                row.appendChild(pourcentageCell);

                tableBody.appendChild(row);
            });
        } else if (modSourceCategories.includes(category)) {
            const headers = ["Bounty", "Rotation", "Stage", "Reward", "Rarity", "Percentage"];

            headers.forEach((headerText, index) => {
                const header = document.createElement('th');
                header.textContent = headerText;
                header.style.cursor = 'pointer';
                header.style.position = 'relative';
                header.style.paddingRight = '20px';
                header.onclick = () => sortTable(index, table);
                headerRow.appendChild(header);

                const sortIcon = document.createElement('span');
                sortIcon.style.position = 'absolute';
                sortIcon.style.right = '5px';
                sortIcon.style.top = '50%';
                sortIcon.style.transform = 'translateY(-50%)';
                sortIcon.textContent = '↕';
                header.appendChild(sortIcon);
            });

            tableHeader.appendChild(headerRow);
            table.appendChild(tableHeader);
            divTable.appendChild(table);

            filteredItems.forEach(item => {
                const row = document.createElement('tr');

                const sourceCell = document.createElement('td');
                sourceCell.textContent = item.Source;
                row.appendChild(sourceCell);

                const rotationCell = document.createElement('td');
                rotationCell.textContent = item.Rotation;
                row.appendChild(rotationCell);

                const stageCell = document.createElement('td');
                stageCell.textContent = item.Stage;
                row.appendChild(stageCell);

                const modCell = document.createElement('td');
                modCell.textContent = item.Loot;
                row.appendChild(modCell);

                const categorieCell = document.createElement('td');
                categorieCell.textContent = item.Rarity;
                categorieCell.style.backgroundColor = extractColorCode(item.Rarity, "rarity");
                row.appendChild(categorieCell);

                const pourcentageCell = document.createElement('td');
                pourcentageCell.textContent = item.Percentage;
                row.appendChild(pourcentageCell);

                tableBody.appendChild(row);
            });
        }

        table.appendChild(tableBody);
        divTable.appendChild(table);
        resultsContainer.appendChild(divTable);
    } else {
        const message = document.createElement('div');
        message.innerHTML = 'No Result found in category <b>' + category + '</b> .';
        message.style.textAlign = 'center';
        message.style.padding = '20px';
        message.style.backgroundColor = '#d7daf8';
        message.style.color = '#1c3272';
        message.style.border = '1px solid #cac6f5';
        message.style.borderRadius = '5px';
        message.style.marginTop = '20px';
        resultsContainer.appendChild(message);
    }
}

function sortTable(columnIndex, table) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const isAscending = !table.dataset.sortAscending || table.dataset.sortAscending === 'false';

    rows.sort((a, b) => {
        const aValue = a.children[columnIndex].textContent.trim();
        const bValue = b.children[columnIndex].textContent.trim();

        if (!isNaN(aValue.replace('%', '')) && !isNaN(bValue.replace('%', ''))) {
            return isAscending ? parseFloat(aValue.replace('%', '')) - parseFloat(bValue.replace('%', '')) : parseFloat(bValue.replace('%', '')) - parseFloat(aValue.replace('%', ''));
        } else {
            return isAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
    });

    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));

    table.dataset.sortAscending = isAscending;

    // Mettre à jour l'icône de tri
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
        const sortIcon = header.querySelector('span');
        if (index === columnIndex) {
            sortIcon.textContent = isAscending ? '↑' : '↓';
        } else {
            sortIcon.textContent = '↕';
        }
    });
}

async function loadData() {
    try {
        const response = await fetch('data/data.json');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error while loading data:", error);
        return null;
    }
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        const loader = document.getElementById('loader');
        document.getElementById('results').innerHTML = '';
        loader.style.display = 'block'; // Afficher le loader

        clearTimeout(timeoutId); // Annule le délai précédent
        timeoutId = setTimeout(() => {
            func.apply(this, args); // Exécuter la fonction après le délai
            loader.style.display = 'none'; // Masquer le loader après l'exécution
        }, delay); // Démarre un nouveau délai
    };
}
async function init() {
    const loader = document.getElementById('loader');
    const searchBar = document.getElementById('searchBar');
    const resultsContainer = document.getElementById('results');
    const updateTimeContainer = document.getElementById('update-time');

    loader.style.display = 'block';
    resultsContainer.style.display = 'none';

    const data = await loadData();

    loader.style.display = 'none';
    resultsContainer.style.display = 'block';

    if (data) {
        // Afficher l'heure de génération du fichier JSON
        if (data.Timers && data.Timers.length > 0) {
            const updateTime = data.Timers[0]["Update Data Set Date"];
            updateTimeContainer.textContent = `Last update: ${updateTime}`;
        }

        // Créer les boutons de catégorie initialement (sans filtre)
        createCategoryButtons(data, '');

        // Fonction de recherche avec délai de temporisation
        const debouncedSearch = debounce(() => {
            const query = searchBar.value.toLowerCase();

            // Effacer les résultats précédents
            resultsContainer.innerHTML = '';

            if (query.length >= 3) {
                // Filtrer les données en fonction de la recherche
                const filteredData = {};
                Object.keys(data).forEach(category => {
                    if (category !== "Timers") { // Ignorer le champ Timers
                        const filteredItems = data[category].filter(item =>
                            item.Loot.toLowerCase().includes(query) || item.Source.toLowerCase().includes(query)
                        );
                        if (filteredItems.length > 0) {
                            filteredData[category] = filteredItems;
                        }
                    }
                });

                // Mettre à jour les boutons de catégorie avec la requête
                createCategoryButtons(filteredData, query);

                // Afficher les résultats de la recherche
                const activeButton = document.querySelector('#category-buttons button[data-active="true"]');
                if (activeButton) {
                    displayCategory(filteredData, activeButton.dataset.category);
                } else {
                    displayResults(filteredData, query);
                }
            } else {
                // Afficher un message si la requête est trop courte
                const message = document.createElement('div');
                message.textContent = 'Please type more than 3 characters.';
                message.style.textAlign = 'center';
                message.style.padding = '20px';
                message.style.backgroundColor = '#f8d7da';
                message.style.color = '#721c24';
                message.style.border = '1px solid #f5c6cb';
                message.style.borderRadius = '5px';
                message.style.marginTop = '20px';
                resultsContainer.appendChild(message);

                // Réinitialiser les boutons de catégorie (afficher toutes les catégories)
                createCategoryButtons(data, '');
            }
        }, 500); // Délai de refresh après sélection des carctères

        // Écouteur d'événement pour la barre de recherche
        searchBar.addEventListener('input', debouncedSearch);
    } else {
        resultsContainer.innerHTML = '<p>Erreur lors du chargement des données.</p>';
    }
}

init();