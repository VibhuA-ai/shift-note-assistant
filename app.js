import { CASES, NOTE_FORMAT } from './lib/cases.js';
import { scan } from './lib/guard.js';
import { checkDraft, checkSentence, goalCoverage, norm } from './lib/verify.js';

const app = document.getElementById('app');
const modeEl = document.getElementById('mode');

const state = {
  screen: 'home',
  live: false,
  model: null,
  caseId: null,
  jottings: '',
  confirmNames: false,
  draft: null,
  isDemo: false,
  selfCheck: true,
  revealed: false,
  activeId: null,
  attested: false,
  loading: false,
  error: null,
  copied: false,
};

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const currentCase = () => CASES.find(c => c.id === state.caseId);
const isSample = () => currentCase() && state.jottings.trim() === currentCase().jottings.trim();
const words = s => (String(s).trim().match(/\S+/g) || []).length;

function go(screen) {
  state.screen = screen;
  state.error = null;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  app.focus({ preventScroll: true });
}

function highlightJottings(jottings, source, extra = []) {
  // Mark the active source span, plus guard findings, inside the jottings text.
  const ranges = [];
  if (norm(source)) {
    // Match ignoring case and differences in spaces or line breaks.
    const pattern = norm(source).split(' ').map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const m = new RegExp(pattern, 'i').exec(jottings);
    if (m) ranges.push({ start: m.index, end: m.index + m[0].length, cls: 'src' });
  }
  for (const f of extra) ranges.push({ start: f.index, end: f.index + f.match.length, cls: f.level });
  ranges.sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    out += esc(jottings.slice(pos, r.start)) + `<mark class="${r.cls}">${esc(jottings.slice(r.start, r.end))}</mark>`;
    pos = r.end;
  }
  return out + esc(jottings.slice(pos));
}

// ---------- screens ----------
function renderHome() {
  return `
  <section class="hero">
    <h1>See what AI can do for your end-of-shift notes.</h1>
    <p class="lede">Pick a made-up client. Type the shorthand you'd scribble on rounds. Watch it turn into a draft note, then check every line yourself. About two minutes.</p>
    <button class="btn primary big" data-action="start">Start a practice round</button>
    <p class="small muted">No account. Nothing saved. Close the tab and it's gone.</p>
  </section>

  <section class="worries" aria-labelledby="wq">
    <h2 id="wq">Fair questions, straight answers</h2>
    <div class="cards three">
      <article class="card">
        <h3>"Will a client's information end up somewhere it shouldn't?"</h3>
        <p>Not here. Practice Round uses made-up clients only, and it <strong>blocks names, birth dates, phone numbers, addresses and record numbers</strong> before anything is sent. Nothing is stored.</p>
        <p class="muted small">For real clients, use only the tools IHH has approved. Ask your supervisor which ones.</p>
      </article>
      <article class="card">
        <h3>"Will it put words in my name that didn't happen?"</h3>
        <p>It can try. AI makes things up. So every sentence shows <strong>the exact words of yours it came from</strong>, and a checker flags changed numbers, judgments you didn't write ("stable", "intact"), and any line saying staff gave a medication.</p>
        <p class="muted small">Nothing goes in your note until you keep it.</p>
      </article>
      <article class="card">
        <h3>"Is this the first step to needing fewer staff?"</h3>
        <p>This tool can't answer that, and won't pretend to. What it does is narrow: it turns your shorthand into sentences. It can't do rounds, see a wound, notice a client is off, or teach someone a glucometer.</p>
        <p class="muted small">It's a fair question to ask leadership directly.</p>
      </article>
    </div>
  </section>

  <section class="how">
    <h2>What happens in a round</h2>
    <ol class="how-list">
      <li><strong>Pick a client.</strong> Three made-up clients, each with care plan goals.</li>
      <li><strong>Jot.</strong> Sample shorthand is filled in. Change it or write your own.</li>
      <li><strong>Check.</strong> Try to spot the AI's mistakes first, then see what the checker found.</li>
      <li><strong>Keep.</strong> Only the lines you kept make the note, sorted into ${esc(NOTE_FORMAT.sections.map(s => s.label).join(', '))}.</li>
    </ol>
  </section>`;
}

