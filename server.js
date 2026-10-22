// Practice Round server. No dependencies: Node 18+ only.
//   - Serves the web app from /public
//   - POST /api/draft asks Claude for a draft note (needs ANTHROPIC_API_KEY)
//   - Nothing is stored. No database, no logs of jottings or notes.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../public/lib/guard.js';
import { CASES, NOTE_FORMAT } from '../public/lib/cases.js';
import { systemPrompt, userPrompt, DRAFT_TOOL } from './prompt.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

// Minimal .env loader so non-developers can put the key in a file.
const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const MAX_JOTTINGS = 2500;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

async function readBody(req, limit = 20000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export async function draftWithClaude(caseData, jottings, { apiKey = process.env.ANTHROPIC_API_KEY, fetchImpl = fetch } = {}) {
  const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt(NOTE_FORMAT),
      tools: [DRAFT_TOOL],
      tool_choice: { type: 'tool', name: 'draft_note' },
      messages: [{ role: 'user', content: userPrompt(caseData, jottings) }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw Object.assign(new Error(`Claude API error ${r.status}`), { status: 502, detail: detail.slice(0, 300) });
  }
  const data = await r.json();
  const call = (data.content || []).find(b => b.type === 'tool_use' && b.name === 'draft_note');
  if (!call) throw Object.assign(new Error('Claude did not return a draft'), { status: 502 });
  const sentences = Array.isArray(call.input.sentences) ? call.input.sentences : [];
  return {
    sentences: sentences.map(s => ({
      section: ['Data', 'Action', 'Response'].includes(s.section) ? s.section : 'Data',
      text: String(s.text || ''),
      source: String(s.source || ''),
      goal_ids: Array.isArray(s.goal_ids) ? s.goal_ids.map(String) : [],
    })),
    questions: Array.isArray(call.input.questions) ? call.input.questions.map(String) : [],
  };
}

export async function handleDraft(body, opts = {}) {
  const caseData = CASES.find(c => c.id === body.caseId);
  if (!caseData) return [400, { error: 'Pick one of the practice clients.' }];
  const jottings = String(body.jottings || '');
  if (!jottings.trim()) return [400, { error: 'Write a few jottings first.' }];
  if (jottings.length > MAX_JOTTINGS) return [400, { error: `Keep jottings under ${MAX_JOTTINGS} characters.` }];

  // The browser already checked this. Check again here in case it was skipped.
  const guard = scan(jottings);
  if (guard.blocked) {
    return [422, { error: 'This looks like it contains real identifying information, so it was not sent.', findings: guard.findings.filter(f => f.level === 'block').map(f => ({ kind: f.kind })) }];
  }
  if (guard.warnings.length && !body.confirmedNoNames) {
    return [422, { error: 'Possible names found. Confirm they are made up before sending.', findings: guard.warnings.map(f => ({ kind: f.kind, match: f.match })) }];
  }
  if (!(opts.apiKey ?? process.env.ANTHROPIC_API_KEY)) {
    return [503, { error: 'Live drafting is off: no ANTHROPIC_API_KEY on the server. Demo drafts still work.' }];
  }
  const draft = await draftWithClaude(caseData, jottings, opts);
  return [200, { draft, model: MODEL }];
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/status' && req.method === 'GET') {
      return send(res, 200, { live: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
    }
    if (url.pathname === '/api/draft' && req.method === 'POST') {
      const body = await readBody(req);
      const [status, payload] = await handleDraft(body);
      return send(res, status, payload);
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

    let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
    if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'Forbidden' });
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    const content = await readFile(file).catch(() => null);
    if (!content) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, content, TYPES[path.extname(file)] || 'application/octet-stream');
  } catch (err) {
    // Log the error type only. Never log jottings or drafts.
    console.error(`[practice-round] ${err.message}`);
    send(res, err.status || 500, { error: err.status === 502 ? 'The AI service had a problem. Try again, or use a demo draft.' : err.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`Practice Round running at http://localhost:${PORT}`);
    console.log(process.env.ANTHROPIC_API_KEY ? `Live drafting on (${MODEL}).` : 'No ANTHROPIC_API_KEY: demo drafts only.');
  });
}

export { server };
