"""Tests du parseur des tables de drop.

Les extraits HTML reprennent la structure réelle de la page officielle, une
famille de tableau par constante. Lancer avec :

    python -m unittest discover -s tests -v
"""

from __future__ import annotations

import datetime
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parent.parent


def _load_retriever() -> ModuleType:
    # Le nom du script contient un tiret : il ne peut pas être importé par
    # une instruction `import` classique.
    spec = importlib.util.spec_from_file_location(
        "data_retriever", ROOT / "data-retriever.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


retriever = _load_retriever()

BLANK_2 = '<tr class="blank-row"><td class="blank-row" colspan="2"></td></tr>'
BLANK_3 = '<tr class="blank-row"><td class="blank-row" colspan="3"></td></tr>'

MISSIONS = f"""
<h3 id="missionRewards">Missions:</h3>
<table>
<tr><th colspan="2">Mercury/Apollodorus (Survival)</th></tr>
<tr><th colspan="2">Rotation A</th></tr>
<tr><td>2,000 Credits Cache</td><td>Common (50.00%)</td></tr>
<tr><th colspan="2">Rotation B</th></tr>
<tr><td>Parry</td><td>Rare (7.69%)</td></tr>
{BLANK_2}
<tr id="phoridassassination"><th colspan="2">Phorid Assassination</th></tr>
<tr><td>Nyx Neuroptics Blueprint</td><td>Uncommon (38.72%)</td></tr>
{BLANK_2}
<tr><th colspan="2">Axi A1 Relic (Intact)</th></tr>
<tr><td>Fragor Prime Head</td><td>Uncommon (25.33%)</td></tr>
</table>
"""

BOUNTIES = f"""
<h3 id="cetusRewards">Cetus Bounty Rewards:</h3>
<table>
<tr><th colspan="3">Level 5 - 15 Cetus Bounty</th></tr>
<tr><th colspan="3">Rotation A</th></tr>
<tr><td class="pad-cell"></td><th colspan="2">Stage 1</th></tr>
<tr><td></td><td>Redirection</td><td>Uncommon (20.00%)</td></tr>
<tr><td class="pad-cell"></td><th colspan="2">Final Stage</th></tr>
<tr><td></td><td>100X Oxium</td><td>Uncommon (15.49%)</td></tr>
<tr><th colspan="3">Rotation B</th></tr>
<tr><td class="pad-cell"></td><th colspan="2">Stage 1</th></tr>
<tr><td></td><td>50 Endo</td><td>Rare (5.00%)</td></tr>
{BLANK_3}
<tr><th colspan="3">Level  55 - 60 WF1999 Bounty</th></tr>
<tr><td class="pad-cell"></td><th colspan="2">Final stage</th></tr>
<tr><td></td><td>600 Endo</td><td>Uncommon (19.51%)</td></tr>
</table>
"""

BY_DROP = f"""
<h3 id="modByDrop">Mod Drops by Mod:</h3>
<table>
<tr><th colspan="3">Target Acquired</th></tr>
<tr><th>Source</th><th>Mod Drop Chance</th><th>Chance</th></tr>
<tr><td>Tusk Thumper Bull</td><td>15.00%</td><td>Uncommon (12.50%)</td></tr>
<tr><td>Recon Commander</td><td>100.00%</td><td>Legendary (0.50%)</td></tr>
{BLANK_3}
<tr><th colspan="3">Searing Steel</th></tr>
<tr><th>Source</th><th>Mod Drop Chance</th><th>Chance</th></tr>
<tr><td>Comet Shredder Captain</td><td>5.00%</td><td>Beyond Legendary (Under Review) (0.00%)</td></tr>
</table>
"""

BY_SOURCE = f"""
<h3 id="blueprintByAvatar">Blueprint/Item Drops by Source:</h3>
<table>
<tr><th>H-09 Apex</th><th colspan="2">Blueprint/Item Drop Chance: 100.00%</th></tr>
<tr><td></td><td>Steel Essence</td><td>Very Common (100.00%)</td></tr>
{BLANK_3}
<tr><th>Techrot Scaart</th><th colspan="2">Blueprint/Item Drop Chance: 3.00%</th></tr>
<tr><td></td><td>Instant Secure</td><td>Common (37.94%)</td></tr>
<tr><td></td><td>Turbo Protect</td><td>Ultra Rare (1.01%)</td></tr>
</table>
"""

PREAMBLE = """
<h3>Disclaimer:</h3><p>Some text</p>
<h3>Table of Contents:</h3><ul><li><a href="#missionRewards">Missions</a></li></ul>
"""


class SplitChanceTest(unittest.TestCase):
    def test_split_chance_standard_cell(self) -> None:
        self.assertEqual(retriever.split_chance("Rare (7.69%)"), ("Rare", "7.69%"))

    def test_split_chance_nested_parentheses_keeps_percentage(self) -> None:
        # Régression : l'ancien découpage renvoyait "Under Review" comme
        # pourcentage, ce qui cassait le calcul de la chance réelle.
        self.assertEqual(
            retriever.split_chance("Beyond Legendary (Under Review) (0.00%)"),
            ("Beyond Legendary (Under Review)", "0.00%"),
        )

    def test_split_chance_without_parentheses(self) -> None:
        self.assertEqual(retriever.split_chance("Guaranteed"), ("Guaranteed", ""))


class StandardFamilyTest(unittest.TestCase):
    def setUp(self) -> None:
        categories, skipped = retriever.parse_page(MISSIONS)
        self.assertEqual(skipped, [])
        self.rows = categories["Missions:"]

    def test_row_count_excludes_headers_and_separators(self) -> None:
        self.assertEqual(len(self.rows), 4)

    def test_mission_with_rotations(self) -> None:
        self.assertEqual(
            self.rows[0],
            {
                "Source": "Mercury/Apollodorus (Survival)",
                "Mission Type": "Survival",
                "Rotation": "Rotation A",
                "Loot": "2,000 Credits Cache",
                "Rarity": "Common",
                "Percentage": "50.00%",
            },
        )
        self.assertEqual(self.rows[1]["Rotation"], "Rotation B")
        self.assertEqual(self.rows[1]["Loot"], "Parry")

    def test_mission_without_rotation_nor_type(self) -> None:
        phorid = self.rows[2]
        self.assertEqual(phorid["Source"], "Phorid Assassination")
        self.assertEqual(phorid["Mission Type"], "no_mission_type")
        self.assertEqual(phorid["Rotation"], "no_rotation")

    def test_separator_resets_rotation_and_mission_type(self) -> None:
        # La rotation B et le type "Survival" du premier bloc ne doivent pas
        # déborder sur les blocs suivants.
        relic = self.rows[3]
        self.assertEqual(relic["Source"], "Axi A1 Relic (Intact)")
        self.assertEqual(relic["Mission Type"], "Intact")
        self.assertEqual(relic["Rotation"], "no_rotation")


DYNAMIC = f"""
<h3 id="transientRewards">Dynamic Location Rewards:</h3>
<table>
<tr id="arbitrations"><th colspan="2">Arbitrations</th></tr>
<tr><th>Rotation A</th><td></td></tr>
<tr><td>Ayatan Valana Sculpture</td><td>Rare (9.00%)</td></tr>
<tr><th>Rotation B</th><td></td></tr>
<tr><td>3X Vitus Essence</td><td>Rare (7.00%)</td></tr>
{BLANK_2}
<tr><th colspan="2">Kuva Flood</th></tr>
<tr><td>1200X Kuva</td><td>Common (100.00%)</td></tr>
{BLANK_2}
<tr><th colspan="2">Saturn/(Variant) Annihilation (Conclave) Extra</th></tr>
<tr><td>Anticipation</td><td>Rare (5.00%)</td></tr>
</table>
"""


class RotationAndMissionTypeVariantsTest(unittest.TestCase):
    """Formes relevées sur la page réelle et absentes de ``MISSIONS``."""

    def setUp(self) -> None:
        categories, skipped = retriever.parse_page(DYNAMIC)
        self.assertEqual(skipped, [])
        self.rows = categories["Dynamic Location Rewards:"]

    def test_rotation_header_followed_by_empty_cell_is_not_a_reward(self) -> None:
        # « <th>Rotation A</th><td></td> » ne doit ni créer de ligne ni
        # remplacer le nom de la source.
        self.assertEqual(len(self.rows), 4)
        self.assertEqual({row["Source"] for row in self.rows[:2]}, {"Arbitrations"})

    def test_rotation_header_followed_by_empty_cell_sets_rotation(self) -> None:
        self.assertEqual(self.rows[0]["Rotation"], "Rotation A")
        self.assertEqual(self.rows[0]["Loot"], "Ayatan Valana Sculpture")
        self.assertEqual(self.rows[1]["Rotation"], "Rotation B")

    def test_rotation_does_not_leak_into_next_source(self) -> None:
        self.assertEqual(self.rows[2]["Source"], "Kuva Flood")
        self.assertEqual(self.rows[2]["Rotation"], "no_rotation")

    def test_mission_type_is_the_last_parenthesis(self) -> None:
        self.assertEqual(self.rows[3]["Mission Type"], "Conclave")


class BountyFamilyTest(unittest.TestCase):
    def setUp(self) -> None:
        categories, _ = retriever.parse_page(BOUNTIES)
        self.rows = categories["Cetus Bounty Rewards:"]

    def test_row_count(self) -> None:
        self.assertEqual(len(self.rows), 4)

    def test_reward_is_read_from_second_column(self) -> None:
        self.assertEqual(
            self.rows[0],
            {
                "Source": "Level 5 - 15 Cetus Bounty",
                "Rotation": "Rotation A",
                "Stage": "Stage 1",
                "Loot": "Redirection",
                "Rarity": "Uncommon",
                "Percentage": "20.00%",
            },
        )

    def test_stage_changes_within_same_rotation(self) -> None:
        self.assertEqual(self.rows[1]["Rotation"], "Rotation A")
        self.assertEqual(self.rows[1]["Stage"], "Final Stage")

    def test_second_wide_header_is_a_rotation_not_a_new_bounty(self) -> None:
        self.assertEqual(self.rows[2]["Source"], "Level 5 - 15 Cetus Bounty")
        self.assertEqual(self.rows[2]["Rotation"], "Rotation B")
        self.assertEqual(self.rows[2]["Stage"], "Stage 1")

    def test_bounty_without_rotation(self) -> None:
        hex_row = self.rows[3]
        self.assertEqual(hex_row["Source"], "Level  55 - 60 WF1999 Bounty")
        self.assertEqual(hex_row["Rotation"], "no_rotation")
        self.assertEqual(hex_row["Stage"], "Final stage")


class ByDropFamilyTest(unittest.TestCase):
    def setUp(self) -> None:
        categories, _ = retriever.parse_page(BY_DROP)
        self.rows = categories["Mod Drops by Mod:"]

    def test_column_title_rows_are_not_data(self) -> None:
        self.assertEqual(len(self.rows), 3)
        self.assertNotIn("Source", [row["Source"] for row in self.rows])

    def test_source_and_item_are_not_swapped(self) -> None:
        self.assertEqual(
            self.rows[0],
            {
                "Source": "Tusk Thumper Bull",
                "Mod Drop Chance": "15.00%",
                "Loot": "Target Acquired",
                "Rarity": "Uncommon",
                "Percentage": "12.50%",
            },
        )

    def test_item_name_changes_after_separator(self) -> None:
        self.assertEqual(self.rows[1]["Loot"], "Target Acquired")
        self.assertEqual(self.rows[2]["Loot"], "Searing Steel")
        self.assertEqual(self.rows[2]["Rarity"], "Beyond Legendary (Under Review)")
        self.assertEqual(self.rows[2]["Percentage"], "0.00%")


class BySourceFamilyTest(unittest.TestCase):
    def setUp(self) -> None:
        categories, _ = retriever.parse_page(BY_SOURCE)
        self.rows = categories["Blueprint/Item Drops by Source:"]

    def test_row_count(self) -> None:
        self.assertEqual(len(self.rows), 3)

    def test_drop_chance_is_extracted_from_header_label(self) -> None:
        self.assertEqual(
            self.rows[0],
            {
                "Source": "H-09 Apex",
                "Loot Drop Chance": "100.00%",
                "Loot": "Steel Essence",
                "Rarity": "Very Common",
                "Percentage": "100.00%",
            },
        )

    def test_each_source_keeps_its_own_drop_chance(self) -> None:
        self.assertEqual(self.rows[1]["Source"], "Techrot Scaart")
        self.assertEqual(self.rows[1]["Loot Drop Chance"], "3.00%")
        self.assertEqual(self.rows[2]["Loot"], "Turbo Protect")
        self.assertEqual(self.rows[2]["Loot Drop Chance"], "3.00%")

    def test_consecutive_sources_without_separator(self) -> None:
        html = """
        <h3>Sigil Drops by Source:</h3><table>
        <tr><th>First</th><th colspan="2">Sigil Drop Chance: 7.00%</th></tr>
        <tr><td></td><td>Alpha</td><td>Common (60.00%)</td></tr>
        <tr><th>Second</th><th colspan="2">Sigil Drop Chance: 15.00%</th></tr>
        <tr><td></td><td>Beta</td><td>Rare (40.00%)</td></tr>
        </table>"""
        rows = retriever.parse_page(html)[0]["Sigil Drops by Source:"]
        self.assertEqual(
            [(row["Source"], row["Loot Drop Chance"], row["Loot"]) for row in rows],
            [("First", "7.00%", "Alpha"), ("Second", "15.00%", "Beta")],
        )


class PageStructureTest(unittest.TestCase):
    def test_family_is_detected_from_structure_not_from_title(self) -> None:
        # Une catégorie inconnue reprenant une forme connue doit être lue.
        renamed = BY_SOURCE.replace(
            "Blueprint/Item Drops by Source:", "Brand New Drops:"
        )
        categories, skipped = retriever.parse_page(renamed)
        self.assertEqual(skipped, [])
        self.assertEqual(len(categories["Brand New Drops:"]), 3)

    def test_titles_without_table_do_not_capture_next_table(self) -> None:
        categories, skipped = retriever.parse_page(PREAMBLE + MISSIONS + BY_SOURCE)
        self.assertEqual(
            list(categories), ["Missions:", "Blueprint/Item Drops by Source:"]
        )
        self.assertEqual(skipped, [])

    def test_full_page_keeps_every_family_separate(self) -> None:
        page = PREAMBLE + MISSIONS + BOUNTIES + BY_DROP + BY_SOURCE
        categories, _ = retriever.parse_page(page)
        self.assertEqual(
            {title: len(rows) for title, rows in categories.items()},
            {
                "Missions:": 4,
                "Cetus Bounty Rewards:": 4,
                "Mod Drops by Mod:": 3,
                "Blueprint/Item Drops by Source:": 3,
            },
        )

    def test_unknown_table_structure_is_reported_not_parsed(self) -> None:
        html = """
        <h3>Strange:</h3><table>
        <tr><th>A</th><th>B</th><th>C</th><th>D</th></tr>
        <tr><td>1</td><td>2</td><td>3</td><td>4</td></tr>
        </table>"""
        categories, skipped = retriever.parse_page(html + MISSIONS)
        self.assertEqual(skipped, ["Strange:"])
        self.assertEqual(list(categories), ["Missions:"])

    def test_html_entities_are_decoded(self) -> None:
        html = """
        <h3>Albrecht&#39;s Laboratories Bounty Rewards:</h3><table>
        <tr><th colspan="2">Caches &amp; Co</th></tr>
        <tr><td>H&ouml;llvanian Fragment</td><td>Rare (4.88%)</td></tr>
        </table>"""
        categories, _ = retriever.parse_page(html)
        row = categories["Albrecht's Laboratories Bounty Rewards:"][0]
        self.assertEqual(row["Source"], "Caches & Co")
        self.assertEqual(row["Loot"], "Höllvanian Fragment")


class BuildDatasetTest(unittest.TestCase):
    NOW = datetime.datetime(2026, 11, 15, 7, 18, 50)

    def test_dataset_starts_with_timer_then_categories(self) -> None:
        dataset, skipped = retriever.build_dataset(MISSIONS + BY_SOURCE, self.NOW)
        self.assertEqual(skipped, [])
        self.assertEqual(
            list(dataset),
            [
                "Timers",
                "Vaulted Relics",
                "Update History",
                "Missions:",
                "Blueprint/Item Drops by Source:",
            ],
        )
        self.assertEqual(dataset["Vaulted Relics"], [])
        self.assertEqual(
            dataset["Timers"], [{"Update Data Set Date": "2026-11-15 07:18:50"}]
        )

    def test_page_without_category_is_rejected(self) -> None:
        with self.assertRaises(retriever.DropTableError):
            retriever.build_dataset(PREAMBLE, self.NOW)

    def test_category_without_rows_is_rejected(self) -> None:
        # Un tableau reconnu mais vide trahit un changement de structure :
        # publier un jeu de données amputé serait pire que ne rien publier.
        html = '<h3>Keys:</h3><table><tr><th colspan="2">Empty Key</th></tr></table>'
        with self.assertRaises(retriever.DropTableError) as caught:
            retriever.build_dataset(MISSIONS + html, self.NOW)
        self.assertIn("Keys:", str(caught.exception))


def _relic_block(name: str) -> str:
    return (
        f'<tr><th colspan="2">{name} (Intact)</th></tr>'
        "<tr><td>Forma Blueprint</td><td>Uncommon (25.33%)</td></tr>"
        f"{BLANK_2}"
        f'<tr><th colspan="2">{name} (Radiant)</th></tr>'
        "<tr><td>Forma Blueprint</td><td>Uncommon (20.00%)</td></tr>"
        f"{BLANK_2}"
    )


def _relic_page(relics: list[str], mission_loots: list[str]) -> str:
    rewards = "".join(
        f"<tr><td>{loot}</td><td>Rare (5.00%)</td></tr>" for loot in mission_loots
    )
    return (
        "<h3>Missions:</h3><table>"
        '<tr><th colspan="2">Void/Hepit (Capture)</th></tr>'
        f"{rewards}</table>"
        "<h3>Relics:</h3><table>"
        f"{''.join(_relic_block(name) for name in relics)}</table>"
    )


class VaultedRelicsTest(unittest.TestCase):
    NOW = datetime.datetime(2026, 11, 15, 7, 18, 50)

    def _vaulted(self, relics: list[str], mission_loots: list[str]) -> list[str]:
        dataset, _ = retriever.build_dataset(
            _relic_page(relics, mission_loots), self.NOW
        )
        return dataset["Vaulted Relics"]

    def test_relic_base_name_strips_only_the_state_suffix(self) -> None:
        self.assertEqual(
            retriever.relic_base_name("Axi A1 Relic (Radiant)"), "Axi A1 Relic"
        )
        self.assertEqual(retriever.relic_base_name("Axi A1 Relic"), "Axi A1 Relic")

    def test_relic_absent_from_every_reward_table_is_vaulted(self) -> None:
        self.assertEqual(
            self._vaulted(
                ["Axi A1 Relic", "Lith B2 Relic"], ["Lith B2 Relic", "100 Endo"]
            ),
            ["Axi A1 Relic"],
        )

    def test_relic_rewarded_only_in_refined_state_is_not_vaulted(self) -> None:
        # Certaines sources donnent la relique déjà raffinée : le suffixe
        # d'état ne doit pas empêcher le rapprochement.
        self.assertEqual(
            self._vaulted(
                ["Axi A1 Relic", "Neo C3 Relic"],
                ["Axi A1 Relic (Radiant)", "Neo C3 Relic"],
            ),
            [],
        )

    def test_relic_listed_only_inside_relics_category_stays_vaulted(self) -> None:
        # La table de contenu d'une relique ne compte pas comme une source.
        vaulted = self._vaulted(["Meso D4 Relic", "Lith B2 Relic"], ["Lith B2 Relic"])
        self.assertEqual(vaulted, ["Meso D4 Relic"])

    def test_similar_names_are_not_confused(self) -> None:
        # "Axi A1" ne doit pas être considérée comme disponible parce que
        # "Axi A10" l'est.
        self.assertEqual(
            self._vaulted(["Axi A1 Relic", "Axi A10 Relic"], ["Axi A10 Relic"]),
            ["Axi A1 Relic"],
        )

    def test_non_vaultable_tiers_are_never_flagged(self) -> None:
        vaulted = self._vaulted(
            ["Requiem I Relic", "Vanguard C1 Relic", "Neo C3 Relic", "Lith B2 Relic"],
            ["Requiem Eterna Relic", "Lith B2 Relic"],
        )
        self.assertEqual(vaulted, ["Neo C3 Relic"])

    def test_result_is_sorted_and_without_duplicates(self) -> None:
        vaulted = self._vaulted(
            ["Neo Z9 Relic", "Axi A1 Relic", "Lith B2 Relic"], ["Lith B2 Relic"]
        )
        self.assertEqual(vaulted, ["Axi A1 Relic", "Neo Z9 Relic"])

    def test_no_relic_found_as_reward_is_rejected(self) -> None:
        # Sans ce garde-fou, un changement de nommage côté éditeur marquerait
        # toutes les reliques comme vaultées sans alerte.
        with self.assertRaises(retriever.DropTableError):
            self._vaulted(["Axi A1 Relic", "Lith B2 Relic"], ["100 Endo"])

    def test_page_without_relics_category_has_empty_vault(self) -> None:
        dataset, _ = retriever.build_dataset(MISSIONS, self.NOW)
        self.assertEqual(dataset["Vaulted Relics"], [])


class UpdateHistoryTest(unittest.TestCase):
    DAY_1 = datetime.datetime(2026, 11, 15, 1, 0, 0)
    DAY_2 = datetime.datetime(2026, 11, 16, 1, 0, 0)
    DAY_3 = datetime.datetime(2026, 11, 17, 1, 0, 0)

    def test_first_dataset_has_no_history(self) -> None:
        # Sans jeu précédent il n'y a rien à comparer : tout marquer comme
        # « ajouté » ferait passer la mise en service pour un changement.
        dataset, _ = retriever.build_dataset(MISSIONS, self.DAY_1)
        self.assertEqual(dataset["Update History"], [])

    def test_identical_data_does_not_add_an_entry(self) -> None:
        first, _ = retriever.build_dataset(MISSIONS, self.DAY_1)
        second, _ = retriever.build_dataset(MISSIONS, self.DAY_2, first)
        self.assertEqual(second["Update History"], [])
        # L'horodatage, lui, suit bien la dernière extraction.
        self.assertEqual(
            second["Timers"], [{"Update Data Set Date": "2026-11-16 01:00:00"}]
        )

    def test_changed_value_counts_as_one_removed_and_one_added(self) -> None:
        first, _ = retriever.build_dataset(MISSIONS, self.DAY_1)
        changed = MISSIONS.replace("Rare (7.69%)", "Rare (9.00%)")
        second, _ = retriever.build_dataset(changed, self.DAY_2, first)
        parry = {
            "Source": "Mercury/Apollodorus (Survival)",
            "Mission Type": "Survival",
            "Rotation": "Rotation B",
            "Loot": "Parry",
            "Rarity": "Rare",
            "Percentage": "7.69%",
        }
        self.assertEqual(
            second["Update History"],
            [
                {
                    "Date": "2026-11-16 01:00:00",
                    "Added": 1,
                    "Removed": 1,
                    "Categories": [
                        {
                            "Name": "Missions:",
                            "Added": 1,
                            "Removed": 1,
                            "Added Rows": [{**parry, "Percentage": "9.00%"}],
                            "Removed Rows": [parry],
                        }
                    ],
                }
            ],
        )

    def test_new_and_removed_categories_are_reported(self) -> None:
        first, _ = retriever.build_dataset(MISSIONS + BY_SOURCE, self.DAY_1)
        second, _ = retriever.build_dataset(MISSIONS + BOUNTIES, self.DAY_2, first)
        entry = second["Update History"][0]
        by_name = {change["Name"]: change for change in entry["Categories"]}
        self.assertEqual(set(by_name), {"Cetus Bounty Rewards:", "Blueprint/Item Drops by Source:"})
        added = len(second["Cetus Bounty Rewards:"])
        removed = len(first["Blueprint/Item Drops by Source:"])
        bounty = by_name["Cetus Bounty Rewards:"]
        self.assertEqual((bounty["Added"], bounty["Removed"]), (added, 0))
        self.assertEqual(bounty["Added Rows"], second["Cetus Bounty Rewards:"])
        self.assertEqual(bounty["Removed Rows"], [])
        gone = by_name["Blueprint/Item Drops by Source:"]
        self.assertEqual((gone["Added"], gone["Removed"]), (0, removed))
        self.assertEqual(gone["Removed Rows"], first["Blueprint/Item Drops by Source:"])
        self.assertEqual((entry["Added"], entry["Removed"]), (added, removed))

    def test_quiet_day_keeps_earlier_entries_and_newest_comes_first(self) -> None:
        first, _ = retriever.build_dataset(MISSIONS, self.DAY_1)
        changed = MISSIONS.replace("Rare (7.69%)", "Rare (9.00%)")
        second, _ = retriever.build_dataset(changed, self.DAY_2, first)
        # Jour 3 sans changement : l'entrée du jour 2 doit survivre telle quelle.
        third, _ = retriever.build_dataset(changed, self.DAY_3, second)
        self.assertEqual(third["Update History"], second["Update History"])
        # Jour 3 bis avec retour à l'état initial : nouvelle entrée en tête.
        back, _ = retriever.build_dataset(MISSIONS, self.DAY_3, second)
        self.assertEqual(
            [entry["Date"] for entry in back["Update History"]],
            ["2026-11-17 01:00:00", "2026-11-16 01:00:00"],
        )

    def test_row_order_alone_is_not_a_change(self) -> None:
        rows = [{"Loot": "A"}, {"Loot": "B"}, {"Loot": "A"}]
        same = retriever.compare_categories({"X:": rows}, {"X:": list(reversed(rows))})
        self.assertEqual(same, [])
        # Un doublon en moins est bien un changement : c'est un multi-ensemble.
        fewer = retriever.compare_categories({"X:": rows}, {"X:": rows[:2]})
        self.assertEqual(
            fewer,
            [
                {
                    "Name": "X:",
                    "Added": 0,
                    "Removed": 1,
                    "Added Rows": [],
                    "Removed Rows": [{"Loot": "A"}],
                }
            ],
        )

    def test_field_order_alone_is_not_a_change(self) -> None:
        before = {"X:": [{"Loot": "A", "Rarity": "Rare"}]}
        after = {"X:": [{"Rarity": "Rare", "Loot": "A"}]}
        self.assertEqual(retriever.compare_categories(before, after), [])

    def test_stored_rows_are_capped_but_counts_stay_exact(self) -> None:
        total = retriever.HISTORY_MAX_ROWS + 7
        rows = [{"Loot": f"Item {index}"} for index in range(total)]
        (change,) = retriever.compare_categories({}, {"X:": rows})
        self.assertEqual(change["Added"], total)
        self.assertEqual(change["Added Rows"], rows[: retriever.HISTORY_MAX_ROWS])

    def test_history_is_capped_and_drops_the_oldest(self) -> None:
        old = [{"Date": f"day {index}"} for index in range(retriever.HISTORY_MAX_ENTRIES)]
        previous = {"Update History": old, "Missions:": []}
        history = retriever.update_history(previous, {"Missions:": [{"Loot": "A"}]}, self.DAY_1)
        self.assertEqual(len(history), retriever.HISTORY_MAX_ENTRIES)
        self.assertEqual(history[0]["Date"], "2026-11-15 01:00:00")
        self.assertEqual(history[-1]["Date"], f"day {retriever.HISTORY_MAX_ENTRIES - 2}")

    def test_history_is_not_compared_as_a_category(self) -> None:
        # Les clés de métadonnées du jeu précédent ne doivent jamais être
        # prises pour des catégories disparues.
        first, _ = retriever.build_dataset(MISSIONS, self.DAY_1)
        first["Update History"] = [{"Date": "earlier"}]
        first["Vaulted Relics"] = ["Axi A1 Relic"]
        second, _ = retriever.build_dataset(MISSIONS, self.DAY_2, first)
        self.assertEqual(second["Update History"], [{"Date": "earlier"}])

    def test_main_compares_with_the_existing_output_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "page.html"
            output = Path(directory) / "data.json"
            source.write_text(MISSIONS, encoding="utf-8")
            arguments = ["--input", str(source), "--output", str(output)]
            self.assertEqual(retriever.main(arguments), 0)
            self.assertEqual(retriever.main(arguments), 0)
            unchanged = json.loads(output.read_text(encoding="utf-8"))
            source.write_text(MISSIONS.replace("Parry", "Vitality"), encoding="utf-8")
            self.assertEqual(retriever.main(arguments), 0)
            changed = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(unchanged["Update History"], [])
        self.assertEqual(len(changed["Update History"]), 1)
        self.assertEqual(changed["Update History"][0]["Added"], 1)

    def test_unreadable_previous_file_is_ignored(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            broken = Path(directory) / "data.json"
            broken.write_text("{not json", encoding="utf-8")
            self.assertIsNone(retriever.load_previous_dataset(broken))
            broken.write_text("[1, 2]", encoding="utf-8")
            self.assertIsNone(retriever.load_previous_dataset(broken))
            self.assertIsNone(retriever.load_previous_dataset(Path(directory) / "absent.json"))


class CommandLineTest(unittest.TestCase):
    def test_main_writes_json_readable_by_the_site(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "page.html"
            output = Path(directory) / "nested" / "data.json"
            source.write_text(PREAMBLE + MISSIONS + BOUNTIES, encoding="utf-8")
            code = retriever.main(["--input", str(source), "--output", str(output)])
            self.assertEqual(code, 0)
            dataset = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(
            list(dataset),
            ["Timers", "Vaulted Relics", "Update History", "Missions:", "Cetus Bounty Rewards:"],
        )
        self.assertEqual(dataset["Missions:"][2]["Source"], "Phorid Assassination")

    def test_main_fails_without_overwriting_existing_data(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "page.html"
            output = Path(directory) / "data.json"
            source.write_text(PREAMBLE, encoding="utf-8")
            output.write_text('{"previous": true}', encoding="utf-8")
            code = retriever.main(["--input", str(source), "--output", str(output)])
            self.assertEqual(code, 1)
            self.assertEqual(output.read_text(encoding="utf-8"), '{"previous": true}')

    def test_main_fails_on_missing_input_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / "absent.html"
            output = Path(directory) / "data.json"
            code = retriever.main(["--input", str(missing), "--output", str(output)])
            self.assertEqual(code, 1)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
