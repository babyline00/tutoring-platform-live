/**
 * Seed data + helpers for the Subject catalog.
 *
 * Six hardcoded subjects (math, physics, chemistry, programming, languages,
 * general) with curated topic lists. This module is the single source of
 * truth — both the `scripts/seed-subjects.ts` runner and the
 * `subject.test.ts` suite import from here so the DB and the tests can never
 * drift out of sync.
 */

export interface SubjectSeed {
  name: string;
  label: string;
  topics: string[];
}

export const SUBJECT_SEEDS: SubjectSeed[] = [
  {
    name: "math",
    label: "Mathematics",
    topics: [
      "Algebra — linear equations",
      "Algebra — quadratics & factoring",
      "Geometry — triangles & circles",
      "Trigonometry — sine, cosine, tangent",
      "Calculus — derivatives",
      "Calculus — integrals",
      "Probability — counting & combinatorics",
      "Statistics — mean, median, variance",
      "Number theory — primes & divisibility",
      "Linear algebra — vectors & matrices",
    ],
  },
  {
    name: "physics",
    label: "Physics",
    topics: [
      "Kinematics — motion in 1D",
      "Newton's laws of motion",
      "Energy & work",
      "Momentum & collisions",
      "Circular motion & gravitation",
      "Electrostatics — Coulomb's law",
      "Circuits — Ohm's law & Kirchhoff's laws",
      "Waves & sound",
      "Optics — reflection & refraction",
      "Thermodynamics — heat & temperature",
    ],
  },
  {
    name: "chemistry",
    label: "Chemistry",
    topics: [
      "Atomic structure",
      "Periodic table trends",
      "Chemical bonding — ionic & covalent",
      "Stoichiometry — moles & mass",
      "Gas laws — PV=nRT",
      "Acids & bases — pH",
      "Thermochemistry — enthalpy",
      "Kinetics — reaction rates",
      "Equilibrium — Le Chatelier",
      "Organic chemistry — functional groups",
    ],
  },
  {
    name: "programming",
    label: "Programming",
    topics: [
      "Variables & data types",
      "Control flow — conditionals & loops",
      "Functions & recursion",
      "Arrays & strings",
      "Objects & classes",
      "Pointers & memory (C/C++)",
      "Linked lists",
      "Trees & binary search",
      "Sorting algorithms",
      "Big-O complexity",
    ],
  },
  {
    name: "languages",
    label: "Languages",
    topics: [
      "Spanish — present tense verbs",
      "Spanish — ser vs estar",
      "French — gender & articles",
      "French — passé composé",
      "Mandarin — pinyin & tones",
      "Mandarin — common radicals",
      "Japanese — hiragana & katakana",
      "Japanese — basic kanji",
      "German — cases (nominativ/akkusativ/dativ)",
      "Latin — declensions",
    ],
  },
  {
    name: "general",
    label: "General Studies",
    topics: [
      "Critical thinking & logic",
      "Essay structure & argumentation",
      "Reading comprehension",
      "Note-taking & study skills",
      "Research & citation",
      "Public speaking",
      "Time management",
      "Test-taking strategies",
      "Financial literacy basics",
      "Media literacy",
    ],
  },
];

/**
 * Validate that every seed row has the required shape. Used by the test
 * suite and by the seed runner's pre-flight check so we never write a
 * malformed subject to the DB.
 */
export function validateSeed(seed: SubjectSeed): string[] {
  const errors: string[] = [];
  if (!seed.name || typeof seed.name !== "string") {
    errors.push("name must be a non-empty string");
  }
  if (!seed.label || typeof seed.label !== "string") {
    errors.push("label must be a non-empty string");
  }
  if (!Array.isArray(seed.topics) || seed.topics.length === 0) {
    errors.push("topics must be a non-empty array");
  } else {
    seed.topics.forEach((t, i) => {
      if (typeof t !== "string" || !t.trim()) {
        errors.push(`topics[${i}] must be a non-empty string`);
      }
    });
  }
  return errors;
}

export function validateAllSeeds(seeds: SubjectSeed[]): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  seeds.forEach((s, i) => {
    const e = validateSeed(s);
    if (e.length) errors.push(`subject[${i}] (${s.name ?? "?"}): ${e.join("; ")}`);
    if (names.has(s.name)) errors.push(`subject[${i}]: duplicate name "${s.name}"`);
    names.add(s.name);
  });
  return errors;
}

/** Serialize topics for the `Subject.topics` JSON column. */
export function serializeTopics(topics: string[]): string {
  return JSON.stringify(topics);
}

/** Parse the `Subject.topics` JSON column back into an array. */
export function parseTopics(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === "string");
    }
  } catch {
    // fall through
  }
  return [];
}
