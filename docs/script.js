const rarityTable = ["Very Common", "Common", "Uncommon", "Rare", "Ultra Rare", "Legendary"];
const rarityColor = ["#FFFFFF", "#FFF6FF", "#E1F8FF", "#92FFFF", "#A5FEB5", "#FAE470"];
const rotationTable = ["Rotation A", "Rotation B", "Rotation C"];
const rotationColor = ["#FFFFFF", "#CBFFCC", "#79FF7C"];

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
            item.Objet.toLowerCase().includes(query)
        );

        if (filteredItems.length > 0) {
            const categoryHeader = document.createElement('h2');
            categoryHeader.textContent = category;
            resultsContainer.appendChild(categoryHeader);

            const divTable = document.createElement('div');
            divTable.className = "tableContent";

            const table = document.createElement('table');
            table.style.width = '100%';
            table.setAttribute('cellpadding', '5');

            const tableHeader = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const headers = ["Mission", "Type de Mission", "Rotation", "Objet", "Catégorie", "Pourcentage"];

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

            const tableBody = document.createElement('tbody');

            filteredItems.forEach(item => {
                const row = document.createElement('tr');

                const missionCell = document.createElement('td');
                missionCell.textContent = item.Mission;
                row.appendChild(missionCell);

                const missionTypeCell = document.createElement('td');
                missionTypeCell.textContent = item["Type de Mission"];
                row.appendChild(missionTypeCell);

                const rotationCell = document.createElement('td');
                rotationCell.textContent = item.Rotation;
                rotationCell.style.backgroundColor = extractColorCode(item.Rotation, "rotation");
                row.appendChild(rotationCell);

                const objetCell = document.createElement('td');
                objetCell.textContent = item.Objet;
                row.appendChild(objetCell);

                const categorieCell = document.createElement('td');
                categorieCell.textContent = item.Catégorie;
                categorieCell.style.backgroundColor = extractColorCode(item.Catégorie, "rarity");
                row.appendChild(categorieCell);

                const pourcentageCell = document.createElement('td');
                pourcentageCell.textContent = item.Pourcentage;
                row.appendChild(pourcentageCell);

                tableBody.appendChild(row);
            });

            table.appendChild(tableBody);
            divTable.appendChild(table);
            resultsContainer.appendChild(divTable);
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
            displayResults(data, searchBar.value.toLowerCase());
        });
    } else {
        resultsContainer.innerHTML = '<p>Error while loading datas.</p>';
    }
}

init();