"""Resume-to-job-description keyword matching. Pure Python: no Django, no database.

How it works
1. Find which skills from the vocabulary (skills.py) appear in the job description.
2. Find which of those also appear in the resume.
3. score = matched / skills in the job description, as a percentage.
"""

import re
from dataclasses import dataclass

from .skills import ALIASES, CASE_SENSITIVE, SKILLS


@dataclass
class MatchResult:
    score: int | None  # 0-100, or None when the job description contains no known skills
    matched: list[str]  # in the job description and in the resume
    missing: list[str]  # in the job description but not in the resume

    @property
    def total(self) -> int:
        return len(self.matched) + len(self.missing)


def _normalize(text: str) -> str:
    """Lowercase, and treat hyphens/underscores/runs of spaces as single spaces.

    This makes "scikit-learn", "scikit_learn" and "Scikit Learn" identical.
    """
    return re.sub(r"\s+", " ", re.sub(r"[-_]", " ", text.lower())).strip()


def _build_patterns():
    aliases_by_skill = {}
    for alias, skill in ALIASES.items():
        aliases_by_skill.setdefault(skill, []).append(alias)

    patterns = {}
    for skill in SKILLS:
        if skill in CASE_SENSITIVE:
            # Matched against the original text, exactly as capitalized. "&" is excluded on both
            # sides so "R&D" does not count as the R language.
            patterns[skill] = re.compile(rf"(?<![A-Za-z0-9&]){re.escape(skill)}(?![A-Za-z0-9&])")
            continue
        names = [_normalize(skill)] + aliases_by_skill.get(skill, [])
        alternatives = "|".join(re.escape(name) for name in sorted(names, key=len, reverse=True))
        # The lookarounds stop "sql" matching inside "mysql" or "nosql", and "git" inside "github".
        # "+" and "#" count as word characters so "c++" and "c#" are not cut short.
        # A leading "." is blocked too, so the "js" alias cannot match inside "node.js".
        # The optional trailing "s" lets "pipeline" match "pipelines" and "API" match "APIs".
        patterns[skill] = re.compile(rf"(?<![a-z0-9+#.])(?:{alternatives})s?(?![a-z0-9+#])")
    return patterns


_PATTERNS = _build_patterns()


def extract_skills(text: str) -> set[str]:
    """Return the vocabulary skills mentioned in text."""
    if not text:
        return set()
    normalized = _normalize(text)
    found = set()
    for skill, pattern in _PATTERNS.items():
        haystack = text if skill in CASE_SENSITIVE else normalized
        if pattern.search(haystack):
            found.add(skill)
    return found


def match(job_description: str, resume_text: str) -> MatchResult:
    wanted = extract_skills(job_description)
    have = extract_skills(resume_text)
    matched = sorted(wanted & have, key=str.lower)
    missing = sorted(wanted - have, key=str.lower)
    score = round(100 * len(matched) / len(wanted)) if wanted else None
    return MatchResult(score=score, matched=matched, missing=missing)
