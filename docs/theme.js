// Applique le thème avant le premier affichage pour éviter un flash.
// Chargé de façon bloquante dans <head> ; le bouton de bascule est géré
// dans script.js.
(function () {
    'use strict';
    var theme = null;
    try {
        theme = window.localStorage.getItem('theme');
    } catch (error) {
        theme = null;
    }
    if (theme !== 'light' && theme !== 'dark') {
        var prefersLight = window.matchMedia
            && window.matchMedia('(prefers-color-scheme: light)').matches;
        theme = prefersLight ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = theme;
})();
