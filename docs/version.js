// Historique des versions affiché dans l'interface (bouton de version de
// l'en-tête). La première entrée est la version courante.
//
// Source de vérité : memory/CONTENT_SUMMARY.md. Ce fichier doit être mis à
// jour à chaque montée de version ; tests/test_version_consistency.py échoue
// si les deux divergent.
window.APP_VERSIONS = [
    {
        version: '0.4.0',
        date: '2026-11-15',
        summary: 'OR conditions next to AND: an OR is an alternative to the previous term, and the label of a condition switches between the two.'
    },
    {
        version: '0.3.0',
        date: '2026-11-15',
        summary: 'AND conditions to refine a search, loot and relic tracker with quantities, history of the days when the drop tables changed with a calendar, settings window, and rotations for Dynamic Location Rewards.'
    },
    {
        version: '0.2.0',
        date: '2026-11-15',
        summary: 'Full redesign. Every official drop category is searchable, vaulted relics are flagged, searches can be saved, and the last searches are kept in a history.'
    },
    {
        version: '0.1.0',
        date: '2026-11-15',
        summary: 'Initial site: search by loot or source, category filters and sortable tables.'
    }
];
