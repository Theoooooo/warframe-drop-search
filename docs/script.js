// Warframe Drop Search : recherche, menu des catégories, tri, pagination et
// noms cliquables qui relancent la recherche.
// JavaScript natif, sans dépendance ni étape de build.
(function () {
    'use strict';

    var DATA_URL = 'data/data.json';
    var TIMERS_KEY = 'Timers';
    var VAULTED_KEY = 'Vaulted Relics';
    var HISTORY_DATA_KEY = 'Update History';
    var MIN_QUERY_LENGTH = 3;
    var MAX_CONDITIONS = 5;   // conditions « AND » et « OR » par recherche
    var DEBOUNCE_MS = 300;
    var PAGE_SIZE = 100;
    var EMPTY_VALUE = '—';
    var PLACEHOLDER_VALUES = ['no_rotation', 'no_mission_type'];

    // Recherches sauvegardées : un cookie dédié, limité au chemin du site.
    // Un cookie plafonne à environ 4 Ko, d'où les deux limites ci-dessous.
    var SAVED_COOKIE = 'wds_saved_searches';
    var SAVED_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;   // 400 jours, maximum admis
    var SAVED_COOKIE_MAX_LENGTH = 3800;
    var SAVED_MAX_ENTRIES = 20;
    var SAVED_NAME_MAX_LENGTH = 60;

    // Suivi de quantités : loots et ressources à collecter, dans un cookie dédié.
    var TRACKED_COOKIE = 'wds_tracked_items';
    var SETTINGS_COOKIE = 'wds_settings';
    var TRACKED_MAX_ENTRIES = 30;
    var TRACKED_MAX_QUANTITY = 9999;
    var TRACKED_NAME_MAX_LENGTH = 80;

    // Historique : les dernières recherches validées, dans un second cookie.
    var HISTORY_COOKIE = 'wds_search_history';
    var HISTORY_MAX_ENTRIES = 10;

    // Colonnes par famille de tableau. `key` désigne le champ de data.json,
    // `kind` pilote le rendu et le tri. Les colonnes `link` (source et loot)
    // sont cliquables : un clic relance la recherche sur leur valeur. La famille d'une catégorie est
    // déduite des champs de ses lignes (voir detectFamily), si bien qu'une
    // nouvelle catégorie de data.json s'affiche sans modifier ce fichier.
    var FAMILIES = {
        standard: [
            { label: 'Mission', key: 'Source', kind: 'link' },
            { label: 'Mission Type', key: 'Mission Type', kind: 'text' },
            { label: 'Rotation', key: 'Rotation', kind: 'rotation' },
            { label: 'Loot', key: 'Loot', kind: 'link' },
            { label: 'Category', key: 'Rarity', kind: 'rarity' },
            { label: 'Percentage', key: 'Percentage', kind: 'percent' }
        ],
        byDrop: [
            { label: 'Source', key: 'Source', kind: 'link' },
            { label: 'Mod Drop Chance', key: 'Mod Drop Chance', kind: 'percent' },
            { label: 'Mod', key: 'Loot', kind: 'link' },
            { label: 'Rarity', key: 'Rarity', kind: 'rarity' },
            { label: 'Percentage', key: 'Percentage', kind: 'percent' },
            { label: 'Actual Chance', key: 'actualChance', kind: 'actual' }
        ],
        bounty: [
            { label: 'Bounty', key: 'Source', kind: 'link' },
            { label: 'Rotation', key: 'Rotation', kind: 'rotation' },
            { label: 'Stage', key: 'Stage', kind: 'text' },
            { label: 'Reward', key: 'Loot', kind: 'link' },
            { label: 'Rarity', key: 'Rarity', kind: 'rarity' },
            { label: 'Percentage', key: 'Percentage', kind: 'percent' }
        ],
        bySource: [
            { label: 'Source', key: 'Source', kind: 'link' },
            { label: 'Loot Drop Chance', key: 'Loot Drop Chance', kind: 'percent' },
            { label: 'Loot', key: 'Loot', kind: 'link' },
            { label: 'Rarity', key: 'Rarity', kind: 'rarity' },
            { label: 'Percentage', key: 'Percentage', kind: 'percent' },
            { label: 'Actual Chance', key: 'actualChance', kind: 'actual' }
        ]
    };

    var RARITY_TONES = {
        'Very Common': 'tone-very-common',
        'Common': 'tone-common',
        'Uncommon': 'tone-uncommon',
        'Rare': 'tone-rare',
        'Ultra Rare': 'tone-ultra-rare',
        'Legendary': 'tone-legendary'
    };
    var RARITY_FALLBACK_TONE = 'tone-beyond';
    var ROTATION_TONES = {
        'Rotation A': 'tone-rotation-a',
        'Rotation B': 'tone-rotation-b',
        'Rotation C': 'tone-rotation-c'
    };

    var elements = {
        search: document.getElementById('searchBar'),
        clear: document.getElementById('search-clear'),
        save: document.getElementById('search-save'),
        and: document.getElementById('search-and'),
        or: document.getElementById('search-or'),
        conditions: document.getElementById('search-conditions'),
        searchField: document.getElementById('search-field'),
        history: document.getElementById('search-history'),
        historyList: document.getElementById('search-history-list'),
        historyClear: document.getElementById('search-history-clear'),
        savedButton: document.getElementById('saved-button'),
        savedCount: document.getElementById('saved-count'),
        savedDialog: document.getElementById('saved-dialog'),
        savedClose: document.getElementById('saved-close'),
        savedError: document.getElementById('saved-error'),
        savedEmpty: document.getElementById('saved-empty'),
        trackerButton: document.getElementById('tracker-button'),
        trackerCount: document.getElementById('tracker-count'),
        trackerDialog: document.getElementById('tracker-dialog'),
        trackerClose: document.getElementById('tracker-close'),
        trackerActions: document.getElementById('tracker-actions'),
        trackerZeroNote: document.getElementById('tracker-zero-note'),
        settingsButton: document.getElementById('settings-button'),
        settingsDialog: document.getElementById('settings-dialog'),
        settingsClose: document.getElementById('settings-close'),
        settingsError: document.getElementById('settings-error'),
        settingAutoRemove: document.getElementById('setting-auto-remove'),
        trackerFilter: document.getElementById('tracker-filter'),
        trackerFilterField: document.getElementById('tracker-filter-field'),
        trackerNoMatch: document.getElementById('tracker-no-match'),
        trackerDeleteAll: document.getElementById('tracker-delete-all'),
        trackerError: document.getElementById('tracker-error'),
        trackerEmpty: document.getElementById('tracker-empty'),
        trackerList: document.getElementById('tracker-list'),
        savedFilter: document.getElementById('saved-filter'),
        savedFilterField: document.getElementById('saved-filter-field'),
        savedNoMatch: document.getElementById('saved-no-match'),
        savedList: document.getElementById('saved-list'),
        hint: document.getElementById('search-hint'),
        category: document.getElementById('category-select'),
        loader: document.getElementById('loader'),
        summary: document.getElementById('summary'),
        results: document.getElementById('results'),
        updateTime: document.getElementById('update-time'),
        changesButton: document.getElementById('changes-button'),
        changesCount: document.getElementById('changes-count'),
        changesDialog: document.getElementById('changes-dialog'),
        changesClose: document.getElementById('changes-close'),
        changesEmpty: document.getElementById('changes-empty'),
        changesList: document.getElementById('changes-list'),
        changesDate: document.getElementById('changes-date'),
        changesDateLabel: document.getElementById('changes-date-label'),
        changesCalendar: document.getElementById('changes-calendar'),
        versionButton: document.getElementById('version-button'),
        versionDialog: document.getElementById('version-dialog'),
        versionClose: document.getElementById('version-close'),
        versionList: document.getElementById('version-list'),
        themeToggle: document.getElementById('theme-toggle')
    };

    var DEFAULT_HINT = elements.hint.textContent;

    var state = {
        categories: [],      // [{ name, columns, rows }]
        extra: [],           // conditions : { op: 'and' | 'or', value: texte brut du champ }
        query: '',           // requête en minuscules, espaces de bord retirés
        activeCategory: null,
        views: {},           // nom de catégorie -> { sortIndex, ascending, page }
        vaulted: {},         // nom de relique -> true si elle est vaultée
        saved: [],           // [{ name, query, category }] : recherches sauvegardées
        savedFilter: '',     // filtre de la fenêtre des sauvegardes, en minuscules
        changes: [],         // jours où les données ont changé
        changeIndex: 0,      // entrée affichée dans la fenêtre des changements
        calendarMonth: { year: 0, month: 0 }, // mois affiché par le calendrier
        lastRefresh: null,   // jour de la dernière extraction : { year, month, day }
        settings: { autoRemove: false }, // options du site (cookie)
        tracked: [],         // éléments suivis : { name, quantity }
        trackerFilter: '',   // filtre de la fenêtre du tracker, en minuscules
        confirmDeleteAll: false, // premier clic sur « Delete all » effectué
        editingSaved: null,  // index de la sauvegarde en cours de renommage
        history: [],         // dernières recherches validées, la plus récente en tête
        quietFocus: false    // vrai pendant un focus programmé qui ne doit pas ouvrir l'historique
    };

    // --- Utilitaires -------------------------------------------------------

    function createElement(tag, className, text) {
        var element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (text !== undefined) {
            element.textContent = text;
        }
        return element;
    }

    function clear(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function formatCount(value) {
        return value.toLocaleString('en-US');
    }

    function debounce(callback, delay) {
        var timer = null;
        return function () {
            window.clearTimeout(timer);
            timer = window.setTimeout(callback, delay);
        };
    }

    // "12.50%" -> 12.5 ; valeur non numérique -> NaN.
    function parsePercent(value) {
        return parseFloat(String(value).replace('%', ''));
    }

    // Chance réelle = chance que la source lâche un objet de la catégorie
    // multipliée par la chance de l'objet dans cette table. Résultat en %.
    function computeActualChance(sourceChance, itemChance) {
        return (parsePercent(sourceChance) / 100) * (parsePercent(itemChance) / 100) * 100;
    }

    // --- Préparation des données -------------------------------------------

    function detectFamily(row) {
        if ('Mission Type' in row) {
            return 'standard';
        }
        if ('Stage' in row) {
            return 'bounty';
        }
        if ('Mod Drop Chance' in row) {
            return 'byDrop';
        }
        if ('Loot Drop Chance' in row) {
            return 'bySource';
        }
        return null;
    }

    // "Axi A1 Relic (Radiant)" -> "Axi A1 Relic"
    function relicBaseName(name) {
        return String(name).replace(/\s*\([^)]*\)$/, '').trim();
    }

    // La liste des reliques vaultées est calculée à l'extraction des données
    // (voir data-retriever.py) ; le site se contente de l'afficher.
    function prepareVaulted(data) {
        var vaulted = Object.create(null);
        var names = data[VAULTED_KEY];
        if (Array.isArray(names)) {
            names.forEach(function (name) {
                if (typeof name === 'string') {
                    vaulted[name] = true;
                }
            });
        }
        return vaulted;
    }

    function prepareCategories(data) {
        var categories = [];
        Object.keys(data).forEach(function (name) {
            var rows = data[name];
            if (name === TIMERS_KEY || name === VAULTED_KEY || name === HISTORY_DATA_KEY || !Array.isArray(rows) || rows.length === 0) {
                return;
            }
            var family = detectFamily(rows[0]);
            if (family === null) {
                return;
            }
            rows.forEach(function (row) {
                // Index de recherche calculé une seule fois au chargement.
                row.searchText = (row.Loot + '\n' + row.Source).toLowerCase();
                if (family === 'byDrop') {
                    row.actualChance = computeActualChance(row['Mod Drop Chance'], row.Percentage);
                } else if (family === 'bySource') {
                    row.actualChance = computeActualChance(row['Loot Drop Chance'], row.Percentage);
                }
            });
            // La colonne Rotation est retirée des catégories où aucune ligne
            // n'a de rotation (reliques, sorties...) : elle n'y afficherait
            // que des tirets.
            var hasRotation = rows.some(function (row) {
                return row.Rotation !== undefined && PLACEHOLDER_VALUES.indexOf(row.Rotation) === -1;
            });
            var columns = FAMILIES[family].filter(function (column) {
                return column.kind !== 'rotation' || hasRotation;
            });
            categories.push({ name: name, columns: columns, rows: rows });
        });
        return categories;
    }

    // --- Filtrage, tri, pagination -----------------------------------------

    function isSearching() {
        return state.query.length >= MIN_QUERY_LENGTH;
    }

    function filterRows(category) {
        if (!isSearching()) {
            return category.rows;
        }
        // Chaque groupe doit avoir au moins un terme présent dans la ligne.
        var groups = termGroups(state.query, activeConditions()).map(function (group) {
            return group.map(function (term) {
                return term.toLowerCase();
            });
        });
        return category.rows.filter(function (row) {
            return groups.every(function (group) {
                return group.some(function (term) {
                    return row.searchText.indexOf(term) !== -1;
                });
            });
        });
    }

    function getView(name) {
        if (!state.views[name]) {
            state.views[name] = { sortIndex: null, ascending: true, page: 0 };
        }
        return state.views[name];
    }

    function resetViews() {
        state.views = {};
    }

    function sortRows(rows, column, ascending) {
        var numeric = column.kind === 'percent' || column.kind === 'actual';
        var direction = ascending ? 1 : -1;
        var sorted = rows.slice();
        sorted.sort(function (a, b) {
            if (numeric) {
                var left = column.kind === 'actual' ? a[column.key] : parsePercent(a[column.key]);
                var right = column.kind === 'actual' ? b[column.key] : parsePercent(b[column.key]);
                // Les valeurs non numériques restent en fin de liste dans
                // les deux sens de tri.
                if (isNaN(left) || isNaN(right)) {
                    return (isNaN(left) ? 1 : 0) - (isNaN(right) ? 1 : 0);
                }
                return (left - right) * direction;
            }
            return String(a[column.key]).localeCompare(String(b[column.key]), 'en', { numeric: true }) * direction;
        });
        return sorted;
    }

    // --- Rendu des cellules ------------------------------------------------

    function renderCell(row, column) {
        var cell = document.createElement('td');
        var value = row[column.key];

        if (column.kind === 'actual') {
            cell.className = 'cell--number';
            cell.textContent = isNaN(value) ? EMPTY_VALUE : value.toFixed(3) + '%';
            return cell;
        }
        if (value === undefined || value === '' || PLACEHOLDER_VALUES.indexOf(value) !== -1) {
            cell.className = 'cell--muted';
            cell.textContent = EMPTY_VALUE;
            return cell;
        }
        if (column.kind === 'rarity') {
            cell.appendChild(createElement('span', 'badge badge--tone ' + (RARITY_TONES[value] || RARITY_FALLBACK_TONE), value));
            return cell;
        }
        if (column.kind === 'rotation' && ROTATION_TONES[value]) {
            cell.appendChild(createElement('span', 'badge badge--tone ' + ROTATION_TONES[value], value));
            return cell;
        }
        if (column.kind === 'link') {
            var link = createElement('button', 'cell-link', value);
            link.type = 'button';
            link.title = 'Search for "' + value + '"';
            cell.appendChild(link);
            if (state.vaulted[relicBaseName(value)]) {
                var vault = createElement('span', 'badge badge--vault', 'Vault');
                vault.title = 'Vaulted relic: no longer obtainable as a reward';
                cell.appendChild(vault);
            }
            // Tout loot peut être suivi ; côté source, seulement les reliques,
            // qui sont elles-mêmes une ressource à farmer.
            if (column.key === 'Loot' || isRelicName(value)) {
                // Nom à gauche, contrôles de suivi calés à droite.
                var layout = createElement('div', 'loot-cell');
                var label = createElement('span', 'loot-cell__name');
                while (cell.firstChild) {
                    label.appendChild(cell.firstChild);
                }
                layout.appendChild(label);
                layout.appendChild(createTrackControls(value));
                cell.appendChild(layout);
            }
            return cell;
        }
        if (column.kind === 'percent') {
            cell.className = 'cell--number';
        }
        cell.textContent = value;
        return cell;
    }

    // --- Rendu d'une catégorie ---------------------------------------------

    function renderHeaderCell(category, column, index, view) {
        var header = document.createElement('th');
        header.scope = 'col';
        var sorted = view.sortIndex === index;
        if (sorted) {
            header.setAttribute('aria-sort', view.ascending ? 'ascending' : 'descending');
        }
        var button = createElement('button', 'sort-button');
        button.type = 'button';
        button.appendChild(createElement('span', null, column.label));
        var icon = createElement('span', 'sort-button__icon', sorted ? (view.ascending ? '↑' : '↓') : '↕');
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);
        button.addEventListener('click', function () {
            view.ascending = sorted ? !view.ascending : true;
            view.sortIndex = index;
            view.page = 0;
            renderResults();
            // Le tableau est reconstruit : on rend le focus au même en-tête.
            var replacement = document.querySelector(
                '[data-category="' + cssEscape(category.name) + '"] th:nth-child(' + (index + 1) + ') .sort-button'
            );
            if (replacement) {
                replacement.focus();
            }
        });
        header.appendChild(button);
        return header;
    }

    function cssEscape(value) {
        if (window.CSS && window.CSS.escape) {
            return window.CSS.escape(value);
        }
        return String(value).replace(/["\\]/g, '\\$&');
    }

    function renderPager(view, total, pageCount) {
        var pager = createElement('div', 'pager');
        var first = view.page * PAGE_SIZE + 1;
        var last = Math.min(total, (view.page + 1) * PAGE_SIZE);
        pager.appendChild(createElement('span', null,
            'Rows ' + formatCount(first) + '–' + formatCount(last) + ' of ' + formatCount(total)));

        var controls = createElement('div', 'pager__controls');
        var previous = createElement('button', 'button button--outline', 'Previous');
        previous.type = 'button';
        previous.disabled = view.page === 0;
        previous.addEventListener('click', function () {
            view.page -= 1;
            renderResults();
        });
        var next = createElement('button', 'button button--outline', 'Next');
        next.type = 'button';
        next.disabled = view.page >= pageCount - 1;
        next.addEventListener('click', function () {
            view.page += 1;
            renderResults();
        });
        controls.appendChild(previous);
        controls.appendChild(createElement('span', null, 'Page ' + formatCount(view.page + 1) + ' / ' + formatCount(pageCount)));
        controls.appendChild(next);
        pager.appendChild(controls);
        return pager;
    }

    function renderCategory(category, rows) {
        var view = getView(category.name);
        var pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        view.page = Math.min(Math.max(view.page, 0), pageCount - 1);

        var ordered = view.sortIndex === null
            ? rows
            : sortRows(rows, category.columns[view.sortIndex], view.ascending);
        var visible = ordered.slice(view.page * PAGE_SIZE, (view.page + 1) * PAGE_SIZE);

        var card = createElement('section', 'card result-card');
        card.dataset.category = category.name;

        var header = createElement('div', 'result-card__header');
        header.appendChild(createElement('h2', null, categoryLabel(category.name)));
        header.appendChild(createElement('span', 'badge badge--outline',
            formatCount(rows.length) + (rows.length === 1 ? ' result' : ' results')));
        card.appendChild(header);

        var scroll = createElement('div', 'table-scroll');
        var table = createElement('table', 'table');
        var head = document.createElement('thead');
        var headRow = document.createElement('tr');
        category.columns.forEach(function (column, index) {
            headRow.appendChild(renderHeaderCell(category, column, index, view));
        });
        head.appendChild(headRow);
        table.appendChild(head);

        var body = document.createElement('tbody');
        visible.forEach(function (row) {
            var line = document.createElement('tr');
            category.columns.forEach(function (column) {
                line.appendChild(renderCell(row, column));
            });
            body.appendChild(line);
        });
        table.appendChild(body);
        scroll.appendChild(table);
        card.appendChild(scroll);

        if (pageCount > 1) {
            card.appendChild(renderPager(view, rows.length, pageCount));
        }
        return card;
    }

    // --- Rendu des états ---------------------------------------------------

    function renderState(title, text, modifier) {
        var box = createElement('div', 'state' + (modifier ? ' ' + modifier : ''));
        box.appendChild(createElement('p', 'state__title', title));
        if (text) {
            box.appendChild(createElement('p', 'state__text', text));
        }
        return box;
    }

    function renderLoading() {
        elements.category.disabled = true;
        clear(elements.results);
        var index;
        var card = createElement('div', 'card');
        card.setAttribute('aria-hidden', 'true');
        for (index = 0; index < 10; index += 1) {
            card.appendChild(createElement('div', 'skeleton skeleton--row'));
        }
        elements.results.appendChild(card);
        elements.summary.textContent = 'Loading drop tables…';
    }

    function renderLoadError() {
        clear(elements.results);
        elements.summary.textContent = '';
        var box = renderState('The drop tables could not be loaded.',
            'Check your connection, then try again.', 'state--error');
        var retry = createElement('button', 'button button--primary', 'Try again');
        retry.type = 'button';
        retry.addEventListener('click', load);
        box.appendChild(retry);
        elements.results.appendChild(box);
    }

    // --- Rendu des filtres et des résultats --------------------------------

    function categoryLabel(name) {
        return name.replace(/:$/, '');
    }

    function renderCategoryOptions(counts) {
        var select = elements.category;
        var searching = isSearching();
        var total = 0;
        clear(select);

        var all = createElement('option', null, 'All categories');
        all.value = '';
        select.appendChild(all);

        state.categories.forEach(function (category) {
            var count = counts[category.name];
            var active = state.activeCategory === category.name;
            total += count;
            // Une catégorie sans résultat est retirée du menu, sauf si elle
            // est sélectionnée : elle doit rester affichée comme choix actif.
            if (count === 0 && !active) {
                return;
            }
            var option = createElement('option', null,
                categoryLabel(category.name) + ' (' + formatCount(count) + ')');
            option.value = category.name;
            select.appendChild(option);
        });

        if (searching) {
            all.textContent = 'All categories (' + formatCount(total) + ')';
        }
        select.value = state.activeCategory === null ? '' : state.activeCategory;
        select.disabled = false;
    }

    // Pendant la saisie : les résultats précédents sont retirés et le spinner
    // tourne jusqu'au prochain rendu (fin de la temporisation).
    function showSearching() {
        if (state.categories.length === 0) {
            return;
        }
        clear(elements.results);
        elements.summary.textContent = '';
        elements.loader.hidden = false;
    }

    // La croix n'apparaît que lorsqu'il y a quelque chose à effacer.
    function syncClearButton() {
        elements.clear.hidden = elements.search.value === '';
    }

    // Recherche lancée par un clic sur un nom de source ou de loot : toutes
    // les catégories sont de nouveau interrogées pour lister ses sources.
    function searchFor(value) {
        elements.search.value = value;
        state.query = value.trim().toLowerCase();
        state.activeCategory = null;
        // Nouvelle recherche : les conditions de la précédente ne s'appliquent plus.
        setConditions([]);
        resetViews();
        render();
        recordSearch(value);
        window.scrollTo(0, 0);
        focusSearchQuietly();
    }

    var filtered = {};   // nom de catégorie -> lignes correspondant à la requête

    function renderResults() {
        clear(elements.results);
        var searching = isSearching();

        if (!searching && state.activeCategory === null) {
            elements.summary.textContent = '';
            elements.results.appendChild(renderState('Start with a search or a category',
                'Type at least ' + MIN_QUERY_LENGTH + ' characters of a loot or source name, or pick a category in the menu to browse it entirely.'));
            return;
        }

        var shown = state.categories.filter(function (category) {
            if (state.activeCategory !== null && category.name !== state.activeCategory) {
                return false;
            }
            return filtered[category.name].length > 0;
        });

        if (shown.length === 0) {
            elements.summary.textContent = 'No result';
            var scope = state.activeCategory === null
                ? ''
                : ' in ' + categoryLabel(state.activeCategory);
            elements.results.appendChild(renderState('No result found for your search' + scope + '.',
                state.activeCategory === null
                    ? 'Check the spelling or try a shorter name.'
                    : 'Switch the menu back to "All categories" to search every drop table.'));
            return;
        }

        var total = 0;
        shown.forEach(function (category) {
            total += filtered[category.name].length;
            elements.results.appendChild(renderCategory(category, filtered[category.name]));
        });
        elements.summary.textContent = formatCount(total) + (total === 1 ? ' result' : ' results')
            + ' in ' + shown.length + (shown.length === 1 ? ' category' : ' categories');
    }

    function render() {
        elements.loader.hidden = true;
        var counts = {};
        filtered = {};
        state.categories.forEach(function (category) {
            filtered[category.name] = filterRows(category);
            counts[category.name] = filtered[category.name].length;
        });

        var tooShort = state.query.length > 0 && !isSearching();
        elements.hint.textContent = tooShort
            ? 'Please type at least ' + MIN_QUERY_LENGTH + ' characters.'
            : DEFAULT_HINT;
        elements.hint.classList.toggle('field-hint--error', tooShort);

        syncClearButton();
        syncSaveButton();
        renderCategoryOptions(counts);
        renderResults();
        syncUrl();
    }

    // --- Conditions « AND » et « OR » ---------------------------------------
    //
    // Chaque condition est un champ supplémentaire sous la barre de recherche,
    // précédé de son opérateur. « OR » lie plus fort que « AND » : une
    // condition « OR » est une alternative au terme qui la précède.
    //
    //   A AND B OR C   se lit   A AND (B OR C)
    //   A OR B AND C   se lit   (A OR B) AND C
    //
    // La recherche est donc une suite de groupes reliés par « AND », chaque
    // groupe étant une liste d'alternatives reliées par « OR ». Une ligne est
    // gardée si, dans chaque groupe, au moins un terme figure dans sa source
    // ou son loot.

    // Normalise des conditions venues de l'état, de l'URL ou d'un cookie.
    // Formes acceptées : "texte" (AND, format des sauvegardes d'origine),
    // ["or", "texte"] (cookie) et { op, value } (état).
    function sanitizeExtra(values) {
        var kept = [];
        (Array.isArray(values) ? values : []).forEach(function (item) {
            var op = 'and';
            var value = item;
            if (Array.isArray(item)) {
                op = item[0];
                value = item[1];
            } else if (item && typeof item === 'object') {
                op = item.op;
                value = item.value;
            }
            if (typeof value === 'string' && value.trim() !== '' && kept.length < MAX_CONDITIONS) {
                kept.push({ op: op === 'or' ? 'or' : 'and', value: value.trim() });
            }
        });
        return kept;
    }

    // Conditions réellement appliquées : les champs laissés vides sont ignorés.
    function activeConditions() {
        return sanitizeExtra(state.extra);
    }

    // Découpe une recherche en groupes d'alternatives (voir en-tête).
    function termGroups(query, conditions) {
        var groups = query ? [[query]] : [];
        conditions.forEach(function (condition) {
            if (condition.op === 'or' && groups.length > 0) {
                groups[groups.length - 1].push(condition.value);
            } else {
                groups.push([condition.value]);
            }
        });
        return groups;
    }

    // Écriture lisible d'une recherche, parenthèses comprises quand elles
    // lèvent une ambiguïté : "A" AND ("B" OR "C").
    function formatExpression(query, conditions, quote) {
        var groups = termGroups(query, conditions);
        return groups.map(function (group) {
            var text = group.map(function (term) {
                return quote + term + quote;
            }).join(' OR ');
            return group.length > 1 && groups.length > 1 ? '(' + text + ')' : text;
        }).join(' AND ');
    }

    // Empreinte des conditions, pour comparer deux recherches sans tenir
    // compte de la casse.
    function conditionsKey(conditions) {
        return conditions.map(function (condition) {
            return condition.op + '\t' + condition.value.toLowerCase();
        }).join('\n');
    }

    function syncConditionButtons() {
        var full = state.extra.length >= MAX_CONDITIONS;
        [[elements.and, 'AND', 'narrow the results'], [elements.or, 'OR', 'add an alternative to the previous term']]
            .forEach(function (item) {
                item[0].disabled = full;
                item[0].title = full
                    ? 'A search can have up to ' + MAX_CONDITIONS + ' conditions'
                    : 'Add an ' + item[1] + ' condition: ' + item[2];
            });
    }

    var scheduleRender = debounce(function () {
        if (state.categories.length === 0) {
            return;
        }
        resetViews();
        render();
    }, DEBOUNCE_MS);

    function applyConditions() {
        syncSaveButton();
        if (state.categories.length > 0) {
            resetViews();
            render();
        }
    }

    // Reconstruit les champs à partir de state.extra. `focusIndex` et
    // `focusPart` ('input' ou 'operator') désignent l'élément qui doit
    // recevoir le focus après reconstruction.
    function renderConditions(focusIndex, focusPart) {
        clear(elements.conditions);
        elements.conditions.hidden = state.extra.length === 0;
        var focusTarget = null;

        state.extra.forEach(function (condition, index) {
            var isOr = condition.op === 'or';
            var row = createElement('div', 'condition' + (isOr ? ' condition--or' : ''));

            // L'étiquette est un bouton : un clic bascule entre AND et OR.
            var operator = createElement('button', 'condition__label', isOr ? 'OR' : 'AND');
            operator.type = 'button';
            operator.title = 'Switch to ' + (isOr ? 'AND' : 'OR');
            operator.setAttribute('aria-label',
                'Condition ' + (index + 1) + ' is ' + (isOr ? 'OR' : 'AND') + ', switch to ' + (isOr ? 'AND' : 'OR'));
            operator.addEventListener('click', function () {
                condition.op = isOr ? 'and' : 'or';
                renderConditions(index, 'operator');
                applyConditions();
            });

            var input = createElement('input', 'input condition__input');
            input.type = 'search';
            input.value = condition.value;
            input.placeholder = isOr
                ? 'Alternative to the previous term'
                : 'Refine the results: loot or source name';
            input.autocomplete = 'off';
            input.spellcheck = false;
            input.setAttribute('aria-label', (isOr ? 'OR' : 'AND') + ' condition ' + (index + 1));
            input.addEventListener('input', function () {
                condition.value = input.value;
                syncSaveButton();
                showSearching();
                scheduleRender();
            });

            var remove = iconButton('Remove this condition', 'M6 6l12 12M18 6 6 18');
            remove.className = 'condition__remove';
            remove.addEventListener('click', function () {
                state.extra.splice(index, 1);
                renderConditions();
                // Le bouton cliqué vient de disparaître : le focus va sur
                // « AND » (toujours actif après un retrait) plutôt que dans
                // la barre, pour ne pas y placer le curseur ni ouvrir
                // l'historique.
                elements.and.focus();
                applyConditions();
            });

            row.appendChild(operator);
            row.appendChild(input);
            row.appendChild(remove);
            elements.conditions.appendChild(row);
            if (index === focusIndex) {
                focusTarget = focusPart === 'operator' ? operator : input;
            }
        });

        syncConditionButtons();
        if (focusTarget !== null) {
            focusTarget.focus();
        }
    }

    function addCondition(op) {
        if (state.extra.length >= MAX_CONDITIONS) {
            return;
        }
        state.extra.push({ op: op, value: '' });
        renderConditions(state.extra.length - 1, 'input');
    }

    function setConditions(values) {
        state.extra = sanitizeExtra(values);
        renderConditions();
    }

    // --- Adresse partageable -----------------------------------------------

    function readUrl() {
        var params = new URLSearchParams(window.location.search);
        var query = (params.get('q') || '').trim();
        var category = params.get('category');
        elements.search.value = query;
        state.query = query.toLowerCase();
        // Les paramètres « and » et « or » sont lus dans l'ordre de l'adresse.
        var conditions = [];
        params.forEach(function (value, key) {
            if (key === 'and' || key === 'or') {
                conditions.push({ op: key, value: value });
            }
        });
        setConditions(conditions);
        state.activeCategory = state.categories.some(function (item) {
            return item.name === category;
        }) ? category : null;
    }

    function syncUrl() {
        var params = new URLSearchParams();
        var query = elements.search.value.trim();
        if (query) {
            params.set('q', query);
        }
        activeConditions().forEach(function (condition) {
            params.append(condition.op, condition.value);
        });
        if (state.activeCategory !== null) {
            params.set('category', state.activeCategory);
        }
        var search = params.toString();
        try {
            window.history.replaceState(null, '', window.location.pathname + (search ? '?' + search : ''));
        } catch (error) {
            // Certains contextes (fichier local) refusent replaceState :
            // l'adresse n'est alors simplement pas mise à jour.
        }
    }

    // --- Recherches sauvegardées (cookie) -----------------------------------

    function cookiePath() {
        var path = window.location.pathname;
        return path.slice(0, path.lastIndexOf('/') + 1) || '/';
    }

    // Lit un cookie contenant un tableau JSON ; retourne [] s'il est absent
    // ou illisible.
    function readCookieArray(name) {
        var prefix = name + '=';
        var parts = document.cookie ? document.cookie.split('; ') : [];
        var raw = null;
        parts.forEach(function (part) {
            if (part.indexOf(prefix) === 0) {
                raw = part.slice(prefix.length);
            }
        });
        if (raw === null) {
            return [];
        }
        var parsed;
        try {
            parsed = JSON.parse(decodeURIComponent(raw));
        } catch (error) {
            return [];
        }
        return Array.isArray(parsed) ? parsed : [];
    }

    // Écrit un cookie limité au chemin du site ; un tableau vide le supprime.
    // Retourne false si la valeur dépasse la taille admise.
    function writeCookieArray(name, values) {
        var value = encodeURIComponent(JSON.stringify(values));
        if (value.length > SAVED_COOKIE_MAX_LENGTH) {
            return false;
        }
        document.cookie = name + '=' + value
            + '; path=' + cookiePath()
            + '; max-age=' + (values.length === 0 ? 0 : SAVED_COOKIE_MAX_AGE)
            + '; SameSite=Lax'
            + (window.location.protocol === 'https:' ? '; Secure' : '');
        return true;
    }

    function readSavedCookie() {
        var parsed = readCookieArray(SAVED_COOKIE);
        // Le cookie est modifiable par l'utilisateur : chaque entrée est
        // revalidée avant usage.
        var entries = [];
        parsed.forEach(function (item) {
            if (item && typeof item.n === 'string' && typeof item.q === 'string'
                && (item.c === null || typeof item.c === 'string')) {
                entries.push({
                    name: item.n.slice(0, SAVED_NAME_MAX_LENGTH),
                    query: item.q,
                    category: item.c,
                    extra: sanitizeExtra(item.a)
                });
            }
        });
        return entries.slice(0, SAVED_MAX_ENTRIES);
    }

    // Retourne false si le cookie n'a pas pu être écrit (taille dépassée ou
    // cookies refusés par le navigateur).
    function writeSavedCookie(entries) {
        var written = writeCookieArray(SAVED_COOKIE, entries.map(function (entry) {
            var stored = { n: entry.name, q: entry.query, c: entry.category };
            // Champ omis sans condition : le cookie reste court et les
            // sauvegardes antérieures gardent leur format.
            if (entry.extra.length > 0) {
                // AND : simple texte ; OR : ["or", texte].
                stored.a = entry.extra.map(function (condition) {
                    return condition.op === 'or' ? ['or', condition.value] : condition.value;
                });
            }
            return stored;
        }));
        return written && readSavedCookie().length === entries.length;
    }

    function currentSearch() {
        return {
            query: elements.search.value.trim(),
            category: state.activeCategory,
            extra: activeConditions()
        };
    }

    function findSaved(search) {
        var wanted = search.query.toLowerCase();
        var wantedExtra = conditionsKey(search.extra);
        var found = -1;
        state.saved.forEach(function (entry, index) {
            if (found === -1 && entry.query.toLowerCase() === wanted && entry.category === search.category
                && conditionsKey(entry.extra) === wantedExtra) {
                found = index;
            }
        });
        return found;
    }

    function describeSearch(entry) {
        var parts = [];
        var expression = formatExpression(entry.query, entry.extra, '"');
        if (expression) {
            parts.push(expression);
        }
        parts.push(entry.category === null ? 'All categories' : categoryLabel(entry.category));
        return parts.join(' · ');
    }

    function showSavedError(message) {
        elements.savedError.textContent = message || '';
        elements.savedError.hidden = !message;
    }

    // Remplace la liste sauvegardée ; en cas d'échec d'écriture, l'état en
    // mémoire n'est pas modifié et un message est affiché.
    function commitSaved(entries, failureMessage) {
        if (!writeSavedCookie(entries)) {
            showSavedError(failureMessage);
            return false;
        }
        state.saved = entries;
        showSavedError('');
        return true;
    }

    function syncSaveButton() {
        var search = currentSearch();
        var savable = search.query.length >= MIN_QUERY_LENGTH || search.category !== null;
        var saved = savable && findSaved(search) !== -1;
        elements.save.disabled = !savable;
        elements.save.classList.toggle('is-saved', saved);
        var label = saved ? 'Search already saved, show saved searches' : 'Save this search';
        elements.save.title = label;
        elements.save.setAttribute('aria-label', label);
        elements.savedCount.textContent = String(state.saved.length);
    }

    function applySaved(entry) {
        if (state.categories.length === 0) {
            return;
        }
        elements.savedDialog.close();
        elements.search.value = entry.query;
        state.query = entry.query.trim().toLowerCase();
        setConditions(entry.extra);
        state.activeCategory = state.categories.some(function (category) {
            return category.name === entry.category;
        }) ? entry.category : null;
        resetViews();
        render();
        recordSearch(entry.query);
        window.scrollTo(0, 0);
    }

    function iconButton(label, pathData) {
        var button = createElement('button', 'button button--ghost button--icon');
        button.type = 'button';
        button.title = label;
        button.setAttribute('aria-label', label);
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'icon');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        svg.appendChild(path);
        button.appendChild(svg);
        return button;
    }

    function renderSavedRename(item, entry, index) {
        var form = createElement('form', 'saved-item__form');
        var input = createElement('input', 'input');
        input.type = 'text';
        input.value = entry.name;
        input.maxLength = SAVED_NAME_MAX_LENGTH;
        input.required = true;
        input.setAttribute('aria-label', 'Name of the saved search');
        var confirm = createElement('button', 'button button--primary', 'Rename');
        confirm.type = 'submit';
        var cancel = createElement('button', 'button button--outline', 'Cancel');
        cancel.type = 'button';
        cancel.addEventListener('click', function () {
            state.editingSaved = null;
            showSavedError('');
            renderSaved();
        });
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var name = input.value.trim();
            if (name === '') {
                showSavedError('The name cannot be empty.');
                return;
            }
            var entries = state.saved.slice();
            entries[index] = { name: name, query: entry.query, category: entry.category, extra: entry.extra };
            if (commitSaved(entries, 'This name is too long to be stored. Use a shorter one.')) {
                state.editingSaved = null;
                renderSaved();
            }
        });
        form.appendChild(input);
        form.appendChild(confirm);
        form.appendChild(cancel);
        item.appendChild(form);
        return input;
    }

    // Le filtre porte sur le nom, le texte recherché et la catégorie.
    function savedMatchesFilter(entry) {
        if (state.savedFilter === '') {
            return true;
        }
        var haystack = (entry.name + ' ' + describeSearch(entry)).toLowerCase();
        return haystack.indexOf(state.savedFilter) !== -1;
    }

    function renderSaved() {
        clear(elements.savedList);
        elements.savedEmpty.hidden = state.saved.length > 0;
        elements.savedFilterField.hidden = state.saved.length === 0;
        var current = findSaved(currentSearch());
        var focusTarget = null;
        var shown = 0;

        state.saved.forEach(function (entry, index) {
            // L'index reste celui de state.saved : renommer et supprimer
            // visent la bonne entrée même quand la liste est filtrée.
            if (!savedMatchesFilter(entry) && state.editingSaved !== index) {
                return;
            }
            shown += 1;
            var item = createElement('li', 'saved-item' + (index === current ? ' saved-item--current' : ''));
            if (state.editingSaved === index) {
                focusTarget = renderSavedRename(item, entry, index);
                elements.savedList.appendChild(item);
                return;
            }
            var apply = createElement('button', 'saved-item__apply');
            apply.type = 'button';
            apply.title = 'Run this search';
            apply.appendChild(createElement('span', 'saved-item__name', entry.name));
            apply.appendChild(createElement('span', 'saved-item__detail', describeSearch(entry)));
            apply.addEventListener('click', function () {
                applySaved(entry);
            });

            var rename = iconButton('Rename "' + entry.name + '"', 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4');
            rename.addEventListener('click', function () {
                state.editingSaved = index;
                showSavedError('');
                renderSaved();
            });

            var remove = iconButton('Delete "' + entry.name + '"', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5');
            remove.addEventListener('click', function () {
                var entries = state.saved.slice();
                entries.splice(index, 1);
                if (commitSaved(entries, 'The saved search could not be deleted.')) {
                    state.editingSaved = null;
                    renderSaved();
                }
            });

            item.appendChild(apply);
            item.appendChild(rename);
            item.appendChild(remove);
            elements.savedList.appendChild(item);
        });

        elements.savedNoMatch.hidden = state.saved.length === 0 || shown > 0;
        syncSaveButton();
        if (focusTarget !== null) {
            focusTarget.focus();
            focusTarget.select();
        }
    }

    function openSavedDialog() {
        if (!elements.savedDialog.open) {
            // Un filtre resté d'une ouverture précédente masquerait la
            // sauvegarde que l'on vient de créer.
            state.savedFilter = '';
            elements.savedFilter.value = '';
        }
        showTabDialog(elements.savedButton, elements.savedDialog);
        renderSaved();
    }

    // Bouton marque-page de la barre de recherche.
    function saveCurrentSearch() {
        var search = currentSearch();
        showSavedError('');
        state.editingSaved = null;
        if (findSaved(search) === -1) {
            if (state.saved.length >= SAVED_MAX_ENTRIES) {
                showSavedError('You can keep up to ' + SAVED_MAX_ENTRIES + ' saved searches. Delete one to save a new one.');
            } else {
                var name = (formatExpression(search.query, search.extra, '') || categoryLabel(search.category))
                    .slice(0, SAVED_NAME_MAX_LENGTH);
                var entries = state.saved.concat([{
                    name: name, query: search.query, category: search.category, extra: search.extra
                }]);
                if (commitSaved(entries, 'The search could not be saved: cookies are blocked or the storage limit is reached.')) {
                    // La nouvelle entrée s'ouvre en renommage.
                    state.editingSaved = entries.length - 1;
                }
            }
        }
        openSavedDialog();
    }

    function setupDialogDismiss(dialog, closeButton) {
        closeButton.addEventListener('click', function () {
            dialog.close();
        });
        // Un clic sur le fond (l'élément <dialog> lui-même, hors contenu)
        // ferme la fenêtre.
        dialog.addEventListener('click', function (event) {
            if (event.target === dialog) {
                dialog.close();
            }
        });
    }

    function setupSaved() {
        state.saved = readSavedCookie();
        syncSaveButton();
        elements.save.addEventListener('click', saveCurrentSearch);
        elements.savedButton.addEventListener('click', function () {
            state.editingSaved = null;
            showSavedError('');
            openSavedDialog();
        });
        elements.savedFilter.addEventListener('input', function () {
            state.savedFilter = elements.savedFilter.value.trim().toLowerCase();
            // Sinon le champ de renommage reprendrait le focus à chaque frappe.
            state.editingSaved = null;
            renderSaved();
        });
        bindTabToDialog(elements.savedButton, elements.savedDialog);
        setupDialogDismiss(elements.savedDialog, elements.savedClose);
    }

    // --- Suivi de quantités (cookie) ----------------------------------------
    //
    // Un élément suivi est toujours un loot présent dans les données : on ne
    // l'ajoute que depuis une ligne de résultat. Le préfixe de quantité de la
    // page officielle est retiré, si bien que « 100X Oxium » et « 200X Oxium »
    // partagent le même compteur « Oxium ».

    var ICON_TARGET = 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 2v2M12 20v2M2 12h2M20 12h2';
    var ICON_MINUS = 'M5 12h14';
    var ICON_PLUS = 'M12 5v14M5 12h14';
    var ICON_TRASH = 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5';

    // Nom de relique : un ou deux mots (« Axi A22 », « Requiem ») puis
    // « Relic », avec ou sans raffinement entre parenthèses. La forme stricte
    // écarte une mission comme « Help Clem Retrieve The Relic ».
    var RELIC_NAME = /^\S+( \S+)? Relic(\s*\((Intact|Exceptional|Flawless|Radiant)\))?$/;

    function isRelicName(name) {
        return RELIC_NAME.test(String(name));
    }

    // Nom canonique d'un élément suivi. Le préfixe de quantité est retiré, et
    // « (Intact) » aussi : une relique sans raffinement indiqué est intacte,
    // donc « Axi A22 Relic (Intact) » et « Axi A22 Relic » sont le même
    // élément. Les autres raffinements restent des éléments distincts.
    function trackName(loot) {
        return String(loot)
            .replace(/^[\d,.]+X\s+/i, '')
            .replace(/\s*\(Intact\)$/, '')
            .trim();
    }

    function findTracked(name) {
        var wanted = name.toLowerCase();
        for (var index = 0; index < state.tracked.length; index += 1) {
            if (state.tracked[index].name.toLowerCase() === wanted) {
                return index;
            }
        }
        return -1;
    }

    function clampQuantity(value) {
        return Math.min(TRACKED_MAX_QUANTITY, Math.max(0, Math.floor(value)));
    }

    function readTrackedCookie() {
        var entries = [];
        readCookieArray(TRACKED_COOKIE).forEach(function (item) {
            // Cookie modifiable par l'utilisateur : nom et quantité revalidés.
            if (item && typeof item.n === 'string' && item.n.trim() !== ''
                && typeof item.q === 'number' && isFinite(item.q)) {
                entries.push({
                    name: item.n.trim().slice(0, TRACKED_NAME_MAX_LENGTH),
                    quantity: clampQuantity(item.q)
                });
            }
        });
        return entries.slice(0, TRACKED_MAX_ENTRIES);
    }

    function showTrackerError(message) {
        elements.trackerError.textContent = message || '';
        elements.trackerError.hidden = !message;
    }

    function copyTracked() {
        return state.tracked.map(function (entry) {
            return { name: entry.name, quantity: entry.quantity };
        });
    }

    // Écrit le cookie puis met à jour l'état, la fenêtre et les tableaux.
    // En cas d'échec (taille dépassée, cookies refusés) rien n'est modifié et
    // la fenêtre du tracker s'ouvre pour afficher l'erreur.
    function commitTracked(entries, failureMessage) {
        var written = writeCookieArray(TRACKED_COOKIE, entries.map(function (entry) {
            return { n: entry.name, q: entry.quantity };
        }));
        if (!written || readTrackedCookie().length !== entries.length) {
            openTracker();
            showTrackerError(failureMessage);
            return false;
        }
        state.tracked = entries;
        state.confirmDeleteAll = false;
        showTrackerError('');
        return true;
    }

    function trackLoot(name) {
        if (findTracked(name) !== -1) {
            return true;
        }
        if (state.tracked.length >= TRACKED_MAX_ENTRIES) {
            openTracker();
            showTrackerError('You can track up to ' + TRACKED_MAX_ENTRIES + ' items. Delete one first.');
            return false;
        }
        var entries = copyTracked();
        entries.unshift({ name: name, quantity: 1 });
        return commitTracked(entries, 'The item could not be tracked: the cookie is full or cookies are blocked.');
    }

    function changeTrackedQuantity(name, delta) {
        var index = findTracked(name);
        if (index === -1) {
            return false;
        }
        var entries = copyTracked();
        entries[index].quantity = clampQuantity(entries[index].quantity + delta);
        // Option « Remove tracked items at 0 » : le décompte jusqu'à 0 retire
        // l'élément au lieu de le garder marqué comme terminé.
        if (entries[index].quantity === 0 && state.settings.autoRemove) {
            entries.splice(index, 1);
        }
        return commitTracked(entries, 'The quantity could not be saved.');
    }

    function smallIconButton(action, label, pathData) {
        var button = iconButton(label, pathData);
        button.className = 'track__button';
        button.setAttribute('data-track-action', action);
        return button;
    }

    // Remplit le conteneur de suivi d'une cellule de loot : bouton « suivre »
    // si le loot n'est pas suivi, sinon « − quantité + ». Pas de suppression
    // ici : elle n'est possible que depuis la fenêtre du tracker.
    function fillTrackControls(container) {
        var name = container.getAttribute('data-track-name');
        var index = findTracked(name);
        clear(container);
        container.classList.toggle('track--on', index !== -1);
        if (index === -1) {
            container.appendChild(smallIconButton('add', 'Track "' + name + '"', ICON_TARGET));
            return;
        }
        var quantity = state.tracked[index].quantity;
        var minus = smallIconButton('minus', 'One less "' + name + '"', ICON_MINUS);
        minus.disabled = quantity === 0;
        var plus = smallIconButton('plus', 'One more "' + name + '"', ICON_PLUS);
        plus.disabled = quantity >= TRACKED_MAX_QUANTITY;
        var value = createElement('span', 'track__quantity' + (quantity === 0 ? ' track__quantity--done' : ''), String(quantity));
        value.title = quantity + ' "' + name + '" left to collect';
        container.appendChild(minus);
        container.appendChild(value);
        container.appendChild(plus);
    }

    function createTrackControls(loot) {
        var container = createElement('span', 'track');
        container.setAttribute('data-track-name', trackName(loot));
        fillTrackControls(container);
        return container;
    }

    // Un même loot apparaît sur plusieurs lignes : tous ses compteurs affichés
    // sont rafraîchis ensemble.
    function refreshTrackControls() {
        // Résultats et fenêtre des changements : tout compteur affiché.
        var containers = document.querySelectorAll('.track');
        for (var index = 0; index < containers.length; index += 1) {
            fillTrackControls(containers[index]);
        }
    }

    // Clic sur un contrôle de suivi dans un tableau de résultats.
    function handleTrackClick(button) {
        var container = button.parentNode;
        var name = container.getAttribute('data-track-name');
        var action = button.getAttribute('data-track-action');
        var done = action === 'add'
            ? trackLoot(name)
            : changeTrackedQuantity(name, action === 'minus' ? -1 : 1);
        if (!done) {
            return;
        }
        renderTracked();
        refreshTrackControls();
        // Les boutons ont été recréés : le focus revient sur le même contrôle,
        // sur « + » si celui-ci est désactivé, ou sur la cible si l'élément
        // vient d'être retiré automatiquement à 0.
        var next = container.querySelector('[data-track-action="' + action + '"]:not(:disabled)')
            || container.querySelector('[data-track-action="plus"]:not(:disabled)')
            || container.querySelector('[data-track-action="add"]');
        if (next) {
            next.focus();
        }
    }

    // `focusName` et `focusAction` rendent le focus au bouton qui vient
    // d'être utilisé dans la fenêtre : la liste est reconstruite à chaque fois.
    function renderTracked(focusName, focusAction) {
        clear(elements.trackerList);
        elements.trackerEmpty.hidden = state.tracked.length > 0;
        elements.trackerActions.hidden = state.tracked.length === 0;
        elements.trackerCount.textContent = String(state.tracked.length);
        elements.trackerDeleteAll.textContent = state.confirmDeleteAll
            ? 'Click again to delete all ' + state.tracked.length + ' items'
            : 'Delete all';
        elements.trackerFilterField.hidden = state.tracked.length === 0;
        var focusTarget = null;
        var shown = 0;

        state.tracked.forEach(function (entry) {
            if (state.trackerFilter !== '' && entry.name.toLowerCase().indexOf(state.trackerFilter) === -1) {
                return;
            }
            shown += 1;
            var done = entry.quantity === 0;
            var item = createElement('li', 'saved-item tracker-item' + (done ? ' tracker-item--done' : ''));

            var open = createElement('button', 'saved-item__apply');
            open.type = 'button';
            open.title = 'Search where it drops';
            open.appendChild(createElement('span', 'saved-item__name', entry.name));
            open.appendChild(createElement('span', 'saved-item__detail', done ? 'Done' : entry.quantity + ' left'));
            open.addEventListener('click', function () {
                elements.trackerDialog.close();
                // Pour une relique raffinée, on cherche le nom sans le
                // raffinement : c'est sous ce nom que ses sources sont listées.
                searchFor(isRelicName(entry.name) ? relicBaseName(entry.name) : entry.name);
            });

            function step(delta) {
                if (changeTrackedQuantity(entry.name, delta)) {
                    renderTracked(entry.name, delta < 0 ? 'minus' : 'plus');
                    refreshTrackControls();
                    if (findTracked(entry.name) === -1) {
                        // Élément retiré automatiquement : sa ligne n'existe
                        // plus, le focus reste dans la fenêtre.
                        elements.trackerClose.focus();
                    }
                }
            }

            var minus = iconButton('One less "' + entry.name + '"', ICON_MINUS);
            minus.disabled = done;
            minus.addEventListener('click', function () {
                step(-1);
            });

            var quantity = createElement('span', 'tracker-item__quantity', String(entry.quantity));

            var plus = iconButton('One more "' + entry.name + '"', ICON_PLUS);
            plus.disabled = entry.quantity >= TRACKED_MAX_QUANTITY;
            plus.addEventListener('click', function () {
                step(1);
            });

            var remove = iconButton('Delete "' + entry.name + '"', ICON_TRASH);
            remove.classList.add('tracker-item__delete');
            remove.addEventListener('click', function () {
                var entries = copyTracked();
                entries.splice(findTracked(entry.name), 1);
                if (commitTracked(entries, 'The item could not be deleted.')) {
                    renderTracked();
                    refreshTrackControls();
                }
            });

            item.appendChild(open);
            item.appendChild(minus);
            item.appendChild(quantity);
            item.appendChild(plus);
            item.appendChild(remove);
            elements.trackerList.appendChild(item);

            if (entry.name === focusName) {
                var wanted = focusAction === 'minus' ? minus : plus;
                // Arrivé à 0, « − » est désactivé : le focus passe à « + ».
                focusTarget = wanted.disabled ? (wanted === minus ? plus : minus) : wanted;
            }
        });

        elements.trackerNoMatch.hidden = state.tracked.length === 0 || shown > 0;
        if (focusTarget !== null) {
            focusTarget.focus();
        }
    }

    // Suppression totale en deux clics : pas de boîte de confirmation native.
    function deleteAllTracked() {
        if (!state.confirmDeleteAll) {
            state.confirmDeleteAll = true;
            renderTracked();
            elements.trackerDeleteAll.focus();
            return;
        }
        if (commitTracked([], 'The tracked items could not be deleted.')) {
            renderTracked();
            refreshTrackControls();
            elements.trackerClose.focus();
        }
    }

    // Garde l'onglet du header à l'état actif tant que sa fenêtre est ouverte.
    function bindTabToDialog(button, dialog) {
        dialog.addEventListener('close', function () {
            button.classList.remove('is-active');
        });
    }

    function showTabDialog(button, dialog) {
        if (!dialog.open) {
            dialog.showModal();
        }
        button.classList.add('is-active');
    }

    function openTracker() {
        state.confirmDeleteAll = false;
        if (!elements.trackerDialog.open) {
            state.trackerFilter = '';
            elements.trackerFilter.value = '';
        }
        showTrackerError('');
        showTabDialog(elements.trackerButton, elements.trackerDialog);
        renderTracked();
    }

    function setupTracker() {
        state.tracked = readTrackedCookie();
        renderTracked();
        elements.trackerButton.addEventListener('click', openTracker);
        elements.trackerDeleteAll.addEventListener('click', deleteAllTracked);
        elements.trackerFilter.addEventListener('input', function () {
            state.trackerFilter = elements.trackerFilter.value.trim().toLowerCase();
            state.confirmDeleteAll = false;
            renderTracked();
        });
        bindTabToDialog(elements.trackerButton, elements.trackerDialog);
        setupDialogDismiss(elements.trackerDialog, elements.trackerClose);
    }

    // --- Options du site (cookie) -------------------------------------------
    //
    // Le cookie ne contient que les options qui diffèrent de leur valeur par
    // défaut ; sans option modifiée il est supprimé.

    function readSettingsCookie() {
        var stored = readCookieArray(SETTINGS_COOKIE)[0];
        return {
            // Valeur revalidée : seul un vrai booléen « true » active l'option.
            autoRemove: Boolean(stored) && stored.autoRemove === true
        };
    }

    function writeSettingsCookie(settings) {
        var values = settings.autoRemove ? [{ autoRemove: true }] : [];
        return writeCookieArray(SETTINGS_COOKIE, values)
            && readSettingsCookie().autoRemove === settings.autoRemove;
    }

    function renderSettings() {
        var on = state.settings.autoRemove;
        elements.settingAutoRemove.setAttribute('aria-checked', on ? 'true' : 'false');
        elements.settingAutoRemove.querySelector('.switch__state').textContent = on ? 'On' : 'Off';
        elements.trackerZeroNote.textContent = on
            ? 'An item is removed as soon as it reaches 0 (see Settings).'
            : 'An item at 0 stays in the list until you delete it here (see Settings).';
    }

    function showSettingsError(message) {
        elements.settingsError.textContent = message || '';
        elements.settingsError.hidden = !message;
    }

    function toggleAutoRemove() {
        var settings = { autoRemove: !state.settings.autoRemove };
        if (!writeSettingsCookie(settings)) {
            showSettingsError('The setting could not be saved: cookies are blocked.');
            return;
        }
        showSettingsError('');
        state.settings = settings;
        renderSettings();
        if (!settings.autoRemove) {
            return;
        }
        // Activation : les éléments déjà à 0 sont retirés tout de suite,
        // sinon ils resteraient en contradiction avec l'option.
        var remaining = state.tracked.filter(function (entry) {
            return entry.quantity > 0;
        });
        if (remaining.length !== state.tracked.length) {
            var writtenTracked = writeCookieArray(TRACKED_COOKIE, remaining.map(function (entry) {
                return { n: entry.name, q: entry.quantity };
            }));
            if (writtenTracked) {
                state.tracked = remaining;
                renderTracked();
                refreshTrackControls();
            }
        }
    }

    function setupSettings() {
        state.settings = readSettingsCookie();
        renderSettings();
        elements.settingsButton.addEventListener('click', function () {
            showSettingsError('');
            elements.settingsDialog.showModal();
        });
        elements.settingAutoRemove.addEventListener('click', toggleAutoRemove);
        setupDialogDismiss(elements.settingsDialog, elements.settingsClose);
    }

    // --- Historique de recherche (cookie) -----------------------------------

    function readHistoryCookie() {
        var entries = [];
        readCookieArray(HISTORY_COOKIE).forEach(function (item) {
            if (typeof item === 'string' && item.trim().length >= MIN_QUERY_LENGTH) {
                entries.push(item.trim());
            }
        });
        return entries.slice(0, HISTORY_MAX_ENTRIES);
    }

    function writeHistoryCookie() {
        // Si la liste dépasse la taille d'un cookie, les plus anciennes
        // recherches sont abandonnées.
        while (!writeCookieArray(HISTORY_COOKIE, state.history) && state.history.length > 0) {
            state.history.pop();
        }
    }

    // Ajoute une recherche validée en tête de l'historique, sans doublon.
    function recordSearch(query) {
        var value = String(query).trim();
        if (value.length < MIN_QUERY_LENGTH) {
            return;
        }
        var lowered = value.toLowerCase();
        state.history = state.history.filter(function (entry) {
            return entry.toLowerCase() !== lowered;
        });
        state.history.unshift(value);
        state.history = state.history.slice(0, HISTORY_MAX_ENTRIES);
        writeHistoryCookie();
    }

    function closeHistory() {
        elements.history.hidden = true;
        elements.search.setAttribute('aria-expanded', 'false');
    }

    function focusSearchQuietly() {
        state.quietFocus = true;
        elements.search.focus({ preventScroll: true });
        state.quietFocus = false;
    }

    function runHistoryEntry(entry) {
        closeHistory();
        elements.search.value = entry;
        recordSearch(entry);
        if (state.categories.length > 0) {
            state.query = entry.trim().toLowerCase();
            resetViews();
            render();
        }
        focusSearchQuietly();
    }

    function openHistory() {
        if (state.history.length === 0) {
            closeHistory();
            return;
        }
        clear(elements.historyList);
        state.history.forEach(function (entry) {
            var item = document.createElement('li');
            var row = createElement('button', 'history__row');
            row.type = 'button';
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'icon');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4');
            svg.appendChild(path);
            row.appendChild(svg);
            row.appendChild(createElement('span', 'history__text', entry));
            row.addEventListener('click', function () {
                runHistoryEntry(entry);
            });
            item.appendChild(row);
            elements.historyList.appendChild(item);
        });
        elements.history.hidden = false;
        elements.search.setAttribute('aria-expanded', 'true');
    }

    function historyRows() {
        return Array.prototype.slice.call(elements.history.querySelectorAll('.history__row'));
    }

    function setupHistory() {
        state.history = readHistoryCookie();

        elements.search.addEventListener('focus', function () {
            if (!state.quietFocus) {
                openHistory();
            }
        });
        // Un clic dans le champ déjà sélectionné rouvre le panneau.
        elements.search.addEventListener('click', openHistory);
        elements.search.addEventListener('input', closeHistory);
        // "change" : la saisie est validée (Entrée ou sortie du champ).
        elements.search.addEventListener('change', function () {
            recordSearch(elements.search.value);
        });
        elements.search.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeHistory();
            } else if (event.key === 'Enter') {
                recordSearch(elements.search.value);
                closeHistory();
            } else if (event.key === 'ArrowDown') {
                if (elements.history.hidden) {
                    openHistory();
                }
                var rows = historyRows();
                if (!elements.history.hidden && rows.length > 0) {
                    event.preventDefault();
                    rows[0].focus();
                }
            }
        });

        elements.history.addEventListener('keydown', function (event) {
            var rows = historyRows();
            var position = rows.indexOf(document.activeElement);
            if (event.key === 'ArrowDown' && position < rows.length - 1) {
                event.preventDefault();
                rows[position + 1].focus();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (position > 0) {
                    rows[position - 1].focus();
                } else {
                    focusSearchQuietly();
                }
            } else if (event.key === 'Escape') {
                closeHistory();
                focusSearchQuietly();
            }
        });
        // Le clic sur une ligne ne doit pas retirer le focus du champ avant
        // d'être traité (sinon le panneau se ferme sous le curseur).
        elements.history.addEventListener('mousedown', function (event) {
            event.preventDefault();
        });
        // Le panneau se ferme quand le focus quitte le champ et sa liste.
        elements.searchField.addEventListener('focusout', function (event) {
            if (!(event.relatedTarget instanceof Node) || !elements.searchField.contains(event.relatedTarget)) {
                closeHistory();
            }
        });

        elements.historyClear.addEventListener('click', function () {
            state.history = [];
            writeHistoryCookie();
            closeHistory();
            focusSearchQuietly();
        });
    }

    // --- Date de mise à jour, version, thème -------------------------------

    // --- Historique des changements de données ------------------------------
    //
    // Calculé à l'extraction (voir update_history dans data-retriever.py) :
    // une entrée par jour où les tables officielles ont changé, avec les
    // lignes ajoutées et retirées de chaque catégorie.

    function prepareChanges(data) {
        var stored = data[HISTORY_DATA_KEY];
        if (!Array.isArray(stored)) {
            return [];
        }
        return stored.filter(function (entry) {
            return entry && typeof entry.Date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(entry.Date)
                && Array.isArray(entry.Categories);
        });
    }

    function changeRows(change, key) {
        return Array.isArray(change[key]) ? change[key] : [];
    }

    function changeCount(className, sign, count) {
        return createElement('span', 'change-count ' + className, sign + formatCount(Number(count) || 0));
    }

    // Tableau d'une catégorie modifiée : les colonnes du tableau de recherche,
    // précédées d'une colonne « + » (ligne ajoutée) ou « − » (ligne retirée).
    function renderChangeCategory(change) {
        var section = createElement('section', 'change-category');
        var title = createElement('h3', 'change-category__title', categoryLabel(String(change.Name)));
        title.appendChild(changeCount('change-count--added', '+', change.Added));
        title.appendChild(changeCount('change-count--removed', '−', change.Removed));
        section.appendChild(title);

        var added = changeRows(change, 'Added Rows');
        var removed = changeRows(change, 'Removed Rows');
        var rows = removed.concat(added);
        var family = rows.length > 0 ? detectFamily(rows[0]) : null;
        if (family === null) {
            return section;
        }
        rows.forEach(function (row) {
            if (family === 'byDrop') {
                row.actualChance = computeActualChance(row['Mod Drop Chance'], row.Percentage);
            } else if (family === 'bySource') {
                row.actualChance = computeActualChance(row['Loot Drop Chance'], row.Percentage);
            }
        });
        var hasRotation = rows.some(function (row) {
            return row.Rotation !== undefined && PLACEHOLDER_VALUES.indexOf(row.Rotation) === -1;
        });
        var columns = FAMILIES[family].filter(function (column) {
            return column.kind !== 'rotation' || hasRotation;
        });

        var scroll = createElement('div', 'table-scroll');
        var table = createElement('table', 'table');
        var head = document.createElement('thead');
        var headRow = document.createElement('tr');
        var signHead = createElement('th', 'cell--sign');
        signHead.scope = 'col';
        signHead.appendChild(createElement('span', 'visually-hidden', 'Change'));
        headRow.appendChild(signHead);
        columns.forEach(function (column) {
            var cell = createElement('th', column.kind === 'percent' || column.kind === 'actual' ? 'cell--number' : null, column.label);
            cell.scope = 'col';
            headRow.appendChild(cell);
        });
        head.appendChild(headRow);
        table.appendChild(head);

        var body = document.createElement('tbody');
        rows.forEach(function (row, index) {
            var isAdded = index >= removed.length;
            var line = createElement('tr', isAdded ? 'row--added' : 'row--removed');
            var sign = createElement('td', 'cell--sign', isAdded ? '+' : '−');
            sign.title = isAdded ? 'Added' : 'Removed';
            sign.setAttribute('aria-label', isAdded ? 'Added' : 'Removed');
            line.appendChild(sign);
            columns.forEach(function (column) {
                line.appendChild(renderCell(row, column));
            });
            body.appendChild(line);
        });
        table.appendChild(body);
        scroll.appendChild(table);
        section.appendChild(scroll);

        var total = (Number(change.Added) || 0) + (Number(change.Removed) || 0);
        if (rows.length < total) {
            section.appendChild(createElement('p', 'change-category__note',
                'Showing ' + formatCount(rows.length) + ' of ' + formatCount(total) + ' changed rows.'));
        }
        return section;
    }

    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];
    var WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // "2026-11-14 01:00:07" -> { year: 2026, month: 10, day: 14 } (mois de 0 à 11).
    // Lu par découpage et non par Date.parse, dont le résultat sur ce format
    // dépend du navigateur.
    function entryDay(entry) {
        var parts = entry.Date.slice(0, 10).split('-');
        return { year: Number(parts[0]), month: Number(parts[1]) - 1, day: Number(parts[2]) };
    }

    function monthRank(year, month) {
        return year * 12 + month;
    }

    function closeCalendar() {
        elements.changesCalendar.hidden = true;
        elements.changesDate.setAttribute('aria-expanded', 'false');
    }

    function selectChange(index) {
        state.changeIndex = index;
        closeCalendar();
        renderChanges();
        elements.changesDate.focus();
    }

    // Mois que le calendrier peut afficher, du plus ancien au plus récent :
    // ceux qui ont au moins un changement, plus celui de la dernière
    // extraction. Chaque élément est un rang (année * 12 + mois).
    function calendarMonths() {
        var seen = {};
        var ranks = [];
        function add(day) {
            var rank = monthRank(day.year, day.month);
            if (!seen[rank]) {
                seen[rank] = true;
                ranks.push(rank);
            }
        }
        state.changes.forEach(function (entry) {
            add(entryDay(entry));
        });
        if (state.lastRefresh !== null) {
            add(state.lastRefresh);
        }
        return ranks.sort(function (left, right) {
            return left - right;
        });
    }

    function showCalendarMonth(rank) {
        state.calendarMonth = { year: Math.floor(rank / 12), month: rank % 12 };
        renderCalendar();
    }

    // Calendrier du mois state.calendarMonth. Seuls les jours ayant une
    // entrée sont cliquables. Les flèches sautent au mois précédent ou
    // suivant qui a des données et sont désactivées s'il n'y en a pas.
    function renderCalendar() {
        var calendar = elements.changesCalendar;
        clear(calendar);
        var year = state.calendarMonth.year;
        var month = state.calendarMonth.month;
        var current = monthRank(year, month);
        var months = calendarMonths();

        // Jour du mois -> index de l'entrée. L'historique va du plus récent
        // au plus ancien : pour deux entrées le même jour, la plus récente gagne.
        var byDay = {};
        state.changes.forEach(function (entry, index) {
            var day = entryDay(entry);
            if (day.year === year && day.month === month && byDay[day.day] === undefined) {
                byDay[day.day] = index;
            }
        });

        var earlier = months.filter(function (rank) {
            return rank < current;
        });
        var later = months.filter(function (rank) {
            return rank > current;
        });

        var head = createElement('div', 'calendar__head');
        var previous = iconButton('Previous month with data', 'm15 6-6 6 6 6');
        previous.className = 'calendar__nav';
        previous.disabled = earlier.length === 0;
        previous.addEventListener('click', function () {
            showCalendarMonth(earlier[earlier.length - 1]);
            focusCalendarControl('.calendar__nav', 0);
        });
        var next = iconButton('Next month with data', 'm9 6 6 6-6 6');
        next.className = 'calendar__nav';
        next.disabled = later.length === 0;
        next.addEventListener('click', function () {
            showCalendarMonth(later[0]);
            focusCalendarControl('.calendar__nav', 1);
        });

        var title = createElement('div', 'calendar__title');
        var monthLabel = createElement('span', 'calendar__month', MONTH_NAMES[month]);
        monthLabel.setAttribute('aria-live', 'polite');
        title.appendChild(monthLabel);

        // Années ayant des données ; en choisir une affiche son mois le plus
        // récent qui en a.
        var yearSelect = createElement('select', 'calendar__year');
        yearSelect.setAttribute('aria-label', 'Year');
        var years = [];
        months.forEach(function (rank) {
            var value = Math.floor(rank / 12);
            if (years.indexOf(value) === -1) {
                years.push(value);
            }
        });
        years.forEach(function (value) {
            var option = createElement('option', null, String(value));
            option.value = String(value);
            yearSelect.appendChild(option);
        });
        yearSelect.value = String(year);
        yearSelect.disabled = years.length < 2;
        yearSelect.addEventListener('change', function () {
            var wanted = Number(yearSelect.value);
            var inYear = months.filter(function (rank) {
                return Math.floor(rank / 12) === wanted;
            });
            if (inYear.length > 0) {
                showCalendarMonth(inYear[inYear.length - 1]);
                focusCalendarControl('.calendar__year', 0);
            }
        });
        title.appendChild(yearSelect);

        head.appendChild(previous);
        head.appendChild(title);
        head.appendChild(next);
        calendar.appendChild(head);

        var grid = createElement('div', 'calendar__grid');
        WEEKDAY_NAMES.forEach(function (name) {
            grid.appendChild(createElement('span', 'calendar__weekday', name));
        });
        // getDay() : 0 = dimanche. La grille commence le lundi.
        var offset = (new Date(year, month, 1).getDay() + 6) % 7;
        var dayCount = new Date(year, month + 1, 0).getDate();
        var refresh = state.lastRefresh;
        var blank;
        for (blank = 0; blank < offset; blank += 1) {
            grid.appendChild(createElement('span', 'calendar__blank'));
        }
        var day;
        for (day = 1; day <= dayCount; day += 1) {
            var button = createElement('button', 'calendar__day');
            button.type = 'button';
            button.appendChild(createElement('span', 'calendar__number', String(day)));
            var isRefresh = refresh !== null && refresh.year === year && refresh.month === month && refresh.day === day;
            if (isRefresh) {
                button.classList.add('calendar__day--refresh');
            }
            var index = byDay[day];
            var label = MONTH_NAMES[month] + ' ' + day + ', ' + year;
            if (index === undefined) {
                button.disabled = true;
                label += isRefresh ? ': last data refresh, no change' : ': no change';
            } else {
                var entry = state.changes[index];
                var added = formatCount(Number(entry.Added) || 0);
                var removed = formatCount(Number(entry.Removed) || 0);
                button.classList.add('calendar__day--change');
                // Totaux du jour, visibles avant de cliquer.
                button.appendChild(createElement('span', 'calendar__delta calendar__delta--added', '+' + added));
                button.appendChild(createElement('span', 'calendar__delta calendar__delta--removed', '−' + removed));
                label += ': ' + added + ' rows added, ' + removed + ' removed' + (isRefresh ? ', last data refresh' : '');
                button.setAttribute('aria-pressed', index === state.changeIndex ? 'true' : 'false');
                button.setAttribute('data-change-index', String(index));
            }
            button.title = label;
            button.setAttribute('aria-label', label);
            grid.appendChild(button);
        }
        calendar.appendChild(grid);

        var legend = createElement('p', 'calendar__legend');
        [['calendar__key--change', 'Changes'], ['calendar__key--selected', 'Shown'], ['calendar__key--refresh', 'Last refresh']]
            .forEach(function (item) {
                var key = createElement('span', 'calendar__legend-item');
                key.appendChild(createElement('span', 'calendar__key ' + item[0]));
                key.appendChild(document.createTextNode(item[1]));
                legend.appendChild(key);
            });
        calendar.appendChild(legend);
    }

    // Après un changement de mois le calendrier est reconstruit : le focus
    // revient sur le contrôle équivalent, s'il est encore utilisable.
    function focusCalendarControl(selector, position) {
        var control = elements.changesCalendar.querySelectorAll(selector)[position];
        if (control && !control.disabled) {
            control.focus();
        } else {
            elements.changesCalendar.querySelector('.calendar__year').focus();
        }
    }

    function toggleCalendar() {
        if (!elements.changesCalendar.hidden) {
            closeCalendar();
            return;
        }
        // S'ouvre sur le mois de la date affichée.
        var day = entryDay(state.changes[state.changeIndex]);
        state.calendarMonth = { year: day.year, month: day.month };
        renderCalendar();
        elements.changesCalendar.hidden = false;
        elements.changesDate.setAttribute('aria-expanded', 'true');
        var selected = elements.changesCalendar.querySelector('[aria-pressed="true"]');
        if (selected) {
            selected.focus();
        }
    }

    // Affiche les changements de la date choisie (state.changeIndex).
    function renderChanges() {
        clear(elements.changesList);
        var empty = state.changes.length === 0;
        elements.changesEmpty.hidden = !empty;
        elements.changesDate.hidden = empty;
        if (empty) {
            return;
        }
        state.changeIndex = Math.min(Math.max(state.changeIndex, 0), state.changes.length - 1);
        var entry = state.changes[state.changeIndex];
        elements.changesDateLabel.textContent = entry.Date.slice(0, 10);

        var block = createElement('section', 'change');
        var summary = createElement('div', 'change__summary');
        summary.appendChild(createElement('span', 'change__date', entry.Date.slice(0, 16)));
        summary.appendChild(changeCount('change-count--added', '+', entry.Added));
        summary.appendChild(changeCount('change-count--removed', '−', entry.Removed));
        summary.appendChild(createElement('span', 'change__detail',
            entry.Categories.length + (entry.Categories.length === 1 ? ' category' : ' categories')));
        block.appendChild(summary);
        entry.Categories.forEach(function (change) {
            if (change && typeof change === 'object') {
                block.appendChild(renderChangeCategory(change));
            }
        });
        elements.changesList.appendChild(block);
    }

    function setupChanges() {
        elements.changesButton.addEventListener('click', function () {
            // Chaque ouverture repart de la date la plus récente.
            state.changeIndex = 0;
            closeCalendar();
            renderChanges();
            elements.changesDialog.showModal();
        });
        elements.changesDate.addEventListener('click', toggleCalendar);
        elements.changesCalendar.addEventListener('click', function (event) {
            // Un clic dans le calendrier ne remonte pas jusqu'à l'écouteur
            // « clic ailleurs » de la fenêtre. Sans cela, changer de mois
            // fermait le calendrier : il est reconstruit au clic, donc le
            // bouton cliqué n'est plus dans la page quand cet écouteur
            // vérifie où le clic a eu lieu.
            event.stopPropagation();
            var target = event.target;
            // Le clic peut tomber sur le numéro ou les totaux du jour.
            var dayButton = target instanceof Element ? target.closest('[data-change-index]') : null;
            if (dayButton) {
                selectChange(Number(dayButton.getAttribute('data-change-index')));
            }
        });
        // Échap ferme d'abord le calendrier, puis seulement la fenêtre.
        elements.changesDialog.addEventListener('cancel', function (event) {
            if (!elements.changesCalendar.hidden) {
                event.preventDefault();
                closeCalendar();
                elements.changesDate.focus();
            }
        });
        // Un clic ailleurs dans la fenêtre referme le calendrier.
        elements.changesDialog.addEventListener('click', function (event) {
            var target = event.target;
            if (elements.changesCalendar.hidden || !(target instanceof Node)) {
                return;
            }
            if (!elements.changesCalendar.contains(target) && !elements.changesDate.contains(target)) {
                closeCalendar();
            }
        });
        // Mêmes interactions que dans les résultats : un nom lance la
        // recherche, la cible suit le loot.
        elements.changesList.addEventListener('click', function (event) {
            var target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            var trackButton = target.closest('[data-track-action]');
            if (trackButton) {
                handleTrackClick(trackButton);
                return;
            }
            if (target.classList.contains('cell-link')) {
                elements.changesDialog.close();
                searchFor(target.textContent);
            }
        });
        setupDialogDismiss(elements.changesDialog, elements.changesClose);
    }

    function renderUpdateTime(data) {
        var timers = data[TIMERS_KEY];
        var value = Array.isArray(timers) && timers[0] ? timers[0]['Update Data Set Date'] : null;
        if (!value) {
            return;
        }
        // "2026-11-15 07:18:50.810543" -> "2026-11-15 07:18"
        if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
            state.lastRefresh = entryDay({ Date: String(value) });
        }
        elements.updateTime.textContent = 'Last update: ' + String(value).slice(0, 16);
        elements.updateTime.title = 'Generation time of the dataset: ' + value;
        elements.updateTime.hidden = false;
    }

    function setupVersion() {
        var versions = Array.isArray(window.APP_VERSIONS) ? window.APP_VERSIONS : [];
        if (versions.length === 0) {
            elements.versionButton.hidden = true;
            return;
        }
        elements.versionButton.textContent = 'v' + versions[0].version;
        elements.versionButton.setAttribute('aria-label',
            'Version ' + versions[0].version + ', show version history');

        versions.forEach(function (entry, index) {
            var item = createElement('li', 'version-item' + (index === 0 ? ' version-item--current' : ''));
            var head = createElement('div', 'version-item__head');
            head.appendChild(createElement('span', 'version-item__number', 'v' + entry.version));
            head.appendChild(createElement('span', 'version-item__date', entry.date));
            if (index === 0) {
                head.appendChild(createElement('span', 'badge badge--current', 'Current'));
            }
            item.appendChild(head);
            if (entry.summary) {
                item.appendChild(createElement('p', 'version-item__summary', entry.summary));
            }
            elements.versionList.appendChild(item);
        });

        elements.versionButton.addEventListener('click', function () {
            elements.versionDialog.showModal();
        });
        setupDialogDismiss(elements.versionDialog, elements.versionClose);
    }

    function setupTheme() {
        elements.themeToggle.addEventListener('click', function () {
            var root = document.documentElement;
            var next = root.dataset.theme === 'light' ? 'dark' : 'light';
            root.dataset.theme = next;
            try {
                window.localStorage.setItem('theme', next);
            } catch (error) {
                // Stockage indisponible : le choix vaut pour cette page.
            }
        });
    }

    // --- Chargement --------------------------------------------------------

    function load() {
        renderLoading();
        window.fetch(DATA_URL)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                state.vaulted = prepareVaulted(data);
                state.categories = prepareCategories(data);
                if (state.categories.length === 0) {
                    throw new Error('empty dataset');
                }
                state.changes = prepareChanges(data);
                elements.changesCount.textContent = String(state.changes.length);
                elements.changesButton.hidden = false;
                renderUpdateTime(data);
                readUrl();
                render();
            })
            .catch(function (error) {
                console.error('Error while loading data:', error);
                renderLoadError();
            });
    }

    function init() {
        setupVersion();
        setupTheme();
        setupSaved();
        setupSettings();
        setupTracker();
        setupChanges();
        setupHistory();

        elements.search.addEventListener('input', debounce(function () {
            if (state.categories.length === 0) {
                return;
            }
            state.query = elements.search.value.trim().toLowerCase();
            resetViews();
            render();
        }, DEBOUNCE_MS));

        // Hors temporisation : la croix suit la saisie sans délai.
        elements.search.addEventListener('input', syncClearButton);
        elements.search.addEventListener('input', showSearching);
        elements.search.addEventListener('input', syncSaveButton);

        // Efface le texte de recherche et ses conditions « AND » ; la
        // catégorie choisie est conservée.
        elements.clear.addEventListener('click', function () {
            elements.search.value = '';
            setConditions([]);
            elements.search.focus();
            if (state.categories.length === 0) {
                syncClearButton();
                return;
            }
            state.query = '';
            resetViews();
            render();
        });

        elements.and.addEventListener('click', function () {
            addCondition('and');
        });
        elements.or.addEventListener('click', function () {
            addCondition('or');
        });
        syncConditionButtons();

        elements.category.addEventListener('change', function () {
            state.activeCategory = elements.category.value || null;
            resetViews();
            render();
        });

        // Délégation : un seul écouteur pour tous les noms cliquables.
        elements.results.addEventListener('click', function (event) {
            var target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            // Le clic peut tomber sur le <svg> du bouton : on remonte au bouton.
            var trackButton = target.closest('[data-track-action]');
            if (trackButton) {
                handleTrackClick(trackButton);
                return;
            }
            if (target.classList.contains('cell-link')) {
                searchFor(target.textContent);
            }
        });

        // Raccourci "/" : place le curseur dans la recherche.
        document.addEventListener('keydown', function (event) {
            var target = event.target;
            var typing = target instanceof HTMLElement
                && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
            if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey
                && !elements.versionDialog.open && !elements.savedDialog.open && !elements.trackerDialog.open && !elements.changesDialog.open && !elements.settingsDialog.open) {
                event.preventDefault();
                elements.search.focus();
            }
        });

        load();
    }

    init();
})();
