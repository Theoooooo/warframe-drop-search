"""Extraction des tables de drop officielles de Warframe vers un fichier JSON.

Le script télécharge la page publiée par Digital Extremes, découpe chaque
catégorie (titre ``<h3>`` suivi d'un ``<table>``) et écrit le résultat dans
``docs/data/data.json``, consommé tel quel par le site statique.

Il n'utilise que la bibliothèque standard : aucune installation de paquet
n'est nécessaire, ni en local ni dans la CI.

La famille d'une table est déduite de la forme de son premier en-tête et non
de son nom. Une catégorie ajoutée sur la page officielle est donc prise en
charge sans modification du code, tant qu'elle reprend une forme connue.
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
import urllib.error
import urllib.request
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path

SOURCE_URL = (
    "https://warframe-web-assets.nyc3.cdn.digitaloceanspaces.com"
    "/uploads/cms/hnfvc0o3jnfvc873njb03enrf56.html"
)
DEFAULT_OUTPUT = Path("docs/data/data.json")
REQUEST_TIMEOUT_SECONDS = 60
USER_AGENT = "warframe-drop-search-data-retriever"

NO_ROTATION = "no_rotation"
NO_MISSION_TYPE = "no_mission_type"

FAMILY_STANDARD = "standard"
FAMILY_BOUNTY = "bounty"
FAMILY_BY_DROP = "by_drop"
FAMILY_BY_SOURCE = "by_source"

TIMERS_KEY = "Timers"
VAULTED_KEY = "Vaulted Relics"
HISTORY_KEY = "Update History"
METADATA_KEYS = frozenset({TIMERS_KEY, VAULTED_KEY, HISTORY_KEY})
# Au-delà, les entrées les plus anciennes sont abandonnées.
HISTORY_MAX_ENTRIES = 30
# Lignes conservées par catégorie et par sens (ajout, retrait) dans une entrée :
# borne la taille de data.json si la page officielle est remaniée en bloc.
HISTORY_MAX_ROWS = 500
RELICS_CATEGORY = "Relics:"

# Familles de reliques soumises au « Prime Vault ». Les autres (Requiem,
# Vanguard) ne sont jamais marquées : la page officielle ne liste pas leurs
# récompenses sous leur nom exact (les Kuva Siphon donnent une générique
# « Requiem Eterna Relic »), la règle les déclarerait donc vaultées à tort.
VAULTABLE_TIERS = frozenset({"Lith", "Meso", "Neo", "Axi"})

DropRow = dict[str, str]


class DropTableError(Exception):
    """Erreur de récupération ou de cohérence des tables de drop."""


@dataclass
class Cell:
    """Cellule d'une ligne de tableau.

    Attributes:
        tag: Nom de la balise, ``th`` ou ``td``.
        colspan: Nombre de colonnes couvertes par la cellule.
        text: Texte brut de la cellule, espaces de bord retirés.
    """

    tag: str
    colspan: int = 1
    text: str = ""


@dataclass
class Row:
    """Ligne d'un tableau de la page officielle.

    Attributes:
        cells: Cellules de la ligne, dans l'ordre du document.
        blank: Vrai pour une ligne de séparation entre deux blocs.
    """

    cells: list[Cell] = field(default_factory=list)
    blank: bool = False

    @property
    def headers(self) -> list[Cell]:
        """Cellules d'en-tête (``th``) de la ligne."""
        return [cell for cell in self.cells if cell.tag == "th"]

    @property
    def values(self) -> list[Cell]:
        """Cellules de données (``td``) de la ligne."""
        return [cell for cell in self.cells if cell.tag == "td"]

    def header_spanning(self, colspan: int) -> Cell | None:
        """Retourner le premier en-tête couvrant exactement ``colspan`` colonnes."""
        for cell in self.headers:
            if cell.colspan == colspan:
                return cell
        return None