function renderPick() {
  return `
  <h1>Pick a practice client</h1>
  <p class="lede">All made up. They go by bed number only.</p>
  <div class="cards three">
    ${CASES.map(c => `
      <button class="card client" data-action="pick" data-id="${c.id}">
        <span class="bed">${esc(c.bed)}</span>
        <span class="summary">${esc(c.summary)}</span>
        <span class="goals-mini">${c.goals.length} care plan goals</span>
        <span class="go">Start →</span>
      </button>`).join('')}
  </div>`;
}

function renderGoals(c) {
  return `<ul class="goals">${c.goals.map(g => `<li><span class="gid">${g.id}</span> ${esc(g.text)}</li>`).join('')}</ul>`;
}

function renderJot() {
  const c = currentCase();
  const guard = scan(state.jottings);
  const demoLocked = !state.live && !isSample();
  const hasWarn = guard.warnings.length > 0;
  const canDraft = state.jottings.trim() && !guard.blocked && (!hasWarn || state.confirmNames) && !demoLocked && !state.loading;

  let guardHtml;
  if (guard.blocked) {
    guardHtml = `<div class="guard block" role="alert">
      <strong>Not sent. This looks like real identifying information:</strong>
      <ul>${guard.findings.filter(f => f.level === 'block').map(f => `<li>${esc(f.kind)}: <code>${esc(f.match)}</code></li>`).join('')}</ul>
      Remove it to continue. Practice clients go by bed number only.</div>`;
  } else if (hasWarn) {
    guardHtml = `<div class="guard warn" role="status">
      <strong>These might be names:</strong> ${guard.warnings.map(f => `<code>${esc(f.match)}</code>`).join(', ')}
      <label class="check"><input type="checkbox" data-action="confirm-names" ${state.confirmNames ? 'checked' : ''}> These are not real people's names</label></div>`;
  } else {
    guardHtml = `<div class="guard ok" role="status">✓ No names, dates of birth, phone numbers, addresses or record numbers found.</div>`;
  }

  return `
  <div class="crumb"><button class="link" data-action="back-pick">← Clients</button></div>
  <h1>${esc(c.bed)}: your jottings</h1>
  <p class="lede">This is the shorthand you'd write on paper during rounds. Sample jottings are filled in. Change anything, or clear it and write your own made-up shift.</p>
  <div class="split">
    <div>
      <label for="jot" class="label">Jottings for ${esc(c.bed)}</label>
      <textarea id="jot" data-action="jot" rows="9" spellcheck="false" maxlength="2500">${esc(state.jottings)}</textarea>
      <div class="row between small">
        <span class="muted">${words(state.jottings)} words</span>
        ${isSample() ? '' : '<button class="link" data-action="reset-sample">Put the sample back</button>'}
      </div>
      <div id="guard">${guardHtml}</div>
      ${demoLocked ? `<div class="guard info">Demo mode drafts the sample jottings only. To draft your own words, run Practice Round with an API key (see the README). <button class="link" data-action="reset-sample">Use the sample</button></div>` : ''}
      ${state.error ? `<div class="guard block" role="alert">${esc(state.error)}</div>` : ''}
      <button class="btn primary big" data-action="draft" ${canDraft ? '' : 'disabled'}>
        ${state.loading ? '<span class="spinner" aria-hidden="true"></span> Drafting… usually under 20 seconds' : 'Draft my note'}
      </button>
    </div>
    <aside class="panel">
      <h2 class="h3">${esc(c.summary)}</h2>
      <p class="small muted">Care plan goals. Your note is the evidence for these when the health plan reviews the stay.</p>
      ${renderGoals(c)}
    </aside>
  </div>`;
}

