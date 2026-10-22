import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan } from '../public/lib/guard.js';
import { CASES } from '../public/lib/cases.js';

test('sample jottings pass the privacy guard with no findings', () => {
  for (const c of CASES) {
    const r = scan(c.jottings);
    assert.equal(r.blocked, false, c.id);
    assert.deepEqual(r.findings, [], c.id);
  }
});

test('blocks common identifiers', () => {
  const cases = {
    'Phone number': 'called pt sister at 714-555-0199',
    'Social Security number': 'ssn 123-45-6789',
    'Email address': 'emailed jdoe@example.com',
    'Full date': 'admitted 10/03/2026',
    'Date of birth': 'DOB on file',
    'Record or account number': 'MRN 00A4471',
    'Long ID number': 'member 9876543210',
    'Street address': 'lives near 1200 N Harbor Blvd',
    Name: 'Mr. Alvarez checked BS',
  };
  for (const [kind, text] of Object.entries(cases)) {
    const r = scan(text);
    assert.equal(r.blocked, true, `${kind}: ${text}`);
    assert.ok(r.findings.some(f => f.kind === kind), `${kind} not found in "${text}"`);
  }
});

test('does not block vital signs, times, pain scores or blood sugars', () => {
  const r = scan('0900 BP 138/84 HR 92 SpO2 93% RA. Pain 6/10. BS 212. walked x2, rested 5 min');
  assert.equal(r.blocked, false);
});

test('warns on possible names, not on ordinary capitalised jotting words', () => {
  assert.equal(scan('Called Home Health, LM').warnings.length, 0);
  const r = scan('Maria Lopez visited today');
  assert.equal(r.blocked, false);
  assert.equal(r.warnings.length, 1);
  assert.equal(r.warnings[0].match, 'Maria Lopez');
});
