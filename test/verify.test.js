import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSentence, checkDraft, goalCoverage } from '../public/lib/verify.js';
import { CASES } from '../public/lib/cases.js';

const J = `0800 BS 212, pt checked self w/ glucometer. Took own metformin, I watched. L foot dressing CDI.
1400 BS 168. Pt says cough better.`;

const codes = (text, source) => checkSentence({ text, source }, J).map(f => f.code);

test('a faithful sentence has no flags', () => {
  assert.deepEqual(codes('At 0800, client checked own blood sugar: 212.', '0800 BS 212, pt checked self w/ glucometer'), []);
});

test('flags a source that is not in the jottings', () => {
  assert.deepEqual(codes('Client walked 2 laps.', 'walked 2 laps'), ['source-not-found']);
  assert.deepEqual(codes('Client is fine.', ''), ['no-source']);
});

test('flags a changed number', () => {
  assert.ok(codes('At 1400, blood sugar 186.', '1400 BS 168').includes('number'));
});

test('flags a number taken from a different part of the jottings', () => {
  assert.ok(codes('At 1400, blood sugar 212.', '1400 BS 168').includes('number'));
});

test('flags judgment words the staff member did not write', () => {
  assert.ok(codes('Blood sugar 168, stable.', '1400 BS 168').includes('judgment'));
  assert.ok(codes('Client reports cough is improving.', 'Pt says cough better').includes('judgment'));
});

test('allows judgment words that come from the staff member\'s own shorthand', () => {
  assert.deepEqual(codes('Left foot dressing clean, dry and intact.', 'L foot dressing CDI'), []);
});

test('flags staff giving medication', () => {
  assert.ok(codes('Staff administered metformin.', 'Took own metformin, I watched').includes('scope'));
  assert.ok(codes('Gave metformin.', 'Took own metformin, I watched').includes('scope'));
  assert.ok(!codes('Client self-administered metformin; staff watched.', 'Took own metformin, I watched').includes('scope'));
});

test('flags claims that staff saw something when the source does not say so', () => {
  assert.ok(codes('Client took own metformin, observed by staff.', 'Took own metformin').includes('witness'));
  assert.ok(!codes('Client took own metformin; staff observed.', 'Took own metformin, I watched').includes('witness'));
});

test('every demo draft: the checker flags exactly the planted mistakes', () => {
  for (const c of CASES) {
    const r = checkDraft(c.demoDraft, c.jottings, c.goals);
    assert.equal(r.flagged, c.demoDraft.planted, c.id);
  }
});

test('unknown goal ids are dropped, coverage counts kept lines', () => {
  const c = CASES[0];
  const r = checkDraft({ sentences: [{ section: 'Data', text: 'x', source: '0800', goal_ids: ['G1', 'G99'] }] }, c.jottings, c.goals);
  assert.deepEqual(r.sentences[0].goal_ids, ['G1']);
  const cov = goalCoverage(c.goals, r.sentences);
  assert.equal(cov.find(g => g.id === 'G1').evidence.length, 1);
  assert.equal(cov.find(g => g.id === 'G2').evidence.length, 0);
});
