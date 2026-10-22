import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleDraft } from '../server/server.js';
import { CASES } from '../public/lib/cases.js';

const fakeClaude = (input, capture = {}) => async (url, init) => {
  capture.url = url;
  capture.body = JSON.parse(init.body);
  return { ok: true, json: async () => ({ content: [{ type: 'tool_use', name: 'draft_note', input }] }) };
};

test('rejects identifiers before calling Claude', async () => {
  let called = false;
  const [status, body] = await handleDraft(
    { caseId: 'bed-3', jottings: 'Mr. Alvarez BS 212, DOB 1/2/1960' },
    { apiKey: 'test', fetchImpl: async () => { called = true; } },
  );
  assert.equal(status, 422);
  assert.equal(called, false);
  assert.ok(body.findings.length >= 2);
  // The response names the kind of finding but does not echo blocked identifiers back.
  assert.ok(!JSON.stringify(body).includes('Alvarez'));
});

test('possible names need confirmation', async () => {
  const [status] = await handleDraft({ caseId: 'bed-3', jottings: 'Maria Lopez BS 212' }, { apiKey: 'test', fetchImpl: fakeClaude({ sentences: [], questions: [] }) });
  assert.equal(status, 422);
  const [ok] = await handleDraft({ caseId: 'bed-3', jottings: 'Maria Lopez BS 212', confirmedNoNames: true }, { apiKey: 'test', fetchImpl: fakeClaude({ sentences: [], questions: [] }) });
  assert.equal(ok, 200);
});

test('unknown client is refused', async () => {
  const [status] = await handleDraft({ caseId: 'real-person', jottings: 'BS 212' }, { apiKey: 'test' });
  assert.equal(status, 400);
});

test('without an API key, live drafting reports it is off', async () => {
  const [status] = await handleDraft({ caseId: 'bed-3', jottings: CASES[0].jottings }, { apiKey: '' });
  assert.equal(status, 503);
});

test('calls Claude with the draft tool forced and returns a cleaned draft', async () => {
  const capture = {};
  const [status, body] = await handleDraft(
    { caseId: 'bed-3', jottings: CASES[0].jottings },
    { apiKey: 'test', fetchImpl: fakeClaude({ sentences: [{ section: 'Weird', text: 'At 0800 BS 212.', source: '0800 BS 212', goal_ids: ['G1'] }], questions: ['q'] }, capture) },
  );
  assert.equal(status, 200);
  assert.equal(capture.body.tool_choice.name, 'draft_note');
  assert.match(capture.body.messages[0].content, /G1: Checks own blood sugar/);
  assert.equal(body.draft.sentences[0].section, 'Data');
  assert.deepEqual(body.draft.questions, ['q']);
});
