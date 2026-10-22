// Practice clients. Every person, number and goal here is MADE UP for practice.
// They are identified by bed only. No names, dates of birth or record numbers, on purpose.
//
// Each case has sample shift jottings (the kind of shorthand written on paper during rounds)
// and a saved demo draft. The demo drafts are used when the app runs without an API key.
// They contain mistakes left in on purpose, so staff can see the checker catch them.

export const NOTE_FORMAT = {
  // IHH's real note format is not in the event materials, so this is a placeholder.
  // DAR (Data, Action, Response) is a common nursing charting format. Swap in IHH's.
  name: 'DAR (placeholder for IHH\'s own format)',
  sections: [
    { id: 'Data', label: 'Data', hint: 'What you saw, measured or were told' },
    { id: 'Action', label: 'Action', hint: 'What you did: taught, reminded, called' },
    { id: 'Response', label: 'Response', hint: 'What the client did or said back' },
  ],
};

export const CASES = [
  {
    id: 'bed-3',
    bed: 'Bed 3',
    summary: 'Diabetes, healing wound on left foot',
    goals: [
      { id: 'G1', text: 'Checks own blood sugar before meals and writes it in the log' },
      { id: 'G2', text: 'Keeps left foot dressing clean and dry; reports changes' },
      { id: 'G3', text: 'Takes own medications as prescribed' },
    ],
    jottings:
`0800 BS 212, pt checked self w/ glucometer, needed 1 reminder on test strip. Took own metformin + lisinopril, I watched. L foot dressing CDI.
1100 taught s/s of high sugar, pt repeated back. Pt says skipped breakfast.
1400 BS 168. Pt asked about diet, told will ask clinic.
Called home health re: dressing change schedule, LM.`,
    demoDraft: {
      sentences: [
        { section: 'Data', text: 'At 0800, client checked own blood sugar with glucometer: 212.', source: '0800 BS 212, pt checked self w/ glucometer', goal_ids: ['G1'] },
        { section: 'Response', text: 'Client needed 1 reminder on using the test strip.', source: 'needed 1 reminder on test strip', goal_ids: ['G1'] },
        { section: 'Action', text: 'Staff administered metformin and lisinopril.', source: 'Took own metformin + lisinopril, I watched', goal_ids: ['G3'] },
        { section: 'Data', text: 'Left foot dressing clean, dry and intact.', source: 'L foot dressing CDI', goal_ids: ['G2'] },
        { section: 'Action', text: 'At 1100, taught client signs and symptoms of high blood sugar.', source: '1100 taught s/s of high sugar', goal_ids: ['G1'] },
        { section: 'Response', text: 'Client repeated the teaching back.', source: 'pt repeated back', goal_ids: ['G1'] },
        { section: 'Data', text: 'Client reports skipping breakfast.', source: 'Pt says skipped breakfast', goal_ids: [] },
        { section: 'Data', text: 'At 1400, blood sugar 186.', source: '1400 BS 168', goal_ids: ['G1'] },
        { section: 'Action', text: 'Client asked about diet; told client staff will ask the clinic.', source: 'Pt asked about diet, told will ask clinic', goal_ids: [] },
        { section: 'Action', text: 'Called home health about the dressing change schedule; left message.', source: 'Called home health re: dressing change schedule, LM', goal_ids: ['G2'] },
      ],
      questions: [
        'Your jottings don\'t say whether the client wrote the readings in their log. Goal G1 mentions the log.',
      ],
      planted: 2,
    },
  },
  {
    id: 'bed-7',
    bed: 'Bed 7',
    summary: 'COPD, getting over pneumonia',
    goals: [
      { id: 'G1', text: 'Oxygen level stays at 90% or higher on room air' },
      { id: 'G2', text: 'Uses own inhaler with correct technique' },
      { id: 'G3', text: 'Walks a little more each day with walker' },
      { id: 'G4', text: 'Goes to pulmonary clinic follow-up' },
    ],
    jottings:
`0900 VS BP 138/84 HR 92 RR 20 SpO2 93% RA.
Pt used own inhaler, technique ok after cue to hold breath.
Walked hallway x2 w/ walker, SOB after 2nd lap, rested 5 min.
1300 SpO2 91% RA. Pt says cough better, less sputum.
Reminded f/u pulm clinic appt Thurs.`,
    demoDraft: {
      sentences: [
        { section: 'Data', text: 'At 0900, vital signs: BP 138/84, HR 92, RR 20, SpO2 93% on room air.', source: '0900 VS BP 138/84 HR 92 RR 20 SpO2 93% RA', goal_ids: ['G1'] },
        { section: 'Response', text: 'Client used own inhaler; technique was correct after a cue to hold breath.', source: 'Pt used own inhaler, technique ok after cue to hold breath', goal_ids: ['G2'] },
        { section: 'Response', text: 'Client walked the hallway twice with walker, was short of breath after the 2nd lap and rested 5 minutes.', source: 'Walked hallway x2 w/ walker, SOB after 2nd lap, rested 5 min', goal_ids: ['G3'] },
        { section: 'Data', text: 'At 1300, SpO2 91% on room air; breathing stable and improving.', source: '1300 SpO2 91% RA', goal_ids: ['G1'] },
        { section: 'Data', text: 'Client reports cough is better with less sputum.', source: 'Pt says cough better, less sputum', goal_ids: [] },
        { section: 'Action', text: 'Reminded client of follow-up appointment at pulmonary clinic on Thursday.', source: 'Reminded f/u pulm clinic appt Thurs', goal_ids: ['G4'] },
      ],
      questions: [],
      planted: 1,
    },
  },
  {
    id: 'bed-12',
    bed: 'Bed 12',
    summary: 'After surgery on right leg, using crutches',
    goals: [
      { id: 'G1', text: 'Takes own pain medicine on schedule and reports pain level' },
      { id: 'G2', text: 'Keeps weight off right leg, using crutches' },
      { id: 'G3', text: 'Lets staff check incision; reports redness or drainage' },
      { id: 'G4', text: 'Goes to orthopedic follow-up' },
    ],
    jottings:
`1000 Pt says took own oxycodone at 0700, I did not see it. Pain 6/10.
Using crutches. Saw pt put weight on R foot once in bathroom, reminded NWB.
Incision not checked, pt declined.
1500 pain 4/10.
Ortho appt confirmed for next wk.`,
    demoDraft: {
      sentences: [
        { section: 'Data', text: 'At 1000, client reports taking own oxycodone at 0700, observed by staff.', source: '1000 Pt says took own oxycodone at 0700', goal_ids: ['G1'] },
        { section: 'Data', text: 'Pain 6/10.', source: 'Pain 6/10', goal_ids: ['G1'] },
        { section: 'Data', text: 'Client using crutches. Staff saw client put weight on right foot once in the bathroom.', source: 'Using crutches. Saw pt put weight on R foot once in bathroom', goal_ids: ['G2'] },
        { section: 'Action', text: 'Reminded client to keep weight off the right leg.', source: 'reminded NWB', goal_ids: ['G2'] },
        { section: 'Data', text: 'Incision clean, dry and intact.', source: 'Incision not checked, pt declined', goal_ids: ['G3'] },
        { section: 'Response', text: 'Client declined incision check.', source: 'Incision not checked, pt declined', goal_ids: ['G3'] },
        { section: 'Data', text: 'At 1500, pain 4/10.', source: '1500 pain 4/10', goal_ids: ['G1'] },
        { section: 'Action', text: 'Orthopedic appointment confirmed for next week.', source: 'Ortho appt confirmed for next wk', goal_ids: ['G4'] },
      ],
      questions: [
        'You noted you did not see the 0700 dose. Keep the wording as "client reports".',
      ],
      planted: 2,
    },
  },
];
