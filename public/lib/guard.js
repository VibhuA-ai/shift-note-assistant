// Privacy guard. Runs in the browser before anything is sent, and again on the server.
// It looks for things that identify a person. "block" findings stop the draft.
// "warn" findings (possible names) need the user to confirm they are made up.
//
// This is a safety net, not a guarantee. It cannot recognise every name or identifier,
// which is why the tool is for made-up practice clients only.

const BLOCK_PATTERNS = [
  { kind: 'Phone number', re: /\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g },
  { kind: 'Social Security number', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'Email address', re: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
  { kind: 'Full date', re: /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g },
  { kind: 'Full date', re: /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi },
  { kind: 'Date of birth', re: /\b(?:DOB|D\.O\.B\.?|date of birth|birthday|born on)\b/gi },
  { kind: 'Record or account number', re: /\b(?:MRN|med(?:ical)? rec(?:ord)?|acct|account|member id|medi-?cal id|CIN|policy)\s*(?:#|no\.?|number)?\s*:?\s*[A-Z0-9-]{4,}/gi },
  { kind: 'Long ID number', re: /\b\d{7,}\b/g },
  { kind: 'Street address', re: /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane|Ct|Court|Pl|Place|Pkwy|Hwy)\b\.?/g },
  { kind: 'Name', re: /\b(?:Mr|Mrs|Ms|Miss|Mx)\.?\s+[A-Z][a-z'-]+/g },
  { kind: 'Name', re: /\b(?:name|pt name|client name|patient name)\s*[:=-]\s*\S+/gi },
];

// Capitalised words that are normal in shift jottings, so "Home Health" is not a name.
const ALLOW = new Set(`
bed room client pt patient home health clinic rn lvn ma md np pa er ed hospital pharmacy
monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun
january february march april june july august september october november december
took own taught called left right foot leg arm hand walked pain bs bp hr rr vs spo2 ra
ortho pulm cardio wound care plan goal am pm a1c copd chf dm htn the a an and or of to
metformin lisinopril insulin oxycodone tylenol ibuprofen albuterol inhaler glucometer
reminded saw used using says said asked incision dressing appt follow up new next week
`.trim().split(/\s+/));

function scan(text) {
  const findings = [];
  const seen = new Set();
  for (const { kind, re } of BLOCK_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const key = `${m.index}:${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ level: 'block', kind, match: m[0], index: m.index });
    }
  }
  // Possible names: two capitalised words in a row that are not ordinary jotting words.
  const pair = /\b([A-Z][a-z'-]{1,})\s+([A-Z][a-z'-]{1,})\b/g;
  let m;
  while ((m = pair.exec(text))) {
    const a = m[1].toLowerCase();
    const b = m[2].toLowerCase();
    if (ALLOW.has(a) || ALLOW.has(b)) continue;
    const overlapsBlock = findings.some(f => m.index >= f.index && m.index < f.index + f.match.length);
    if (overlapsBlock) continue;
    findings.push({ level: 'warn', kind: 'Possible name', match: m[0], index: m.index });
  }
  findings.sort((x, y) => x.index - y.index);
  return {
    findings,
    blocked: findings.some(f => f.level === 'block'),
    warnings: findings.filter(f => f.level === 'warn'),
  };
}

export { scan };
