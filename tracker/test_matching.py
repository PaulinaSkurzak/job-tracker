from django.test import SimpleTestCase

from . import matching
from .matching import extract_skills, find_spans
from .skills import ALIASES, SKILLS


class VocabularyTests(SimpleTestCase):
    def test_every_alias_points_at_a_real_skill(self):
        for alias, skill in ALIASES.items():
            self.assertIn(skill, SKILLS, f"alias {alias!r} points at unknown skill {skill!r}")

    def test_no_duplicate_skills(self):
        self.assertEqual(len(SKILLS), len(set(SKILLS)))


class ExtractSkillsTests(SimpleTestCase):
    def found(self, text):
        return matching.extract_skills(text)

    def test_is_case_insensitive(self):
        self.assertEqual(self.found("PYTHON and Sql"), {"Python", "SQL"})

    def test_sql_is_not_found_inside_mysql_or_nosql(self):
        self.assertEqual(self.found("We use MySQL and NoSQL"), {"MySQL", "NoSQL"})

    def test_git_is_not_found_inside_github(self):
        self.assertEqual(self.found("Experience with GitHub"), {"GitHub"})

    def test_java_is_not_found_inside_javascript(self):
        self.assertEqual(self.found("JavaScript"), {"JavaScript"})

    def test_symbols_in_skill_names(self):
        self.assertEqual(self.found("C++, C#, and Node.js, CI/CD"), {"C++", "C#", "Node.js", "CI/CD"})

    def test_node_js_does_not_also_count_as_javascript(self):
        self.assertEqual(self.found("Node.js and React.js"), {"Node.js", "React"})

    def test_a_skill_right_after_a_sentence_end_still_matches(self):
        self.assertEqual(self.found("We use tools. Python is key."), {"Python"})

    def test_hyphens_underscores_and_spacing_are_equivalent(self):
        for text in ["scikit-learn", "scikit_learn", "Scikit Learn", "scikit   learn"]:
            self.assertEqual(self.found(text), {"scikit-learn"}, text)

    def test_plurals_match(self):
        self.assertEqual(self.found("build data pipelines and REST APIs"), {"data pipeline", "REST API", "API"})

    def test_aliases_map_to_the_skill(self):
        self.assertEqual(self.found("sklearn, postgres, k8s"), {"scikit-learn", "PostgreSQL", "Kubernetes"})
        self.assertEqual(self.found("natural language processing"), {"NLP"})

    def test_punctuation_around_a_skill_is_fine(self):
        self.assertEqual(self.found("(Python), SQL; and R."), {"Python", "SQL", "R"})

    def test_r_language_needs_a_standalone_capital_r(self):
        self.assertIn("R", self.found("Python/R"))
        self.assertIn("R", self.found("R/Python"))
        self.assertIn("R", self.found("Proficient in R programming"))
        self.assertNotIn("R", self.found("We invest in R&D and research"))
        self.assertNotIn("R", self.found("river rocks"))

    def test_ambiguous_words_only_count_when_capitalized(self):
        self.assertNotIn("Spark", self.found("spark curiosity"))
        self.assertIn("Spark", self.found("Experience with Spark"))
        self.assertNotIn("Excel", self.found("we excel at teamwork"))
        self.assertIn("Excel", self.found("Advanced Excel"))

    def test_empty_and_none(self):
        self.assertEqual(self.found(""), set())
        self.assertEqual(self.found(None), set())

    def test_multiword_skills(self):
        self.assertEqual(self.found("machine learning and computer vision"), {"machine learning", "computer vision"})


class MatchTests(SimpleTestCase):
    def test_score_is_the_share_of_job_skills_found_in_the_resume(self):
        result = matching.match("Python, SQL, Docker and AWS", "I know Python and SQL")
        self.assertEqual(result.score, 50)
        self.assertEqual(result.matched, ["Python", "SQL"])
        self.assertEqual(result.missing, ["AWS", "Docker"])
        self.assertEqual(result.total, 4)

    def test_perfect_match(self):
        self.assertEqual(matching.match("Python", "Python and more").score, 100)

    def test_skills_only_in_the_resume_do_not_change_the_score(self):
        self.assertEqual(matching.match("Python", "Python, Java, Go, Rust, Docker").score, 100)

    def test_score_is_none_when_the_job_has_no_known_skills(self):
        result = matching.match("Must be a great team player", "Python")
        self.assertIsNone(result.score)
        self.assertEqual((result.matched, result.missing), ([], []))

    def test_empty_resume_scores_zero(self):
        self.assertEqual(matching.match("Python and SQL", "").score, 0)

    def test_score_rounds_to_a_whole_number(self):
        self.assertEqual(matching.match("Python, SQL, Docker", "Python").score, 33)


class FindSpansTests(SimpleTestCase):
    def spans(self, text):
        return [(text[s.start:s.end], s.skill) for s in find_spans(text)]

    def test_positions_point_into_the_original_text(self):
        self.assertEqual(self.spans("Uses  Python and sklearn."), [("Python", "Python"), ("sklearn", "scikit-learn")])

    def test_multi_word_skill_across_a_line_break_and_hyphens(self):
        self.assertEqual(self.spans("machine\nlearning, scikit-learn"),
                         [("machine\nlearning", "machine learning"), ("scikit-learn", "scikit-learn")])

    def test_same_word_boundary_and_case_rules_as_the_matcher(self):
        expected = [("MySQL", "MySQL"), ("GitHub", "GitHub"), ("Spark", "Spark")]
        self.assertEqual(self.spans("MySQL, GitHub, R&D, spark, Spark"), expected)

    def test_a_skill_inside_a_longer_one_is_merged_away(self):
        self.assertEqual(self.spans("Build a REST API."), [("REST API", "REST API")])

    def test_finds_exactly_the_skills_extract_skills_finds(self):
        # Every vocabulary skill and alias, in several spellings, must agree between the two code paths.
        samples = [" ".join(SKILLS), " ".join(ALIASES), " ".join(SKILLS).upper(), " ".join(SKILLS).replace(" ", "\n  ")]
        for text in samples:
            with self.subTest(text=text[:40]):
                self.assertEqual({s.skill for s in find_spans(text, merge_overlaps=False)}, extract_skills(text))

    def test_characters_that_lengthen_when_lowercased_do_not_shift_positions(self):
        text = "İstanbul team uses Python"
        self.assertEqual(self.spans(text), [("Python", "Python")])