function sentenceCard(s) {
  const showFlags = state.revealed;
  const flagged = s.flags.length > 0;
  const cls = [
    'sentence',
    showFlags && flagged ? 'flagged' : '',
    showFlags && !flagged ? 'clean' : '',
    s.status === 'remove' ? 'removed' : '',
    s.userMarked ? 'marked' : '',
    state.activeId === s.id ? 'active' : '',
  ].join(' ');

  const textHtml = s.editing
    ? `<textarea class="edit" data-action="edit-text" data-id="${s.id}" rows="2">${esc(s.text)}</textarea>
       <div class="row"><button class="btn small primary" data-action="save-edit" data-id="${s.id}">Save</button>
       <button class="btn small" data-action="cancel-edit" data-id="${s.id}">Cancel</button></div>`
    : `<p class="stext">${esc(s.text)}${s.edited ? ' <span class="tag">edited</span>' : ''}</p>`;

  let actions;
  if (!state.revealed) {
    actions = `<button class="btn small ${s.userMarked ? 'warnbtn on' : ''}" data-action="mark" data-id="${s.id}" aria-pressed="${s.userMarked}">${s.userMarked ? '⚑ Marked as wrong' : 'Looks wrong?'}</button>`;
  } else if (!s.editing) {
    actions = `
      <div class="seg" role="group" aria-label="Decision">
        <button class="btn small ${s.status === 'keep' ? 'on keep' : ''}" data-action="keep" data-id="${s.id}" aria-pressed="${s.status === 'keep'}">Keep</button>
        <button class="btn small" data-action="edit" data-id="${s.id}">Edit</button>
        <button class="btn small ${s.status === 'remove' ? 'on remove' : ''}" data-action="remove" data-id="${s.id}" aria-pressed="${s.status === 'remove'}">Remove</button>
      </div>
      ${s.status === 'pending' ? '<span class="needs">Needs your decision</span>' : ''}`;
  } else actions = '';

  return `
  <li class="${cls}" data-id="${s.id}" tabindex="0">
    <div class="row between"><span class="chip ${s.section.toLowerCase()}">${esc(s.section)}</span>
      ${s.goal_ids.length ? `<span class="small muted">supports ${s.goal_ids.map(esc).join(', ')}</span>` : ''}</div>
    ${textHtml}
    <p class="source"><span class="muted">From your jottings:</span> “${esc(s.source || '— nothing —')}”</p>
    ${showFlags && flagged ? `<ul class="flags">${s.flags.map(f => `<li class="${f.severity}">${esc(f.message)}</li>`).join('')}</ul>` : ''}
    ${showFlags && !flagged && s.userMarked ? `<ul class="flags"><li class="medium">The checker didn't flag this, but you did. Trust your eyes: you were there.</li></ul>` : ''}
    ${showFlags && !flagged && !s.userMarked ? `<p class="okline small">✓ Matches your jottings. Still yours to check.</p>` : ''}
    <div class="row actions">${actions}</div>
  </li>`;
}

function renderReview() {
  const c = currentCase();
  const d = state.draft;
  const active = d.sentences.find(s => s.id === state.activeId);
  const pending = d.sentences.filter(s => s.status === 'pending').length;
  const kept = d.sentences.filter(s => s.status === 'keep');
  const coverage = goalCoverage(c.goals, kept);
  const checkerFlagged = d.sentences.filter(s => s.flags.length);
  const caught = checkerFlagged.filter(s => s.userMarked).length;
  const extraMarks = d.sentences.filter(s => s.userMarked && !s.flags.length).length;

  let bar = '';
  if (!state.revealed) {
    bar = `<div class="callout">
      <strong>Your turn first.</strong> AI makes mistakes. Read each line against your jottings and tap <em>Looks wrong?</em> on anything that doesn't match what happened.
      <div class="row"><button class="btn primary" data-action="reveal">Show what the checker found</button>
      <button class="link" data-action="reveal">Skip</button></div></div>`;
  } else {
    const msg = checkerFlagged.length === 0
      ? 'The checker found nothing to flag. That is not proof it is right. You are the one who knows what happened.'
      : `The checker flagged <strong>${checkerFlagged.length}</strong> ${checkerFlagged.length === 1 ? 'line' : 'lines'}.` +
        (d.sentences.some(s => s.userMarked) ? ` You spotted <strong>${caught}</strong> of them.` : '') +
        (extraMarks ? ` You also marked ${extraMarks} the checker missed. Your call wins.` : '') +
        ' Decide what to do with each flagged line.';
    bar = `<div class="callout ${checkerFlagged.length ? 'amber' : 'green'}">${msg}</div>`;
  }

  return `
  <div class="crumb"><button class="link" data-action="back-jot">← Jottings</button></div>
  <h1>Check the draft</h1>
  ${state.isDemo ? `<p class="demo-note">Demo mode: this is a saved example draft. ${c.demoDraft.planted} mistake${c.demoDraft.planted === 1 ? ' was' : 's were'} left in on purpose so you can see the checker work.</p>`
                 : `<p class="demo-note live">Drafted just now by Claude (${esc(state.model || '')}). It may contain mistakes. That's why you check.</p>`}
  ${bar}
  <div class="split wide">
    <ol class="sentences">${d.sentences.map(sentenceCard).join('')}</ol>
    <aside class="side">
      <div class="panel">
        <h2 class="h3">Your jottings</h2>
        <p class="small muted">${active ? 'Highlighted: where the selected line came from.' : 'Tap a line to see where it came from.'}</p>
        <pre class="jottings">${highlightJottings(state.jottings, active?.source)}</pre>
      </div>
      ${d.questions.length ? `<div class="panel"><h2 class="h3">Before you sign</h2><ul class="qs">${d.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
      <div class="panel">
        <h2 class="h3">Care plan goals</h2>
        <ul class="goals cover">${coverage.map(g => `<li class="${g.evidence.length ? 'has' : 'none'}"><span class="gid">${g.id}</span> ${esc(g.text)}
          <span class="small ${g.evidence.length ? 'ok' : 'muted'}">${g.evidence.length ? `✓ ${g.evidence.length} line${g.evidence.length > 1 ? 's' : ''} in your note` : 'Nothing in today\'s note. If it happened, add it to your jottings. If it didn\'t, leave it out.'}</span></li>`).join('')}</ul>
      </div>
    </aside>
  </div>
  <div class="stickybar">
    ${state.revealed
      ? `<span>${pending ? `<strong>${pending}</strong> line${pending > 1 ? 's' : ''} still need${pending > 1 ? '' : 's'} your decision` : `${kept.length} lines kept`}</span>
         <button class="btn primary" data-action="build" ${pending ? 'disabled' : ''}>Build my note →</button>`
      : `<span>${d.sentences.filter(s => s.userMarked).length} marked</span><button class="btn primary" data-action="reveal">Show what the checker found</button>`}
  </div>`;
}

function noteText() {
  const c = currentCase();
  const kept = state.draft.sentences.filter(s => s.status === 'keep');
  const parts = NOTE_FORMAT.sections.map(sec => {
    const lines = kept.filter(s => s.section === sec.id).map(s => s.text);
    return lines.length ? `${sec.label}: ${lines.join(' ')}` : null;
  }).filter(Boolean);
  return `PRACTICE NOTE: ${c.bed} (made-up client)\n\n${parts.join('\n\n')}`;
}

function renderNote() {
  const c = currentCase();
  const d = state.draft;
  const kept = d.sentences.filter(s => s.status === 'keep');
  const removed = d.sentences.filter(s => s.status === 'remove').length;
  const edited = d.sentences.filter(s => s.edited && s.status === 'keep').length;
  const coverage = goalCoverage(c.goals, kept);
  return `
  <div class="crumb"><button class="link" data-action="back-review">← Back to the draft</button></div>
  <h1>Your note</h1>
  <p class="lede">Only the lines you kept, in the ${esc(NOTE_FORMAT.name)} order.</p>
  <div class="split">
    <div>
      <pre class="note" aria-label="Final practice note">${esc(noteText())}</pre>
      <label class="check big"><input type="checkbox" data-action="attest" ${state.attested ? 'checked' : ''}> I read every line, and it matches what happened on this (practice) shift.</label>
      <div class="row">
        <button class="btn primary" data-action="copy" ${state.attested ? '' : 'disabled'}>${state.copied ? '✓ Copied' : 'Copy note'}</button>
        <button class="btn" data-action="another">Try another client</button>
      </div>
    </div>
    <aside class="panel">
      <h2 class="h3">What just happened</h2>
      <ul class="tally">
        <li><strong>${words(state.jottings)}</strong> words of your shorthand</li>
        <li><strong>${kept.length}</strong> sentences kept${edited ? `, ${edited} edited by you` : ''}</li>
        <li><strong>${removed}</strong> removed</li>
        <li><strong>${coverage.filter(g => g.evidence.length).length} of ${coverage.length}</strong> care plan goals have evidence</li>
      </ul>
      <p class="small">The AI did the typing. You did the judging. That split is the whole idea.</p>
      <p class="small muted">Nothing here was saved. When you leave this page, it's gone.</p>
    </aside>
  </div>`;
}

function renderSteps() {
  const order = ['pick', 'jot', 'review', 'note'];
  const idx = order.indexOf(state.screen);
  document.getElementById('steps').hidden = state.screen === 'home';
  document.querySelectorAll('#steps li').forEach((li, i) => {
    li.className = i < idx ? 'done' : i === idx ? 'current' : '';
    if (i === idx) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
}

function render() {
  renderSteps();
  const screens = { home: renderHome, pick: renderPick, jot: renderJot, review: renderReview, note: renderNote };
  app.innerHTML = screens[state.screen]();
}

// Re-render just the guard and button while typing, so the textarea keeps focus.
function refreshJot() {
  const ta = document.getElementById('jot');
  const pos = ta ? [ta.selectionStart, ta.selectionEnd] : null;
  render();
  const again = document.getElementById('jot');
  if (again && pos) { again.focus(); again.setSelectionRange(pos[0], pos[1]); }
}

// ---------- drafting ----------
function loadDraft(raw, isDemo) {
  const c = currentCase();
  const checked = checkDraft(raw, state.jottings, c.goals);
  state.draft = {
    questions: checked.questions,
    sentences: checked.sentences.map(s => ({ ...s, status: s.flags.length ? 'pending' : 'keep', userMarked: false, editing: false, edited: false })),
  };
  state.isDemo = isDemo;
  state.revealed = !state.selfCheck;
  state.activeId = null;
  state.attested = false;
  state.copied = false;
}

async function draft() {
  const c = currentCase();
  state.error = null;
  if (!state.live) {
    loadDraft(c.demoDraft, true);
    return go('review');
  }
  state.loading = true;
  render();
  try {
    const r = await fetch('api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: c.id, jottings: state.jottings, confirmedNoNames: state.confirmNames }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Something went wrong (${r.status}).`);
    state.model = data.model;
    loadDraft(data.draft, false);
    state.loading = false;
    go('review');
  } catch (e) {
    state.loading = false;
    state.error = `${e.message}${isSample() ? ' You can still try the saved demo draft.' : ''}`;
    render();
    if (isSample()) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = 'Use the saved demo draft';
      b.onclick = () => { loadDraft(c.demoDraft, true); go('review'); };
      app.querySelector('.guard.block[role="alert"]:last-of-type')?.appendChild(b);
    }
  }
}

// ---------- events ----------
const byId = id => state.draft?.sentences.find(s => s.id === id);

app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  const card = e.target.closest('.sentence');
  if (card && state.screen === 'review' && !e.target.closest('textarea')) {
    if (state.activeId !== card.dataset.id) { state.activeId = card.dataset.id; if (!el) return render(); }
  }
  if (!el) return;
  const { action, id } = el.dataset;
  const s = id ? byId(id) : null;
  switch (action) {
    case 'start': return go('pick');
    case 'pick': {
      state.caseId = id;
      state.jottings = currentCase().jottings;
      state.confirmNames = false;
      state.draft = null;
      return go('jot');
    }
    case 'back-pick': return go('pick');
    case 'back-jot': return go('jot');
    case 'back-review': return go('review');
    case 'reset-sample': state.jottings = currentCase().jottings; state.confirmNames = false; return render();
    case 'draft': return draft();
    case 'mark': s.userMarked = !s.userMarked; if (s.userMarked) s.status = 'pending'; else if (!s.flags.length) s.status = 'keep'; return render();
    case 'reveal': state.revealed = true; return render();
    case 'keep': s.status = 'keep'; return render();
    case 'remove': s.status = 'remove'; return render();
    case 'edit': s.editing = true; s._before = s.text; state.activeId = s.id; render(); app.querySelector(`textarea[data-id="${id}"]`)?.focus(); return;
    case 'cancel-edit': s.text = s._before; s.editing = false; return render();
    case 'save-edit': {
      const ta = app.querySelector(`textarea[data-id="${id}"]`);
      s.text = ta.value.trim();
      s.editing = false;
      s.edited = s.text !== s._before;
      s.flags = checkSentence(s, state.jottings); // the checker runs again on your edit
      const guard = scan(s.text);
      if (guard.blocked) s.flags.push({ code: 'privacy', severity: 'high', message: 'Your edit looks like it contains identifying information. Remove it.' });
      s.status = s.flags.length ? 'pending' : 'keep';
      return render();
    }
    case 'build': state.attested = false; state.copied = false; return go('note');
    case 'copy':
      navigator.clipboard?.writeText(noteText()).then(() => { state.copied = true; render(); }, () => { state.error = 'Copy failed. Select the text and copy it.'; render(); });
      return;
    case 'another': state.caseId = null; state.draft = null; return go('pick');
  }
});

app.addEventListener('change', e => {
  const a = e.target.dataset.action;
  if (a === 'confirm-names') { state.confirmNames = e.target.checked; refreshJot(); }
  if (a === 'attest') { state.attested = e.target.checked; render(); }
});

app.addEventListener('input', e => {
  if (e.target.dataset.action === 'jot') {
    state.jottings = e.target.value;
    state.confirmNames = false;
    clearTimeout(refreshJot.t);
    refreshJot.t = setTimeout(refreshJot, 250);
  }
});

app.addEventListener('keydown', e => {
  // Keep/remove from the keyboard on a focused sentence once flags are visible.
  const card = e.target.closest?.('.sentence');
  if (!card || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); state.activeId = card.dataset.id; render(); app.querySelector(`.sentence[data-id="${card.dataset.id}"]`)?.focus(); }
});

document.querySelector('[data-go="home"]').addEventListener('click', e => { e.preventDefault(); go('home'); });

// ---------- start ----------
async function init() {
  try {
    const r = await fetch('api/status', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    const s = await r.json();
    state.live = Boolean(s.live);
    state.model = s.model;
  } catch { state.live = false; }
  modeEl.textContent = state.live ? 'Live AI' : 'Demo mode';
  modeEl.className = `mode ${state.live ? 'live' : 'demo'}`;
  modeEl.title = state.live
    ? `Drafts are written by Claude (${state.model}) and checked in your browser.`
    : 'No AI connection: the app uses saved example drafts. Everything else works the same.';
  render();
}
init();
