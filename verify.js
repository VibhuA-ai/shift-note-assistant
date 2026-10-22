// The checker. Plain rules, no AI. It looks at each drafted sentence and the words the
// staff member wrote, and flags anything the jottings do not back up.
//
// A flag means "a person should look at this", not "this is wrong". A clean sentence is
// not proof it is right either: the checker cannot know what happened on the shift.

const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

const numbersIn = s => (String(s || '').match(/\d+(?:\.\d+)?/g) || []);

// Words that state a clinical judgment or a result. Fine if the staff member wrote them,
// a problem if the AI added them.
const JUDGMENT_TERMS = [
  'within normal limits', 'verbalized understanding', 'verbalizes understanding', 'no distress',
  'no complaints', 'doing well', 'tolerated well',
  'stable', 'unremarkable', 'improving', 'improved', 'improvement', 'worsening', 'worsened',
  'normal', 'wnl', 'tolerated', 'tolerating', 'intact', 'clean', 'dry', 'healing', 'healed',
  'infected', 'infection', 'compliant', 'noncompliant', 'non-compliant', 'adherent',
  'nonadherent', 'non-adherent', 'understood', 'understands', 'appropriate', 'appropriately',
  'adequate', 'independent', 'independently', 'alert', 'oriented', 'resolved',
];

// Shorthand that legitimately expands into some of those words.
const ABBREVIATIONS = {
  cdi: ['clean', 'dry', 'intact'],
  'c/d/i': ['clean', 'dry', 'intact'],
  wnl: ['normal', 'within normal limits'],
  indep: ['independent', 'independently'],
  aox4: ['alert', 'oriented'],
  aaox4: ['alert', 'oriented'],
  'a&o': ['alert', 'oriented'],
};

// Words that say staff saw something happen.
const WITNESS_TERMS = ['observed', 'witnessed', 'watched', 'saw', 'seen', 'verified', 'visualized'];

// In recuperative care clients take their own medications. Staff do not give them.
const SCOPE_RE = /\b(?<!self[- ])(administer(?:ed|s|ing)?|gave|given|injected|dosed|medicated)\b/i;

function hasTerm(text, term) {
  const t = norm(text);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i').test(t);
}

function termCoveredBySource(term, source) {
  if (hasTerm(source, term)) return true;
  for (const [abbr, expands] of Object.entries(ABBREVIATIONS)) {
    if (expands.includes(term) && hasTerm(source, abbr)) return true;
  }
  return false;
}

function checkSentence(sentence, jottings) {
  const text = sentence.text || '';
  const source = sentence.source || '';
  const flags = [];

  // 1. The quoted source must really be in the jottings.
  if (!norm(source)) {
    flags.push({ code: 'no-source', severity: 'high', message: 'No source. Nothing in your jottings was linked to this sentence.' });
  } else if (!norm(jottings).includes(norm(source))) {
    flags.push({ code: 'source-not-found', severity: 'high', message: `The AI said this came from "${source}", but those words are not in your jottings.` });
  }

  // 2. Every number in the sentence must appear in its source.
  const srcNums = new Set(numbersIn(source));
  const missingNums = [...new Set(numbersIn(text))].filter(n => !srcNums.has(n));
  if (missingNums.length) {
    flags.push({ code: 'number', severity: 'high', message: `Number not in your jottings for this line: ${missingNums.join(', ')}. Check it against what you wrote.` });
  }

  // 3. Judgment words the staff member did not write.
  const addedJudgment = JUDGMENT_TERMS.filter(t => hasTerm(text, t) && !termCoveredBySource(t, source));
  // Drop single words already covered by a phrase match ("tolerated" inside "tolerated well").
  const judgment = addedJudgment.filter(t => !addedJudgment.some(o => o !== t && o.includes(t)));
  if (judgment.length) {
    flags.push({ code: 'judgment', severity: 'medium', message: `Adds a judgment you did not write: "${judgment.join('", "')}". Only keep it if you actually saw this.` });
  }

  // 4. Says staff saw something the source does not say staff saw.
  const witnessInText = WITNESS_TERMS.filter(t => hasTerm(text, t));
  const witnessInSource = WITNESS_TERMS.some(t => hasTerm(source, t));
  if (witnessInText.length && !witnessInSource) {
    flags.push({ code: 'witness', severity: 'high', message: `Says staff ${witnessInText[0]} it, but your jottings for this line don't say you saw it.` });
  }

  // 5. Scope: staff giving medications.
  const scope = text.match(SCOPE_RE);
  if (scope) {
    flags.push({ code: 'scope', severity: 'high', message: `Says "${scope[1]}". In recuperative care the client takes their own medication. Reword so it says what the client did and what you saw.` });
  }

  return flags;
}

function checkDraft(draft, jottings, goals = []) {
  const sentences = (draft.sentences || []).map((s, i) => ({
    ...s,
    id: s.id || `s${i + 1}`,
    goal_ids: (s.goal_ids || []).filter(g => goals.some(goal => goal.id === g)),
    flags: checkSentence(s, jottings),
  }));
  const flagged = sentences.filter(s => s.flags.length).length;
  return { sentences, questions: draft.questions || [], flagged };
}

function goalCoverage(goals, sentences) {
  return goals.map(g => ({
    ...g,
    evidence: sentences.filter(s => (s.goal_ids || []).includes(g.id)),
  }));
}

export { checkSentence, checkDraft, goalCoverage, norm, numbersIn, JUDGMENT_TERMS };
