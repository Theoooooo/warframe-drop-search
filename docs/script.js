const rarityTable = ["Very Common", "Common", "Uncommon", "Rare", "Ultra Rare", "Legendary"];
const rarityColor = ["#FFFFFF", "#FFF6FF", "#E1F8FF", "#92FFFF", "#A5FEB5", "#FAE470"];
const rotationTable = ["Rotation A", "Rotation B", "Rotation C"];
const rotationColor = ["#FFFFFF", "#CBFFCC", "#79FF7C"];

const standardLootCategories = ["Missions:", "Relics:", "Keys:", "Dynamic Location Rewards:", "Sorties:"]
const modLootCategories = ["Mod Drops by Mod:"]

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

function displayResults(data, query) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    Object.keys(data).forEach(category => {
        const filteredItems = data[category].filter(item =>
            item.Loot.toLowerCase().includes(query) || item.Source.toLowerCase().includes(query)
        );

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
                    actualChanceCell.textContent = ((parseFloat(item["Mod Drop Chance"])/100) * (parseFloat(item.Percentage)/100) * 100).toFixed(3) + '%';
                    row.appendChild(actualChanceCell);

                    tableBody.appendChild(row);
                });
            }

            table.appendChild(tableBody);
            divTable.appendChild(table);
            resultsContainer.appendChild(divTable);
        } else {
            const message = document.createElement('div');
            message.innerHTML = 'No Result found in category <b>'+category+'</b> .';
            message.style.textAlign = 'center';
            message.style.padding = '20px';
            message.style.backgroundColor = '#d7daf8';
            message.style.color = '#1c3272';
            message.style.border = '1px solid #cac6f5';
            message.style.borderRadius = '5px';
            message.style.marginTop = '20px';
            resultsContainer.appendChild(message);
        }
    });
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

async function init() {
    const loader = document.getElementById('loader');
    const searchBar = document.getElementById('searchBar');
    const resultsContainer = document.getElementById('results');

    loader.style.display = 'block';
    resultsContainer.style.display = 'none';

    const data = await loadData();

    loader.style.display = 'none';
    resultsContainer.style.display = 'block';

    if (data) {
        searchBar.addEventListener('input', () => {
            const query = searchBar.value.toLowerCase();

            // Effacer les résultats précédents
            resultsContainer.innerHTML = '';

            if (query.length >= 3) {
                displayResults(data, query);
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
            }
        });
    } else {
        resultsContainer.innerHTML = '<p>Erreur lors du chargement des données.</p>';
    }
}

init();