@dataclass
class Section:
    """Catégorie de la page : un titre ``<h3>`` et les lignes de son tableau.

    Attributes:
        title: Texte du titre, deux-points final inclus.
        rows: Lignes du premier tableau qui suit le titre.
        has_table: Vrai dès qu'un tableau a été rattaché au titre.
    """

    title: str = ""
    rows: list[Row] = field(default_factory=list)
    has_table: bool = False


class DropPageParser(HTMLParser):
    """Découpe la page officielle en sections titre + lignes de tableau.

    Seul le premier tableau situé entre un titre ``<h3>`` et le titre suivant
    est rattaché à la section. Un titre sans tableau (avertissement, sommaire)
    produit une section vide, ignorée ensuite.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.sections: list[Section] = []
        self._in_title = False
        self._in_table = False
        self._row: Row | None = None
        self._cell: Cell | None = None
        self._buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "h3":
            self.sections.append(Section())
            self._in_title = True
            self._in_table = False
            self._buffer = []
        elif tag == "table":
            section = self.sections[-1] if self.sections else None
            if section is not None and not section.has_table:
                section.has_table = True
                self._in_table = True
        elif not self._in_table:
            return
        elif tag == "tr":
            classes = (attributes.get("class") or "").split()
            self._row = Row(blank="blank-row" in classes)
        elif tag in ("td", "th") and self._row is not None:
            self._cell = Cell(tag=tag, colspan=_parse_colspan(attributes.get("colspan")))
            self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "h3" and self._in_title:
            self.sections[-1].title = "".join(self._buffer).strip()
            self._in_title = False
        elif tag == "table":
            self._in_table = False
            self._row = None
            self._cell = None
        elif not self._in_table:
            return
        elif tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._cell.text = "".join(self._buffer).strip()
            self._row.cells.append(self._cell)
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.sections[-1].rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._in_title or self._cell is not None:
            self._buffer.append(data)


def _parse_colspan(value: str | None) -> int:
    if value is None:
        return 1
    try:
        return int(value)
    except ValueError:
        return 1


def split_chance(details: str) -> tuple[str, str]:
    """Séparer la rareté et le pourcentage d'une cellule de chance.

    Args:
        details: Texte de la cellule, par exemple ``"Rare (7.69%)"``.

    Returns:
        Le couple ``(rareté, pourcentage)``. Le pourcentage est une chaîne
        vide lorsque la cellule ne contient pas de parenthèses. Le découpage
        se fait sur la dernière parenthèse ouvrante, car la rareté peut en
        contenir : ``"Beyond Legendary (Under Review) (0.00%)"`` donne
        ``("Beyond Legendary (Under Review)", "0.00%")``.
    """
    if "(" in details and ")" in details:
        rarity, _, remainder = details.rpartition("(")
        return rarity.strip(), remainder.replace(")", "").strip()
    return details, ""


def detect_family(rows: list[Row]) -> str | None:
    """Déduire la famille d'un tableau à partir de ses premières lignes.

    Args:
        rows: Lignes du tableau, séparateurs inclus.

    Returns:
        L'une des constantes ``FAMILY_*``, ou ``None`` si la forme du tableau
        n'est pas reconnue.
    """
    content = [row for row in rows if not row.blank]
    if not content:
        return None
    first = content[0]
    if first.values:
        return None
    spans = [cell.colspan for cell in first.headers]
    if spans == [2]:
        return FAMILY_STANDARD
    if spans == [1, 2]:
        return FAMILY_BY_SOURCE
    if spans == [3]:
        second = content[1] if len(content) > 1 else None
        if second is not None and len(second.headers) == 3 and not second.values:
            return FAMILY_BY_DROP
        return FAMILY_BOUNTY
    return None


def parse_standard(rows: list[Row]) -> list[DropRow]:
    """Lire un tableau « mission → rotation → récompenses » à deux colonnes.

    Le premier en-tête d'un bloc nomme la mission, les suivants nomment une
    rotation. Une ligne de séparation termine le bloc.

    La page écrit l'en-tête de rotation de deux façons : une cellule couvrant
    les deux colonnes (« Missions »), ou une cellule d'en-tête suivie d'une
    cellule vide (« Dynamic Location Rewards »). Les deux sont reconnues.

    Le type de mission est la dernière parenthèse du nom : dans
    « Saturn/(Variant) Annihilation (Conclave) », c'est « Conclave ».

    Args:
        rows: Lignes du tableau.

    Returns:
        Une ligne de drop par récompense.
    """
    drops: list[DropRow] = []
    mission = ""
    mission_type = NO_MISSION_TYPE
    rotation = ""
    for row in rows:
        if row.blank:
            mission = ""
            rotation = ""
            continue
        headers = row.headers
        header = headers[0] if headers else None
        if header is not None and not any(cell.text for cell in row.values):
            if mission == "":
                mission = header.text
                groups = re.findall(r"\(([^()]*)\)", mission)
                mission_type = groups[-1] if groups else NO_MISSION_TYPE
                rotation = ""
            else:
                rotation = header.text
            continue
        values = row.values
        if len(values) != 2:
            continue
        rarity, percentage = split_chance(values[1].text)
        drops.append(
            {
                "Source": mission,
                "Mission Type": mission_type,
                "Rotation": rotation or NO_ROTATION,
                "Loot": values[0].text,
                "Rarity": rarity,
                "Percentage": percentage,
            }
        )
    return drops


def parse_bounty(rows: list[Row]) -> list[DropRow]:
    """Lire un tableau de primes « prime → rotation → étape → récompenses ».

    Args:
        rows: Lignes du tableau.

    Returns:
        Une ligne de drop par récompense. La rotation vaut ``no_rotation``
        pour les primes qui n'en déclarent pas.
    """
    drops: list[DropRow] = []
    bounty = ""
    rotation = ""
    stage = ""
    for row in rows:
        if row.blank:
            bounty = ""
            rotation = ""
            stage = ""
            continue
        wide_header = row.header_spanning(3)
        if wide_header is not None:
            if bounty == "":
                bounty = wide_header.text
                rotation = ""
                stage = ""
            elif wide_header.text != "":
                rotation = wide_header.text
            continue
        stage_header = row.header_spanning(2)
        if stage_header is not None:
            stage = stage_header.text
            continue
        values = row.values
        if len(values) != 3:
            continue
        rarity, percentage = split_chance(values[2].text)
        drops.append(
            {
                "Source": bounty,
                "Rotation": rotation or NO_ROTATION,
                "Stage": stage,
                "Loot": values[1].text,
                "Rarity": rarity,
                "Percentage": percentage,
            }
        )
    return drops


def parse_by_drop(rows: list[Row]) -> list[DropRow]:
    """Lire un tableau « objet → sources » à trois colonnes.

    Chaque bloc commence par le nom de l'objet, suivi d'une ligne de titres
    de colonnes (ignorée) puis d'une ligne par source.

    Args:
        rows: Lignes du tableau.

    Returns:
        Une ligne de drop par couple objet/source.
    """
    drops: list[DropRow] = []
    item = ""
    for row in rows:
        if row.blank:
            item = ""
            continue
        header = row.header_spanning(3)
        if header is not None:
            item = header.text
            continue
        values = row.values
        if len(values) != 3 or row.headers:
            continue
        rarity, percentage = split_chance(values[2].text)
        drops.append(
            {
                "Source": values[0].text,
                "Mod Drop Chance": values[1].text,
                "Loot": item,
                "Rarity": rarity,
                "Percentage": percentage,
            }
        )
    return drops


def parse_by_source(rows: list[Row]) -> list[DropRow]:
    """Lire un tableau « source → objets » à trois colonnes.

    L'en-tête d'un bloc porte le nom de la source et sa chance de lâcher un
    objet de la catégorie, sous la forme ``"Mod Drop Chance: 3.00%"``.

    Args:
        rows: Lignes du tableau.

    Returns:
        Une ligne de drop par couple source/objet.
    """
    drops: list[DropRow] = []
    source = ""
    drop_chance = ""
    for row in rows:
        if row.blank:
            source = ""
            drop_chance = ""
            continue
        chance_header = row.header_spanning(2)
        if chance_header is not None:
            source = row.headers[0].text
            _, _, drop_chance = chance_header.text.partition(": ")
            drop_chance = drop_chance.strip()
            continue
        values = row.values
        if len(values) != 3:
            continue
        rarity, percentage = split_chance(values[2].text)
        drops.append(
            {
                "Source": source,
                "Loot Drop Chance": drop_chance,
                "Loot": values[1].text,
                "Rarity": rarity,
                "Percentage": percentage,
            }
        )
    return drops


FAMILY_PARSERS: dict[str, Callable[[list[Row]], list[DropRow]]] = {
    FAMILY_STANDARD: parse_standard,
    FAMILY_BOUNTY: parse_bounty,
    FAMILY_BY_DROP: parse_by_drop,
    FAMILY_BY_SOURCE: parse_by_source,
}


def relic_base_name(name: str) -> str:
    """Retirer le suffixe d'état d'un nom de relique.

    Args:
        name: Nom tel qu'affiché, par exemple ``"Axi A1 Relic (Radiant)"``.

    Returns:
        Le nom sans son dernier suffixe entre parenthèses : ``"Axi A1 Relic"``.
    """
    return re.sub(r"\s*\([^)]*\)$", "", name).strip()


def find_vaulted_relics(categories: dict[str, list[DropRow]]) -> list[str]:
    """Lister les reliques qui ne s'obtiennent plus en récompense.

    Une relique est vaultée lorsqu'elle possède une table de contenu dans la
    catégorie des reliques mais ne figure comme récompense dans aucune autre
    catégorie (missions, primes, clés, ennemis). Seules les familles de
    ``VAULTABLE_TIERS`` sont concernées.

    Args:
        categories: Lignes de drop par titre de catégorie.

    Returns:
        Les noms de base des reliques vaultées, triés. La liste est vide si
        la page ne contient pas de catégorie de reliques.

    Raises:
        DropTableError: Si des reliques existent mais qu'aucune n'est trouvée
            en récompense, signe d'un changement de nommage qui marquerait
            toutes les reliques comme vaultées.
    """
    relics = {
        relic_base_name(row["Source"]) for row in categories.get(RELICS_CATEGORY, [])
    }
    if not relics:
        return []
    obtainable: set[str] = set()
    for title, drops in categories.items():
        if title == RELICS_CATEGORY:
            continue
        for row in drops:
            name = relic_base_name(row["Loot"])
            if name in relics:
                obtainable.add(name)
    if not obtainable:
        raise DropTableError(
            "aucune relique trouvée en récompense : calcul du vault impossible"
        )
    return sorted(
        name
        for name in relics - obtainable
        if name.split(" ", 1)[0] in VAULTABLE_TIERS
    )


def parse_page(html: str) -> tuple[dict[str, list[DropRow]], list[str]]:
    """Extraire toutes les catégories de drop d'une page officielle.

    Args:
        html: Contenu HTML de la page.

    Returns:
        Un couple ``(catégories, ignorées)`` : le dictionnaire des lignes de
        drop par titre de catégorie, et la liste des titres dont le tableau a
        une forme inconnue. Les titres sans tableau ne figurent dans aucun
        des deux.
    """
    parser = DropPageParser()
    parser.feed(html)
    parser.close()

    categories: dict[str, list[DropRow]] = {}
    skipped: list[str] = []
    for section in parser.sections:
        if not section.has_table:
            continue
        family = detect_family(section.rows)
        if family is None:
            skipped.append(section.title)
            continue
        categories[section.title] = FAMILY_PARSERS[family](section.rows)
    return categories, skipped


def _row_key(row: object) -> str:
    """Forme canonique d'une ligne, indépendante de l'ordre de ses champs."""
    return json.dumps(row, sort_keys=True, ensure_ascii=False)


def _rows_only_in(rows: list, other: list) -> list:
    """Lignes de ``rows`` absentes de ``other``, dans l'ordre de ``rows``.

    Comparaison en multi-ensemble : si une ligne figure trois fois dans
    ``rows`` et une fois dans ``other``, deux exemplaires sont retournés.
    """
    remaining = Counter(_row_key(row) for row in other)
    only: list = []
    for row in rows:
        key = _row_key(row)
        if remaining[key] > 0:
            remaining[key] -= 1
        else:
            only.append(row)
    return only


def compare_categories(
    previous: dict[str, list], current: dict[str, list[DropRow]]
) -> list[dict[str, object]]:
    """Comparer deux jeux de catégories, ligne par ligne.

    L'ordre des lignes ne compte pas, mais une ligne présente deux fois
    compte deux fois. Une ligne dont une valeur change compte pour une ligne
    retirée et une ligne ajoutée.

    Args:
        previous: Catégories du jeu de données précédent.
        current: Catégories qui viennent d'être extraites.

    Returns:
        Une entrée par catégorie modifiée, dans l'ordre de la page puis des
        catégories disparues, avec les clés ``Name``, ``Added`` et
        ``Removed`` (nombres exacts) et ``Added Rows`` et ``Removed Rows``
        (les lignes elles-mêmes, limitées à ``HISTORY_MAX_ROWS`` chacune).
        Liste vide si les deux jeux sont identiques.
    """
    changes: list[dict[str, object]] = []
    names = list(current) + [name for name in previous if name not in current]
    for name in names:
        before = previous.get(name)
        before = before if isinstance(before, list) else []
        after = current.get(name, [])
        added = _rows_only_in(after, before)
        removed = _rows_only_in(before, after)
        if added or removed:
            changes.append(
                {
                    "Name": name,
                    "Added": len(added),
                    "Removed": len(removed),
                    "Added Rows": added[:HISTORY_MAX_ROWS],
                    "Removed Rows": removed[:HISTORY_MAX_ROWS],
                }
            )
    return changes


def update_history(
    previous: dict[str, object] | None,
    categories: dict[str, list[DropRow]],
    generated_at: datetime.datetime,
) -> list[dict[str, object]]:
    """Calculer l'historique des mises à jour à écrire dans ``data.json``.

    Une entrée n'est ajoutée que si les données diffèrent du jeu précédent :
    un jour sans changement laisse l'historique intact.

    Args:
        previous: Jeu de données précédent, ou ``None`` s'il n'existe pas ou
            est illisible. Sans point de comparaison, rien n'est ajouté.
        categories: Catégories qui viennent d'être extraites.
        generated_at: Horodatage de l'extraction.

    Returns:
        Les entrées de l'historique, la plus récente en premier, limitées à
        ``HISTORY_MAX_ENTRIES``.
    """
    if previous is None:
        return []
    stored = previous.get(HISTORY_KEY)
    history = [entry for entry in stored if isinstance(entry, dict)] if isinstance(stored, list) else []
    previous_categories = {
        name: rows for name, rows in previous.items() if name not in METADATA_KEYS
    }
    changes = compare_categories(previous_categories, categories)
    if not changes:
        return history
    entry: dict[str, object] = {
        "Date": str(generated_at),
        "Added": sum(change["Added"] for change in changes),
        "Removed": sum(change["Removed"] for change in changes),
        "Categories": changes,
    }
    return [entry, *history][:HISTORY_MAX_ENTRIES]


def load_previous_dataset(path: Path) -> dict[str, object] | None:
    """Lire le jeu de données déjà publié, s'il existe et est exploitable.

    Args:
        path: Emplacement de ``data.json``.

    Returns:
        Le contenu du fichier, ou ``None`` s'il est absent, illisible ou
        n'est pas un objet JSON.
    """
    try:
        content = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return content if isinstance(content, dict) else None


def build_dataset(
    html: str,
    generated_at: datetime.datetime,
    previous: dict[str, object] | None = None,
) -> tuple[dict[str, list], list[str]]:
    """Construire le jeu de données complet écrit dans ``data.json``.

    Args:
        html: Contenu HTML de la page officielle.
        generated_at: Horodatage de génération affiché par le site.
        previous: Jeu de données précédent, pour l'historique des mises à
            jour ; ``None`` s'il n'y en a pas.

    Returns:
        Un couple ``(jeu de données, ignorées)``. Le jeu de données commence
        par les clés ``Timers`` (horodatage), ``Vaulted Relics`` (noms des
        reliques vaultées) et ``Update History`` (jours où les données ont
        changé), puis contient une clé par catégorie.

    Raises:
        DropTableError: Si aucune catégorie n'est trouvée ou si une catégorie
            reconnue ne contient aucune ligne, signe d'un changement de
            structure de la page qu'il ne faut pas publier silencieusement.
            Également si le calcul des reliques vaultées est impossible.
    """
    categories, skipped = parse_page(html)
    if not categories:
        raise DropTableError("aucune catégorie de drop trouvée dans la page")
    empty = [title for title, drops in categories.items() if not drops]
    if empty:
        raise DropTableError(f"catégories sans aucune ligne : {', '.join(empty)}")
    dataset: dict[str, list] = {
        TIMERS_KEY: [{"Update Data Set Date": str(generated_at)}],
        VAULTED_KEY: find_vaulted_relics(categories),
        HISTORY_KEY: update_history(previous, categories, generated_at),
    }
    dataset.update(categories)
    return dataset, skipped


def fetch_page(url: str) -> str:
    """Télécharger la page officielle des tables de drop.

    Args:
        url: Adresse de la page.

    Returns:
        Le contenu HTML décodé en UTF-8.

    Raises:
        DropTableError: Si le téléchargement échoue.
    """
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as reply:
            return reply.read().decode("utf-8")
    except (urllib.error.URLError, TimeoutError, UnicodeDecodeError) as error:
        raise DropTableError(f"téléchargement impossible : {error}") from error


def main(argv: list[str] | None = None) -> int:
    """Point d'entrée en ligne de commande.

    Args:
        argv: Arguments de la ligne de commande, ``sys.argv`` par défaut.

    Returns:
        Le code de sortie du processus : 0 en cas de succès, 1 sinon.
    """
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument(
        "--input",
        type=Path,
        help="fichier HTML local à lire au lieu de télécharger la page",
    )
    arguments.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"fichier JSON à écrire (défaut : {DEFAULT_OUTPUT})",
    )
    options = arguments.parse_args(argv)

    print("Retrieve Warframe Drop Table Data")
    try:
        if options.input is not None:
            html = options.input.read_text(encoding="utf-8")
        else:
            html = fetch_page(SOURCE_URL)
        previous = load_previous_dataset(options.output)
        dataset, skipped = build_dataset(html, datetime.datetime.now(), previous)
    except (DropTableError, OSError) as error:
        print(f"Error while gathering and processing the data: {error}")
        return 1

    for title, drops in dataset.items():
        if title not in METADATA_KEYS:
            print(f"  Parsed Category {title} {len(drops)} rows")
    print(f"  Vaulted relics: {len(dataset[VAULTED_KEY])}")
    history = dataset[HISTORY_KEY]
    if history and history[0]["Date"] == dataset[TIMERS_KEY][0]["Update Data Set Date"]:
        print(f"  Data changed: +{history[0]['Added']} / -{history[0]['Removed']} rows")
    else:
        print("  No data change since the previous dataset")
    for title in skipped:
        # Annotation visible dans l'interface GitHub Actions.
        print(f"::warning::Unknown table structure, category skipped: {title}")

    options.output.parent.mkdir(parents=True, exist_ok=True)
    with options.output.open("w", encoding="utf-8") as file:
        json.dump(dataset, file, ensure_ascii=False, indent=4)
    print("JSON File created successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
