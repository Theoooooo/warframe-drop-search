"""Cohérence entre l'historique des versions affiché et la mémoire du projet.

``memory/CONTENT_SUMMARY.md`` est la source de vérité ; ``docs/version.js``
en est la copie affichée dans l'interface. Ces tests échouent dès que l'un
est mis à jour sans l'autre.

Lancement : ``python3 -m unittest discover -s tests``
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEMORY = ROOT / "memory" / "CONTENT_SUMMARY.md"
VERSION_JS = ROOT / "docs" / "version.js"

SEMVER = r"\d+\.\d+\.\d+"


def memory_current_version(text: str) -> str:
    match = re.search(rf"^\*\*Version courante : ({SEMVER})\*\*$", text, re.MULTILINE)
    if match is None:
        raise AssertionError("ligne « Version courante » introuvable dans la mémoire")
    return match.group(1)


def memory_history(text: str) -> list[tuple[str, str]]:
    """Couples (version, date) des titres de l'historique, dans l'ordre du fichier."""
    return re.findall(
        rf"^## Version ({SEMVER}) — (\d{{4}}-\d{{2}}-\d{{2}}) \d{{2}}:\d{{2}}$",
        text,
        re.MULTILINE,
    )


def interface_history(text: str) -> list[tuple[str, str]]:
    """Couples (version, date) déclarés dans ``window.APP_VERSIONS``."""
    return re.findall(
        rf"version:\s*'({SEMVER})',\s*date:\s*'(\d{{4}}-\d{{2}}-\d{{2}})'", text
    )


class VersionConsistencyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.memory = MEMORY.read_text(encoding="utf-8")
        cls.script = VERSION_JS.read_text(encoding="utf-8")

    def test_every_version_title_of_the_memory_is_parsed(self) -> None:
        # Garde-fou du test lui-même : un titre mal formé (date absente,
        # tiret court) serait ignoré par memory_history et rendrait les
        # comparaisons suivantes faussement vertes.
        titles = re.findall(r"^## Version .*$", self.memory, re.MULTILINE)
        self.assertGreater(len(titles), 0)
        self.assertEqual(len(titles), len(memory_history(self.memory)))

    def test_every_entry_of_the_interface_is_parsed(self) -> None:
        declared = len(re.findall(r"\bversion:", self.script))
        self.assertGreater(declared, 0)
        self.assertEqual(declared, len(interface_history(self.script)))

    def test_current_version_is_the_first_history_entry_of_the_memory(self) -> None:
        self.assertEqual(
            memory_current_version(self.memory), memory_history(self.memory)[0][0]
        )

    def test_interface_shows_the_current_version(self) -> None:
        # script.js affiche la première entrée comme version courante.
        self.assertEqual(
            interface_history(self.script)[0][0], memory_current_version(self.memory)
        )

    def test_interface_and_memory_list_the_same_versions_and_dates(self) -> None:
        self.assertEqual(interface_history(self.script), memory_history(self.memory))

    def test_versions_are_strictly_decreasing(self) -> None:
        numbers = [
            tuple(int(part) for part in version.split("."))
            for version, _ in memory_history(self.memory)
        ]
        self.assertEqual(numbers, sorted(set(numbers), reverse=True))


if __name__ == "__main__":
    unittest.main()
