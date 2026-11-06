/* ED EMR Suite — scenario modules (decision support) */
window.ED_SCENARIOS = [];

function scChip(id, label, opts, multi) {
  return { type: 'chips', id: id, label: label, multi: !!multi, options: opts };
}
function scText(id, label, ph, kind) {
  return { type: kind || 'text', id: id, label: label, placeholder: ph || '' };
}
function scArea(id, label, ph) {
  return { type: 'textarea', id: id, label: label, placeholder: ph || '' };
}
function scNum(id, label, ph) {
  return { type: 'number', id: id, label: label, placeholder: ph || '' };
}
function scSelect(id, label, opts) {
  return { type: 'select', id: id, label: label, options: opts };
}
function scCheck(id, label) {
  return { type: 'check', id: id, label: label };
}
function scScore(id, label, items) {
  return { type: 'score-group', id: id, label: label, items: items };
}
function scInfo(html) {
  return { type: 'info', html: html };
}
function scChecklist(id, label, items) {
  return { type: 'checklist', id: id, label: label, items: items };
}
function o(v, l) { return { value: v, label: l || v }; }

/* ========== 1. CHEST PAIN / ACS ========== */
window.ED_SCENARIOS.push({
  id: 'chest-pain',
  title: 'Chest pain / ACS',
  short: 'Chest pain',
  extraTs: [
    { id: 'tsEcgDone', label: 'ECG done' },
    { id: 'tsEcgRead', label: 'ECG read' },
    { id: 'tsTrop', label: 'Troponin sent' },
    { id: 'tsCardio', label: 'Cardiology informed' }
  ],
  sections: [
    scChip('cp_onset', 'Onset', [o('Sudden'), o('Gradual')]),
    scText('cp_duration', 'Duration', 'e.g. 2 hours'),
    scChip('cp_character', 'Character', [o('Pressure'), o('Heaviness'), o('Tightness'), o('Burning'), o('Sharp'), o('Tearing'), o('Pleuritic')], true),
    scChip('cp_radiation', 'Radiation', [o('Left arm'), o('Jaw'), o('Back'), o('Right arm'), o('None')], true),
    scChip('cp_assoc', 'Associated', [o('Sweating'), o('Nausea/vomiting'), o('Breathlessness'), o('Palpitations'), o('Syncope'), o('Epigastric pain'), o('Unilateral leg swelling')], true),
    scChip('cp_risks', 'Risk factors', [o('DM'), o('HTN'), o('Smoker'), o('Dyslipidaemia'), o('Family hx premature CAD'), o('Known CAD / prior PCI/CABG'), o('Obesity'), o('CKD')], true),
    scChip('cp_ecg', 'ECG findings', [o('Normal sinus'), o('STEMI'), o('New LBBB'), o('ST depression'), o('T inversion'), o('AF'), o('Other')], true),
    scSelect('cp_stemi_terr', 'STEMI territory', ['', 'Anterior (V1–V4)', 'Inferior (II, III, aVF)', 'Lateral (I, aVL, V5–V6)', 'Posterior', 'Right ventricular', 'Extensive anterior', 'Other / multi-territory']),
    scText('cp_trop0', 'Troponin 0h', 'value'),
    scChip('cp_trop0s', 'Troponin 0h status', [o('Normal'), o('Elevated'), o('Pending')]),
    scText('cp_tropR', 'Troponin repeat', 'value'),
    scChip('cp_tropRs', 'Troponin repeat status', [o('Normal'), o('Elevated'), o('Pending'), o('Not done')]),
    scScore('heart', 'HEART score', [
      { id: 'H', label: 'History (H)', opts: '0 Slightly · 1 Moderately · 2 Highly suspicious' },
      { id: 'E', label: 'ECG (E)', opts: '0 Normal · 1 Nonspecific repol · 2 Significant ST deviation' },
      { id: 'A', label: 'Age (A)', opts: '0 <45 · 1 45–64 · 2 ≥65' },
      { id: 'R', label: 'Risk factors (R)', opts: '0 None · 1 1–2 · 2 ≥3 or known atherosclerosis' },
      { id: 'T', label: 'Troponin (T)', opts: '0 ≤NL · 1 1–3× · 2 >3×' }
    ]),
    scSelect('cp_dx', 'Impression', ['', 'ACS — STEMI', 'ACS — NSTEMI', 'ACS — Unstable angina', 'Stable angina', 'Non-cardiac chest pain', 'Aortic dissection (suspected / confirmed)', 'Pulmonary embolism (suspected / confirmed)', 'Other']),
    scArea('cp_notes', 'Notes', 'Additional HPI / plan')
  ],
  compute: function (S, g) {
    var flags = [];
    var ch = g('cp_character') || [];
    var rad = g('cp_radiation') || [];
    var as = g('cp_assoc') || [];
    if (ch.indexOf('Tearing') >= 0 || (rad.indexOf('Back') >= 0 && ch.indexOf('Tearing') >= 0))
      flags.push('Red flag: consider aortic dissection.');
    if (ch.indexOf('Pleuritic') >= 0 && (as.indexOf('Breathlessness') >= 0 || as.indexOf('Unilateral leg swelling') >= 0))
      flags.push('Red flag: consider PE.');
    var ecg = g('cp_ecg') || [];
    if (ecg.indexOf('STEMI') >= 0 || ecg.indexOf('New LBBB') >= 0)
      flags.push('STEMI pathway: activate cath lab / thrombolysis per protocol.');
    // HEART auto A/R
    var age = parseInt(S.age, 10);
    if (!isNaN(age) && S._autoHeartA !== false) {
      S.scores = S.scores || {};
      S.scores.heart = S.scores.heart || {};
      S.scores.heart.A = age < 45 ? 0 : (age < 65 ? 1 : 2);
    }
    var risks = g('cp_risks') || [];
    if (S._autoHeartR !== false) {
      S.scores = S.scores || {};
      S.scores.heart = S.scores.heart || {};
      var known = risks.indexOf('Known CAD / prior PCI/CABG') >= 0;
      S.scores.heart.R = (known || risks.length >= 3) ? 2 : (risks.length >= 1 ? 1 : 0);
    }
    var hs = S.scores && S.scores.heart ? S.scores.heart : {};
    var parts = ['H', 'E', 'A', 'R', 'T'].map(function (k) { return hs[k]; });
    var total = null, band = '', cls = '', pathway = '';
    if (parts.every(function (x) { return x === 0 || x === 1 || x === 2; })) {
      total = parts.reduce(function (a, b) { return a + b; }, 0);
      if (total <= 3) { band = 'Low (~1.7% MACE)'; cls = ''; pathway = 'Early discharge pathway may be considered.'; }
      else if (total <= 6) { band = 'Moderate (~16.6% MACE)'; cls = 'mod'; pathway = 'Observation / serial troponin / consider admit.'; }
      else { band = 'High (~50–65% MACE)'; cls = 'high'; pathway = 'Early invasive / CCU / cardiology.'; }
    }
    var metrics = [];
    if (S.arrival && S.tsEcgDone) {
      var m = Math.round((new Date(S.tsEcgDone) - new Date(S.arrival)) / 60000);
      if (!isNaN(m)) metrics.push({ text: 'Door-to-ECG: ' + m + ' min', danger: m > 10 });
    }
    return {
      flags: flags,
      scores: [{ id: 'heart', title: 'HEART', total: total, band: band, cls: cls,
        pathway: pathway + ' Decision support — clinical judgement prevails.' }],
      metrics: metrics,
      dischargeWarn: (total != null && total >= 4) || (g('cp_trop0s') || []).indexOf('Elevated') >= 0 ||
        (ecg.indexOf('STEMI') >= 0 || ecg.indexOf('New LBBB') >= 0)
    };
  },
  note: function (S, g, join) {
    var L = [];
    L.push('SCENARIO: Chest pain / ACS');
    L.push('Onset: ' + join(g('cp_onset')) + '; Duration: ' + (S.cp_duration || '—'));
    L.push('Character: ' + join(g('cp_character')));
    L.push('Radiation: ' + join(g('cp_radiation')));
    L.push('Associated: ' + join(g('cp_assoc')));
    L.push('Risk factors: ' + join(g('cp_risks')));
    L.push('ECG: ' + join(g('cp_ecg')) + (S.cp_stemi_terr ? ' — ' + S.cp_stemi_terr : ''));
    L.push('Troponin 0h: ' + (S.cp_trop0 || '—') + ' (' + join(g('cp_trop0s')) + ')');
    L.push('Troponin repeat: ' + (S.cp_tropR || '—') + ' (' + join(g('cp_tropRs')) + ')');
    var hs = (S.scores && S.scores.heart) || {};
    if (['H','E','A','R','T'].every(function(k){ return hs[k]===0||hs[k]===1||hs[k]===2; })) {
      var t = hs.H+hs.E+hs.A+hs.R+hs.T;
      L.push('HEART: H'+hs.H+' E'+hs.E+' A'+hs.A+' R'+hs.R+' T'+hs.T+' = '+t+' (decision support — clinical judgement prevails)');
    }
    L.push('Impression: ' + (S.cp_dx || '—'));
    if (S.cp_notes) L.push(S.cp_notes);
    return L.join('\n');
  }
});

/* ========== 2. TRAUMA ATLS ========== */
window.ED_SCENARIOS.push({
  id: 'trauma',
  title: 'Trauma (ATLS)',
  short: 'Trauma',
  extraTs: [
    { id: 'tsPrimary', label: 'Primary survey done' },
    { id: 'tsEfast', label: 'eFAST done' },
    { id: 'tsSecondary', label: 'Secondary survey' },
    { id: 'tsPolice', label: 'Police informed' }
  ],
  sections: [
    scChip('tr_mech', 'Mechanism', [o('RTA / MVC'), o('Two-wheeler'), o('Fall from height'), o('Assault'), o('Penetrating'), o('Blast'), o('Crush'), o('Other')], true),
    scArea('tr_mist', 'MIST handover', 'Mechanism / Injuries / Signs / Treatment given'),
    scChip('tr_cabcde', 'Primary survey issues (cABCDE)', [o('Catastrophic haemorrhage'), o('Airway threat'), o('Breathing compromise'), o('Circulation shock'), o('Disability (neuro)'), o('Exposure / environment')], true),
    scChip('tr_interv', 'Interventions', [o('C-spine protection'), o('Airway adjunct / intubation'), o('Needle decompression'), o('Chest drain'), o('IV/IO access'), o('Pelvic binder'), o('Tourniquet'), o('Blood products'), o('TXA')], true),
    scSelect('tr_ge', 'GCS Eye (E)', ['', '4 Spontaneous', '3 To speech', '2 To pain', '1 None']),
    scSelect('tr_gv', 'GCS Verbal (V)', ['', '5 Oriented', '4 Confused', '3 Words', '2 Sounds', '1 None', 'T Tube']),
    scSelect('tr_gm', 'GCS Motor (M)', ['', '6 Obeys', '5 Localises', '4 Withdraws', '3 Flexion', '2 Extension', '1 None']),
    scChip('tr_efast', 'eFAST', [o('Negative'), o('RUQ +'), o('LUQ +'), o('Pelvis +'), o('Pericardial +'), o('Lung sliding absent (PTX)'), o('Not done')], true),
    scChip('tr_secondary', 'Secondary survey findings', [o('Head/face injury'), o('C-spine tenderness'), o('Chest injury'), o('Abdomen tender'), o('Pelvis unstable'), o('Long bone fracture'), o('Open fracture'), o('Neuro deficit'), o('Burns')], true),
    scNum('tr_weight', 'Estimated weight (kg)', 'for TXA / drugs'),
    scChip('tr_tetanus', 'Tetanus', [o('Up to date'), o('Booster given'), o('Ig indicated'), o('Unknown')]),
    scChip('tr_mlc', 'MLC / police', [o('MLC registered'), o('Police intimated'), o('Brought dead MLC'), o('Not applicable')], true),
    scArea('tr_notes', 'Notes', 'Injuries detail / plan')
  ],
  compute: function (S, g) {
    function gcsPart(sel, n) {
      if (!sel) return null;
      var m = String(sel).match(/^(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    }
    var E = gcsPart(S.tr_ge), V = gcsPart(S.tr_gv), M = gcsPart(S.tr_gm);
    var total = (E != null && V != null && M != null) ? E + V + M : null;
    var hr = parseFloat(S.hr), sbp = null;
    if (S.bpRight) { var mm = String(S.bpRight).match(/(\d+)/); if (mm) sbp = parseFloat(mm[1]); }
    var si = (hr && sbp) ? (hr / sbp) : null;
    var flags = [];
    if (total != null && total <= 8) flags.push('GCS ≤8 — protect airway / consider intubation.');
    if (si != null && si >= 0.9) flags.push('Shock index ≥0.9 — occult shock possible.');
    var cab = g('tr_cabcde') || [];
    if (cab.indexOf('Catastrophic haemorrhage') >= 0) flags.push('Control haemorrhage / TXA / blood products.');
    return {
      flags: flags,
      scores: [
        { id: 'gcs', title: 'GCS', total: total, band: total == null ? '' : ('E' + E + 'V' + V + 'M' + M), cls: total != null && total <= 8 ? 'high' : '', pathway: 'Decision support — clinical judgement prevails.' },
        { id: 'si', title: 'Shock index (HR/SBP)', total: si != null ? Math.round(si * 100) / 100 : null, band: si == null ? '' : (si >= 0.9 ? 'Elevated' : 'Normal range'), cls: si != null && si >= 0.9 ? 'mod' : '', pathway: 'Decision support — clinical judgement prevails.' }
      ]
    };
  },
  note: function (S, g, join) {
    var L = ['SCENARIO: Trauma (ATLS)'];
    L.push('Mechanism: ' + join(g('tr_mech')));
    if (S.tr_mist) L.push('MIST: ' + S.tr_mist);
    L.push('Primary (cABCDE): ' + join(g('tr_cabcde')));
    L.push('Interventions: ' + join(g('tr_interv')));
    L.push('GCS: ' + (S.tr_ge || '—') + ' / ' + (S.tr_gv || '—') + ' / ' + (S.tr_gm || '—'));
    L.push('eFAST: ' + join(g('tr_efast')));
    L.push('Secondary: ' + join(g('tr_secondary')));
    L.push('Tetanus: ' + join(g('tr_tetanus')));
    L.push('MLC/Police: ' + join(g('tr_mlc')));
    if (S.tr_notes) L.push(S.tr_notes);
    return L.join('\n');
  }
});

/* ========== 3. SEPSIS ========== */
window.ED_SCENARIOS.push({
  id: 'sepsis',
  title: 'Sepsis',
  short: 'Sepsis',
  extraTs: [
    { id: 'tsCultures', label: 'Cultures taken' },
    { id: 'tsAbx', label: 'Antibiotics given' },
    { id: 'tsFluids', label: 'Fluids started' },
    { id: 'tsLactate', label: 'Lactate sent' }
  ],
  sections: [
    scChip('sep_source', 'Suspected source', [o('Respiratory'), o('Urinary'), o('Intra-abdominal'), o('Skin/soft tissue'), o('CNS'), o('Line/device'), o('Unknown'), o('Other')], true),
    scChip('sep_qsofa', 'qSOFA criteria', [o('RR ≥22'), o('Altered mentation'), o('SBP ≤100')], true),
    scChip('sep_sirs', 'SIRS criteria', [o('Temp >38 or <36'), o('HR >90'), o('RR >20'), o('WBC >12 or <4')], true),
    scNum('sep_weight', 'Weight (kg)', 'for 30 ml/kg fluids'),
    scNum('sep_lact0', 'Lactate 0h (mmol/L)', ''),
    scNum('sep_lactR', 'Lactate repeat', ''),
    scChip('sep_cultures', 'Cultures before antibiotics', [o('Yes'), o('No — delayed'), o('Not obtained')]),
    scText('sep_abx', 'Antibiotic(s) given', 'drug / dose'),
    scChecklist('sep_bundle', 'Hour-1 bundle', [
      { id: 'b_lact', label: 'Lactate measured' },
      { id: 'b_cult', label: 'Blood cultures before antibiotics' },
      { id: 'b_abx', label: 'Broad-spectrum antibiotics' },
      { id: 'b_fluid', label: '30 ml/kg crystalloid if hypotensive / lactate ≥4' },
      { id: 'b_vaso', label: 'Vasopressors if needed (MAP ≥65)' }
    ]),
    scChip('sep_source_ctrl', 'Source control', [o('Not required'), o('Planned'), o('Done'), o('Not possible now')]),
    scArea('sep_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var q = (g('sep_qsofa') || []).length;
    var s = (g('sep_sirs') || []).length;
    var w = parseFloat(S.sep_weight);
    var fluid = (!isNaN(w)) ? Math.round(w * 30) : null;
    var flags = [];
    if (q >= 2) flags.push('qSOFA ≥2 — high risk of poor outcome; escalate.');
    if (S.tsAbx && S.arrival) {
      var m = Math.round((new Date(S.tsAbx) - new Date(S.arrival)) / 60000);
      if (!isNaN(m) && m > 60) flags.push('Time-to-antibiotic ' + m + ' min — exceeds 60 min target.');
    }
    var lac = parseFloat(S.sep_lact0);
    if (!isNaN(lac) && lac >= 4) flags.push('Lactate ≥4 — aggressive resuscitation / reassess.');
    return {
      flags: flags,
      scores: [
        { id: 'qsofa', title: 'qSOFA', total: q, band: q >= 2 ? 'Positive (≥2)' : 'Negative', cls: q >= 2 ? 'high' : '', pathway: 'Decision support — clinical judgement prevails.' },
        { id: 'sirs', title: 'SIRS', total: s, band: s >= 2 ? '≥2 criteria' : '<2', cls: s >= 2 ? 'mod' : '', pathway: 'Decision support — clinical judgement prevails.' },
        { id: 'fluid', title: '30 ml/kg fluid target', total: fluid, band: fluid != null ? (fluid + ' ml') : 'Enter weight', cls: '', pathway: 'Crystalloid target if indicated — clinical judgement prevails.' }
      ],
      metrics: (S.arrival && S.tsAbx) ? (function () {
        var m = Math.round((new Date(S.tsAbx) - new Date(S.arrival)) / 60000);
        return isNaN(m) ? [] : [{ text: 'Door-to-antibiotic: ' + m + ' min', danger: m > 60 }];
      })() : []
    };
  },
  note: function (S, g, join) {
    var L = ['SCENARIO: Sepsis'];
    L.push('Source: ' + join(g('sep_source')));
    L.push('qSOFA: ' + join(g('sep_qsofa')));
    L.push('SIRS: ' + join(g('sep_sirs')));
    L.push('Weight: ' + (S.sep_weight || '—') + ' kg; 30 ml/kg ≈ ' + (S.sep_weight ? Math.round(parseFloat(S.sep_weight) * 30) + ' ml' : '—'));
    L.push('Lactate 0h / repeat: ' + (S.sep_lact0 || '—') + ' / ' + (S.sep_lactR || '—'));
    L.push('Cultures before Abx: ' + join(g('sep_cultures')));
    L.push('Antibiotics: ' + (S.sep_abx || '—'));
    L.push('Source control: ' + join(g('sep_source_ctrl')));
    if (S.sep_notes) L.push(S.sep_notes);
    return L.join('\n');
  }
});

/* ========== 4. SHORTNESS OF BREATH ========== */
window.ED_SCENARIOS.push({
  id: 'sob',
  title: 'Shortness of breath',
  short: 'SOB',
  extraTs: [
    { id: 'tsAbg', label: 'ABG done' },
    { id: 'tsNiv', label: 'NIV started' }
  ],
  sections: [
    scChip('sob_dx', 'Working diagnosis chips', [o('Asthma'), o('COPD'), o('Pulmonary oedema'), o('PE'), o('Pneumonia'), o('Pneumothorax'), o('Metabolic acidosis'), o('Anxiety'), o('Other')], true),
    scNum('sob_peak', 'Peak flow (L/min)', ''),
    scNum('sob_peak_pred', 'Predicted peak flow', ''),
    scChip('sob_curb', 'CURB-65', [o('Confusion'), o('Urea >7 mmol/L (BUN >19)'), o('RR ≥30'), o('BP SBP<90 or DBP≤60'), o('Age ≥65')], true),
    scChip('sob_wells', 'Wells PE criteria (selected)', [o('Clinical DVT signs (+3)'), o('PE most likely (+3)'), o('HR >100 (+1.5)'), o('Immobilisation/surgery 4 wk (+1.5)'), o('Previous DVT/PE (+1.5)'), o('Haemoptysis (+1)'), o('Malignancy (+1)')], true),
    scChip('sob_perc', 'PERC rule (all must be true to rule out)', [o('Age <50'), o('HR <100'), o('SpO₂ ≥95%'), o('No haemoptysis'), o('No oestrogen'), o('No prior DVT/PE'), o('No unilateral leg swelling'), o('No surgery/trauma 4 wk')], true),
    scText('sob_abg', 'ABG', 'pH / PaCO₂ / PaO₂ / HCO₃ / Lac'),
    scChip('sob_airway', 'Airway support', [o('Room air / NC'), o('Face mask O₂'), o('NIV / BiPAP'), o('HFNC'), o('Intubated')], true),
    scArea('sob_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var curb = (g('sob_curb') || []).length;
    var wellsMap = {
      'Clinical DVT signs (+3)': 3, 'PE most likely (+3)': 3, 'HR >100 (+1.5)': 1.5,
      'Immobilisation/surgery 4 wk (+1.5)': 1.5, 'Previous DVT/PE (+1.5)': 1.5,
      'Haemoptysis (+1)': 1, 'Malignancy (+1)': 1
    };
    var wells = 0;
    (g('sob_wells') || []).forEach(function (x) { wells += wellsMap[x] || 0; });
    var perc = (g('sob_perc') || []).length;
    var flags = [];
    if (curb >= 3) flags.push('CURB-65 ≥3 — consider ICU / senior review.');
    if (wells > 4) flags.push('Wells PE score >4 — PE likely; consider imaging / therapy.');
    if (perc === 8) flags.push('PERC negative (all 8) — PE unlikely if low pretest probability.');
    return {
      flags: flags,
      scores: [
        { id: 'curb', title: 'CURB-65', total: curb, band: curb <= 1 ? 'Low' : (curb === 2 ? 'Moderate' : 'High'), cls: curb >= 3 ? 'high' : (curb === 2 ? 'mod' : ''), pathway: 'Decision support — clinical judgement prevails.' },
        { id: 'wells', title: 'Wells PE', total: wells, band: wells <= 4 ? 'PE unlikely' : 'PE likely', cls: wells > 4 ? 'mod' : '', pathway: 'Decision support — clinical judgement prevails.' },
        { id: 'perc', title: 'PERC criteria met', total: perc, band: perc + '/8', cls: '', pathway: 'Decision support — clinical judgement prevails.' }
      ]
    };
  },
  note: function (S, g, join) {
    var L = ['SCENARIO: Shortness of breath'];
    L.push('Dx chips: ' + join(g('sob_dx')));
    L.push('Peak flow: ' + (S.sob_peak || '—') + ' (predicted ' + (S.sob_peak_pred || '—') + ')');
    L.push('CURB-65: ' + join(g('sob_curb')));
    L.push('Wells PE: ' + join(g('sob_wells')));
    L.push('PERC: ' + join(g('sob_perc')));
    L.push('ABG: ' + (S.sob_abg || '—'));
    L.push('Airway support: ' + join(g('sob_airway')));
    if (S.sob_notes) L.push(S.sob_notes);
    return L.join('\n');
  }
});

/* ========== 5. STROKE / TIA ========== */
window.ED_SCENARIOS.push({
  id: 'stroke',
  title: 'Stroke / TIA',
  short: 'Stroke',
  extraTs: [
    { id: 'tsLkw', label: 'Last known well' },
    { id: 'tsCt', label: 'CT done' },
    { id: 'tsThrombolysis', label: 'Thrombolysis decision' }
  ],
  sections: [
    scChip('st_type', 'Presentation', [o('Ischaemic stroke suspected'), o('Haemorrhagic suspected'), o('TIA'), o('Stroke mimic')]),
    scInfo('<span class="badge">Enter Last known well in Timestamps section (scenario stamp)</span>'),
    scNum('st_cbg', 'CBG (mg/dL)', ''),
    scChip('st_nihss_quick', 'NIHSS domains (score each below)', [o('Completed full NIHSS')], true),
    { type: 'nihss', id: 'nihss' },
    scChecklist('st_contra', 'Thrombolysis absolute/relative contraindications (tick if present)', [
      { id: 'c_bleed', label: 'Active internal bleeding / bleeding diathesis' },
      { id: 'c_ich', label: 'Prior ICH / intracranial neoplasm / AVM' },
      { id: 'c_surg', label: 'Recent major surgery / trauma / LP' },
      { id: 'c_bp', label: 'Uncontrolled BP (>185/110) despite Rx' },
      { id: 'c_plt', label: 'Platelets <100k / INR >1.7 / on DOAC' },
      { id: 'c_stroke', label: 'Prior stroke within 3 months' },
      { id: 'c_glucose', label: 'Glucose <50 mg/dL' }
    ]),
    scChip('st_abcd2', 'ABCD² (TIA)', [o('Age ≥60 (+1)'), o('BP ≥140/90 (+1)'), o('Clinical unilateral weakness (+2)'), o('Clinical speech without weakness (+1)'), o('Duration ≥60 min (+2)'), o('Duration 10–59 min (+1)'), o('Diabetes (+1)')], true),
    scArea('st_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var flags = [];
    var lkw = S.tsLkw || S.st_lkw;
    var metrics = [];
    if (lkw) {
      var mins = Math.round((Date.now() - new Date(lkw).getTime()) / 60000);
      if (!isNaN(mins)) {
        var hrs = (mins / 60).toFixed(1);
        metrics.push({ text: 'Time since LKW: ' + hrs + ' h (' + mins + ' min)', danger: mins > 270 });
        if (mins <= 270) flags.push('Within typical thrombolysis window (≤4.5 h) — confirm eligibility.');
        else flags.push('Outside 4.5 h window from LKW — consider EVT eligibility / imaging.');
      }
    }
    if (S.arrival && S.tsCt) {
      var m = Math.round((new Date(S.tsCt) - new Date(S.arrival)) / 60000);
      if (!isNaN(m)) metrics.push({ text: 'Door-to-CT: ' + m + ' min', danger: m > 25 });
    }
    var nihss = 0, nihssOk = true;
    var items = ['loc','locq','locc','gaze','visual','facial','motorLarm','motorRarm','motorLleg','motorRleg','ataxia','sensory','language','dysarthria','neglect'];
    items.forEach(function (k) {
      var v = S['nihss_' + k];
      if (v === '' || v == null) nihssOk = false;
      else nihss += parseInt(v, 10) || 0;
    });
    var abcdMap = {
      'Age ≥60 (+1)': 1, 'BP ≥140/90 (+1)': 1, 'Clinical unilateral weakness (+2)': 2,
      'Clinical speech without weakness (+1)': 1, 'Duration ≥60 min (+2)': 2,
      'Duration 10–59 min (+1)': 1, 'Diabetes (+1)': 1
    };
    var abcd = 0;
    (g('st_abcd2') || []).forEach(function (x) { abcd += abcdMap[x] || 0; });
    var contra = 0;
    Object.keys(S).forEach(function (k) { if (k.indexOf('st_contra_') === 0 && S[k]) contra++; });
    if (contra > 0) flags.push(contra + ' thrombolysis contraindication(s) ticked — review carefully.');
    return {
      flags: flags,
      metrics: metrics,
      scores: [
        { id: 'nihss', title: 'NIHSS', total: nihssOk ? nihss : null, band: nihssOk ? (nihss + ' points') : 'Complete all items', cls: nihssOk && nihss >= 16 ? 'high' : (nihssOk && nihss >= 5 ? 'mod' : ''), pathway: 'Decision support — clinical judgement prevails.' },
        { id: 'abcd2', title: 'ABCD²', total: abcd, band: abcd >= 4 ? 'Higher short-term stroke risk' : 'Lower', cls: abcd >= 4 ? 'mod' : '', pathway: 'Decision support — clinical judgement prevails.' }
      ]
    };
  },
  note: function (S, g, join) {
    var L = ['SCENARIO: Stroke / TIA'];
    L.push('Type: ' + join(g('st_type')));
    L.push('Last known well: ' + (S.tsLkw || '—'));
    L.push('CBG: ' + (S.st_cbg || '—'));
    var items = ['loc','locq','locc','gaze','visual','facial','motorLarm','motorRarm','motorLleg','motorRleg','ataxia','sensory','language','dysarthria','neglect'];
    var sum = 0, ok = true;
    items.forEach(function (k) {
      var v = S['nihss_' + k];
      if (v === '' || v == null) ok = false; else sum += parseInt(v, 10) || 0;
    });
    L.push('NIHSS total: ' + (ok ? sum : 'incomplete'));
    L.push('ABCD² items: ' + join(g('st_abcd2')));
    if (S.st_notes) L.push(S.st_notes);
    return L.join('\n');
  }
});

/* ========== 6. ABDOMINAL PAIN ========== */
window.ED_SCENARIOS.push({
  id: 'abd',
  title: 'Abdominal pain',
  short: 'Abdomen',
  extraTs: [{ id: 'tsPocus', label: 'POCUS done' }, { id: 'tsSurg', label: 'Surgery informed' }],
  sections: [
    scChip('abd_site', 'Site', [o('RUQ'), o('LUQ'), o('Epigastric'), o('Periumbilical'), o('RLQ'), o('LLQ'), o('Suprapubic'), o('Diffuse'), o('Flank')], true),
    scChip('abd_char', 'Character / associated', [o('Colicky'), o('Constant'), o('Migratory'), o('Vomiting'), o('Diarrhoea'), o('Constipation'), o('Jaundice'), o('Dysuria'), o('Haematuria'), o('PV bleeding')], true),
    scChip('abd_alvarado', 'Alvarado (appendicitis)', [o('Migration to RLQ (+1)'), o('Anorexia (+1)'), o('Nausea/vomiting (+1)'), o('RLQ tenderness (+2)'), o('Rebound (+1)'), o('Fever (+1)'), o('Leukocytosis (+2)'), o('Left shift (+1)')], true),
    scChip('abd_red', 'Surgical red flags', [o('Peritonitis / rigidity'), o('Shock'), o('Incarcerated hernia'), o('Suspected AAA'), o('Suspected ectopic'), o('Ischaemic bowel'), o('Obstruction')], true),
    scChip('abd_upt', 'Pregnancy test (childbearing age)', [o('Positive'), o('Negative'), o('Not indicated'), o('Pending')]),
    scChip('abd_pocus', 'POCUS', [o('Normal'), o('Free fluid'), o('Cholecystitis signs'), o('Hydronephrosis'), o('IUP seen'), o('No IUP + free fluid'), o('AAA'), o('Not done')], true),
    scArea('abd_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var map = {
      'Migration to RLQ (+1)': 1, 'Anorexia (+1)': 1, 'Nausea/vomiting (+1)': 1,
      'RLQ tenderness (+2)': 2, 'Rebound (+1)': 1, 'Fever (+1)': 1,
      'Leukocytosis (+2)': 2, 'Left shift (+1)': 1
    };
    var alv = 0;
    (g('abd_alvarado') || []).forEach(function (x) { alv += map[x] || 0; });
    var flags = [];
    var red = g('abd_red') || [];
    if (red.length) flags.push('Surgical red flag(s): ' + red.join(', '));
    if ((g('abd_upt') || []).indexOf('Positive') >= 0 && red.indexOf('Suspected ectopic') >= 0)
      flags.push('Possible ectopic — urgent OB/Gyn + stabilise.');
    if (S.sex === 'Female' && !(g('abd_upt') || []).length)
      flags.push('Consider UPT in females of childbearing age.');
    return {
      flags: flags,
      scores: [{ id: 'alvarado', title: 'Alvarado', total: alv, band: alv >= 7 ? 'High probability' : (alv >= 5 ? 'Compatible' : 'Low'), cls: alv >= 7 ? 'high' : (alv >= 5 ? 'mod' : ''), pathway: 'Decision support — clinical judgement prevails.' }]
    };
  },
  note: function (S, g, join) {
    var L = ['SCENARIO: Abdominal pain'];
    L.push('Site: ' + join(g('abd_site')));
    L.push('Features: ' + join(g('abd_char')));
    L.push('Alvarado items: ' + join(g('abd_alvarado')));
    L.push('Red flags: ' + join(g('abd_red')));
    L.push('UPT: ' + join(g('abd_upt')));
    L.push('POCUS: ' + join(g('abd_pocus')));
    if (S.abd_notes) L.push(S.abd_notes);
    return L.join('\n');
  }
});

/* ========== 7. AMS / POISONING ========== */
window.ED_SCENARIOS.push({
  id: 'ams',
  title: 'AMS / Poisoning',
  short: 'AMS / Tox',
  extraTs: [
    { id: 'tsIngestion', label: 'Time of ingestion' },
    { id: 'tsDecon', label: 'Decontamination' },
    { id: 'tsAntidote', label: 'Antidote given' }
  ],
  sections: [
    scChip('ams_aeiou', 'AEIOU-TIPS', [o('Alcohol'), o('Epilepsy / electrolytes'), o('Insulin (hypo/hyper)'), o('Opiates / oxygen'), o('Uraemia'), o('Trauma / temp'), o('Infection'), o('Poisoning / psych'), o('Stroke / space-occupying')], true),
    scChip('ams_tox', 'Toxidrome', [o('Anticholinergic'), o('Cholinergic'), o('Opioid'), o('Sympathomimetic'), o('Sedative-hypnotic'), o('Serotonin'), o('Unknown')], true),
    scText('ams_agent', 'Poison / agent', ''),
    scText('ams_dose', 'Dose / amount', ''),
    scInfo('<span class="badge warn">Paracetamol: note 4-hour (or later) level timing relative to ingestion</span>'),
    scChip('ams_op', 'Organophosphate features', [o('Salivation'), o('Lacrimation'), o('Urination'), o('Diarrhoea'), o('GI upset'), o('Emesis'), o('Bradycardia'), o('Miosis'), o('Muscle weakness'), o('Fasciculations')], true),
    scChip('ams_decon', 'Decontamination', [o('Skin/eye wash'), o('Activated charcoal'), o('Gastric lavage (selected)'), o('Whole bowel irrigation'), o('Not indicated')], true),
    scChip('ams_antidote', 'Antidotes', [o('Naloxone'), o('N-acetylcysteine'), o('Atropine'), o('Pralidoxime'), o('Flumazenil (caution)'), o('Sodium bicarbonate'), o('Fomepizole / ethanol'), o('Other')], true),
    scChip('ams_mlc', 'MLC', [o('Yes — intentional'), o('Yes — accidental'), o('No'), o('Police informed')], true),
    scSelect('ams_ge', 'GCS Eye', ['', '4', '3', '2', '1']),
    scSelect('ams_gv', 'GCS Verbal', ['', '5', '4', '3', '2', '1', 'T']),
    scSelect('ams_gm', 'GCS Motor', ['', '6', '5', '4', '3', '2', '1']),
    scArea('ams_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var E = parseInt(S.ams_ge, 10), V = parseInt(S.ams_gv, 10), M = parseInt(S.ams_gm, 10);
    var total = (!isNaN(E) && !isNaN(V) && !isNaN(M)) ? E + V + M : null;
    var flags = [];
    if (total != null && total <= 8) flags.push('GCS ≤8 — airway protection.');
    if ((g('ams_tox') || []).indexOf('Cholinergic') >= 0 || (g('ams_op') || []).length >= 3)
      flags.push('Cholinergic / OP pattern — atropine, decontamination, PPE.');
    if ((S.ams_agent || '').toLowerCase().indexOf('paracetamol') >= 0 || (S.ams_agent || '').toLowerCase().indexOf('acetaminophen') >= 0)
      flags.push('Paracetamol: plot level on nomogram; start NAC if indicated — do not delay if staggered/unknown time.');
    return {
      flags: flags,
      scores: [{ id: 'gcs', title: 'GCS', total: total, band: total == null ? '' : ('E' + E + 'V' + V + 'M' + M), cls: total != null && total <= 8 ? 'high' : '', pathway: 'Decision support — clinical judgement prevails.' }]
    };
  },
  note: function (S, g, join) {
    var L = ['SCENARIO: Altered mental status / Poisoning'];
    L.push('AEIOU-TIPS: ' + join(g('ams_aeiou')));
    L.push('Toxidrome: ' + join(g('ams_tox')));
    L.push('Agent/dose: ' + (S.ams_agent || '—') + ' / ' + (S.ams_dose || '—'));
    L.push('Time of ingestion: ' + (S.tsIngestion || '—'));
    L.push('OP features: ' + join(g('ams_op')));
    L.push('Decontamination: ' + join(g('ams_decon')));
    L.push('Antidotes: ' + join(g('ams_antidote')));
    L.push('GCS: E' + (S.ams_ge || '—') + ' V' + (S.ams_gv || '—') + ' M' + (S.ams_gm || '—'));
    L.push('MLC: ' + join(g('ams_mlc')));
    if (S.ams_notes) L.push(S.ams_notes);
    return L.join('\n');
  }
});

/* ========== 8. PAEDIATRIC FEVER ========== */
window.ED_SCENARIOS.push({
  id: 'peds',
  title: 'Paediatric fever',
  short: 'Peds fever',
  extraTs: [{ id: 'tsAntipyretic', label: 'Antipyretic given' }],
  sections: [
    scNum('ped_age_mo', 'Age (months)', 'or use header age in years'),
    scNum('ped_weight', 'Weight (kg)', 'editable; auto-estimate available'),
    scInfo('<button type="button" class="btn btn-ghost btn-sm" id="btnEstWeight">Estimate weight from age (APLS-style)</button>'),
    scChip('ped_pat', 'Paediatric Assessment Triangle', [o('Appearance normal'), o('Appearance abnormal'), o('Work of breathing normal'), o('Work of breathing ↑'), o('Circulation to skin normal'), o('Circulation abnormal')], true),
    scChip('ped_nice', 'NICE traffic-light features', [
      o('Green — normal activity/colour', 'Green features'),
      o('Amber — fever ≥5d / tachypnoea / poor feeding', 'Amber features'),
      o('Red — pale/mottled / non-blanching rash / bulging fontanelle / status / seizures', 'Red features')
    ], true),
    scChip('ped_dehy', 'Dehydration', [o('None'), o('Some (CRT slow, dry mucosa)'), o('Severe (CRT>3s, sunken eyes, lethargy)')]),
    scChip('ped_imm', 'Immunisation', [o('Up to date'), o('Partial'), o('Unknown'), o('None')]),
    scNum('ped_para_dose', 'Paracetamol dose given (mg)', ''),
    scNum('ped_ibu_dose', 'Ibuprofen dose given (mg)', ''),
    scArea('ped_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var w = parseFloat(S.ped_weight);
    var flags = [];
    var nice = g('ped_nice') || [];
    if (nice.some(function (x) { return x.indexOf('Red') === 0; })) flags.push('NICE Red features — urgent senior review / consider sepsis.');
    if (nice.some(function (x) { return x.indexOf('Amber') === 0; })) flags.push('NICE Amber features — careful observation / investigations.');
    // vitals by age rough flags
    var ageMo = parseFloat(S.ped_age_mo);
    if (isNaN(ageMo) && S.age) ageMo = parseFloat(S.age) * 12;
    var hr = parseFloat(S.hr), rr = parseFloat(S.rr);
    if (!isNaN(ageMo) && !isNaN(hr)) {
      if (ageMo < 12 && hr > 160) flags.push('HR above typical infant range.');
      if (ageMo >= 12 && ageMo < 60 && hr > 140) flags.push('HR above typical 1–5y range.');
    }
    var paraMax = !isNaN(w) ? Math.round(w * 15) : null;
    var ibuMax = !isNaN(w) ? Math.round(w * 10) : null;
    var para = parseFloat(S.ped_para_dose);
    if (!isNaN(para) && paraMax && para > w * 20) flags.push('Paracetamol dose exceeds usual max (~15–20 mg/kg).');
    return {
      flags: flags,
      scores: [
        { id: 'para', title: 'Paracetamol guide (15 mg/kg)', total: paraMax, band: paraMax != null ? (paraMax + ' mg (max single ≈' + Math.round(w * 20) + ' mg)') : 'Enter weight', cls: '', pathway: 'Decision support — clinical judgement prevails. Check max daily dose.' },
        { id: 'ibu', title: 'Ibuprofen guide (10 mg/kg)', total: ibuMax, band: ibuMax != null ? (ibuMax + ' mg') : 'Enter weight', cls: '', pathway: 'Decision support — clinical judgement prevails. Avoid if dehydrated / renal risk.' }
      ]
    };
  },
  note: function (S, g, join) {
    var L = ['SCENARIO: Paediatric fever'];
    L.push('Age months: ' + (S.ped_age_mo || '—') + '; Weight: ' + (S.ped_weight || '—') + ' kg');
    L.push('PAT: ' + join(g('ped_pat')));
    L.push('NICE: ' + join(g('ped_nice')));
    L.push('Dehydration: ' + join(g('ped_dehy')));
    L.push('Immunisation: ' + join(g('ped_imm')));
    L.push('Paracetamol / Ibuprofen given (mg): ' + (S.ped_para_dose || '—') + ' / ' + (S.ped_ibu_dose || '—'));
    if (S.ped_notes) L.push(S.ped_notes);
    return L.join('\n');
  }
});

/* ========== 9. OB/GYN ========== */
window.ED_SCENARIOS.push({
  id: 'obgyn',
  title: 'OB / Gyn',
  short: 'OB/Gyn',
  extraTs: [{ id: 'tsObstetric', label: 'Obstetric review' }],
  sections: [
    scText('ob_lmp', 'LMP (YYYY-MM-DD)', 'use date field'),
    { type: 'date', id: 'ob_lmp_date', label: 'LMP date' },
    scText('ob_gpla', 'G P L A', 'e.g. G2P1L1A0'),
    scChip('ob_sym', 'Symptoms', [o('PV bleeding'), o('Abdominal/pelvic pain'), o('Reduced foetal movements'), o('Headache'), o('Visual symptoms'), o('Epigastric pain'), o('Seizure'), o('Fever'), o('Leaking liquor')], true),
    scChip('ob_ectopic', 'Ectopic red flags', [o('Unilateral pain'), o('Shoulder tip pain'), o('Syncope / shock'), o('Cervical motion tenderness'), o('No IUP on POCUS + positive UPT')], true),
    scChip('ob_upt', 'UPT', [o('Positive'), o('Negative'), o('Pending')]),
    scChip('ob_pph', 'PPH / eclampsia features', [o('Heavy PV bleeding postpartum'), o('Uterine atony'), o('Severe HTN'), o('Clonus'), o('Seizure (eclampsia)'), o('HELLP suspected')], true),
    scNum('ob_fhr', 'Foetal heart rate', ''),
    scChip('ob_meows', 'MEOWS-style triggers', [o('SBP ≥140 or DBP ≥90'), o('HR ≥110 or ≤50'), o('RR ≥25 or ≤10'), o('SpO₂ <95%'), o('Temp ≥38'), o('Altered consciousness')], true),
    scArea('ob_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var flags = [];
    var lmp = S.ob_lmp_date || S.ob_lmp;
    var ga = null, edd = null;
    if (lmp) {
      var d = new Date(lmp);
      if (!isNaN(d.getTime())) {
        var now = new Date();
        ga = Math.floor((now - d) / (7 * 24 * 3600 * 1000));
        edd = new Date(d.getTime() + 280 * 24 * 3600 * 1000);
      }
    }
    if ((g('ob_ectopic') || []).length) flags.push('Ectopic red flags present — urgent assessment.');
    if ((g('ob_pph') || []).indexOf('Seizure (eclampsia)') >= 0) flags.push('Eclampsia — MgSO4 pathway / airway / BP control.');
    if ((g('ob_meows') || []).length >= 2) flags.push('≥2 MEOWS-style triggers — escalate / obstetric emergency response.');
    var eddStr = '';
    if (edd) {
      var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
      eddStr = pad(edd.getDate()) + '/' + pad(edd.getMonth() + 1) + '/' + edd.getFullYear();
    }
    return {
      flags: flags,
      scores: [
        { id: 'ga', title: 'Gestational age (weeks from LMP)', total: ga, band: ga != null ? (ga + ' weeks') : 'Enter LMP', cls: '', pathway: 'Naegele estimate — confirm with ultrasound. Decision support — clinical judgement prevails.' },
        { id: 'edd', title: 'EDD (LMP+280d)', total: null, band: eddStr || '—', cls: '', pathway: 'Decision support — clinical judgement prevails.' }
      ]
    };
  },
  note: function (S, g, join) {
    var L = ['SCENARIO: OB / Gyn'];
    L.push('LMP: ' + (S.ob_lmp_date || S.ob_lmp || '—') + '; GPLA: ' + (S.ob_gpla || '—'));
    L.push('Symptoms: ' + join(g('ob_sym')));
    L.push('Ectopic flags: ' + join(g('ob_ectopic')));
    L.push('UPT: ' + join(g('ob_upt')));
    L.push('PPH/eclampsia: ' + join(g('ob_pph')));
    L.push('FHR: ' + (S.ob_fhr || '—'));
    L.push('MEOWS triggers: ' + join(g('ob_meows')));
    if (S.ob_notes) L.push(S.ob_notes);
    return L.join('\n');
  }
});

/* ========== 10. SYNCOPE ========== */
window.ED_SCENARIOS.push({
  id: 'syncope',
  title: 'Syncope',
  short: 'Syncope',
  extraTs: [{ id: 'tsEcgSync', label: 'ECG done' }],
  sections: [
    scChip('sy_prodrome', 'Prodrome / context', [o('Vasovagal prodrome'), o('Exertional'), o('While supine'), o('No warning'), o('Postural'), o('Situational'), o('With chest pain'), o('With palpitations')], true),
    scChip('sy_sfsr', 'San Francisco Syncope Rule (CHESS)', [o('History of CHF'), o('Haematocrit <30%'), o('ECG abnormal'), o('Shortness of breath'), o('Triage SBP <90')], true),
    scChip('sy_red', 'Red flags', [o('Family hx sudden death'), o('Known structural heart disease'), o('Abnormal ECG'), o('GI bleed signs'), o('Neuro deficit')], true),
    scArea('sy_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var n = (g('sy_sfsr') || []).length;
    var flags = [];
    if (n >= 1) flags.push('SFSR positive (≥1 CHESS) — higher risk; consider admission / further workup.');
    if ((g('sy_prodrome') || []).indexOf('Exertional') >= 0) flags.push('Exertional syncope — cardiac until proven otherwise.');
    return {
      flags: flags,
      scores: [{ id: 'sfsr', title: 'SFSR (CHESS) positives', total: n, band: n >= 1 ? 'Positive' : 'Negative', cls: n >= 1 ? 'mod' : '', pathway: 'Decision support — clinical judgement prevails.' }]
    };
  },
  note: function (S, g, join) {
    return ['SCENARIO: Syncope', 'Context: ' + join(g('sy_prodrome')), 'SFSR: ' + join(g('sy_sfsr')), 'Red flags: ' + join(g('sy_red')), S.sy_notes || ''].filter(Boolean).join('\n');
  }
});

/* ========== 11. SEIZURE ========== */
window.ED_SCENARIOS.push({
  id: 'seizure',
  title: 'Seizure',
  short: 'Seizure',
  extraTs: [{ id: 'tsSeizureOnset', label: 'Seizure onset' }, { id: 'tsBzds', label: 'Benzodiazepine given' }],
  sections: [
    scChip('sz_type', 'Type', [o('GTCS'), o('Focal'), o('Absence'), o('Status epilepticus'), o('Psychogenic suspected'), o('First seizure'), o('Known epilepsy')], true),
    scChip('sz_feat', 'Features', [o('Tongue bite'), o('Incontinence'), o('Post-ictal'), o('Head injury'), o('Pregnancy'), o('Fever'), o('Alcohol withdrawal'), o('Medication non-compliance')], true),
    scNum('sz_cbg', 'CBG', ''),
    scChip('sz_rx', 'ED treatment', [o('Airway / O₂'), o('Lorazepam / Midazolam'), o('Levetiracetam'), o('Valproate'), o('Phenytoin'), o('Thiamine / glucose')], true),
    scArea('sz_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var flags = [];
    if ((g('sz_type') || []).indexOf('Status epilepticus') >= 0) flags.push('Status — follow status protocol; time benzodiazepines.');
    if ((g('sz_feat') || []).indexOf('Pregnancy') >= 0) flags.push('Consider eclampsia — MgSO4.');
    return { flags: flags, scores: [] };
  },
  note: function (S, g, join) {
    return ['SCENARIO: Seizure', 'Type: ' + join(g('sz_type')), 'Features: ' + join(g('sz_feat')), 'CBG: ' + (S.sz_cbg || '—'), 'Rx: ' + join(g('sz_rx')), S.sz_notes || ''].filter(Boolean).join('\n');
  }
});

/* ========== 12. HEADACHE ========== */
window.ED_SCENARIOS.push({
  id: 'headache',
  title: 'Headache',
  short: 'Headache',
  extraTs: [{ id: 'tsCtHead', label: 'CT head' }, { id: 'tsLp', label: 'LP done' }],
  sections: [
    scChip('ha_red', 'Red flags', [o('Thunderclap'), o('Worst ever'), o('Neck stiffness'), o('Fever'), o('Neuro deficit'), o('Papilloedema'), o('Immunosuppressed'), o('Anticoagulated'), o('Pregnancy / postpartum'), o('Age >50 new'), o('Cancer history')], true),
    scChip('ha_ottawa', 'Ottawa SAH rule (investigate if ANY)', [o('Age ≥40'), o('Neck pain/stiffness'), o('Witnessed LOC'), o('Onset during exertion'), o('Thunderclap (peak <1s)'), o('Limited neck flexion')], true),
    scChip('ha_dx', 'Impression chips', [o('Migraine'), o('Tension'), o('Cluster'), o('SAH suspected'), o('Meningitis/encephalitis'), o('Raised ICP'), o('Sinusitis'), o('Other')], true),
    scArea('ha_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var ot = (g('ha_ottawa') || []).length;
    var flags = [];
    if (ot >= 1) flags.push('Ottawa SAH rule positive — cannot rule out SAH clinically; image ± LP per protocol.');
    if ((g('ha_red') || []).indexOf('Thunderclap') >= 0) flags.push('Thunderclap — SAH until proven otherwise.');
    return {
      flags: flags,
      scores: [{ id: 'ottawa', title: 'Ottawa SAH positives', total: ot, band: ot >= 1 ? 'Positive' : 'Negative (if rule applicable)', cls: ot >= 1 ? 'high' : '', pathway: 'Decision support — clinical judgement prevails. Rule only if inclusion criteria met.' }]
    };
  },
  note: function (S, g, join) {
    return ['SCENARIO: Headache', 'Red flags: ' + join(g('ha_red')), 'Ottawa SAH: ' + join(g('ha_ottawa')), 'Impression: ' + join(g('ha_dx')), S.ha_notes || ''].filter(Boolean).join('\n');
  }
});

/* ========== 13. DKA / HYPERGLYCAEMIA ========== */
window.ED_SCENARIOS.push({
  id: 'dka',
  title: 'DKA / Hyperglycaemia',
  short: 'DKA',
  extraTs: [{ id: 'tsInsulin', label: 'Insulin started' }, { id: 'tsFluidsDka', label: 'Fluids started' }],
  sections: [
    scNum('dka_cbg', 'CBG / lab glucose (mg/dL)', ''),
    scNum('dka_ph', 'pH', ''),
    scNum('dka_hco3', 'HCO₃ (mmol/L)', ''),
    scChip('dka_ket', 'Ketones', [o('Urine ketones +'), o('Urine ketones +++'), o('Blood ketones elevated'), o('Not done')], true),
    scChip('dka_type', 'Working diagnosis', [o('DKA'), o('HHS'), o('Simple hyperglycaemia'), o('Mixed')]),
    scChecklist('dka_bundle', 'Fluid & insulin checklist', [
      { id: 'd_abc', label: 'ABC / fluid resuscitation started' },
      { id: 'd_k', label: 'Potassium checked before insulin' },
      { id: 'd_ins', label: 'Insulin infusion per protocol' },
      { id: 'd_gluc', label: 'Glucose added when CBG falling' },
      { id: 'd_monitor', label: 'Hourly CBG / electrolytes plan' },
      { id: 'd_precip', label: 'Precipitant sought (infection, omission, ACS)' }
    ]),
    scArea('dka_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var flags = [];
    var ph = parseFloat(S.dka_ph), hco = parseFloat(S.dka_hco3), cbg = parseFloat(S.dka_cbg);
    if (!isNaN(ph) && ph < 7.3 && !isNaN(hco) && hco < 18) flags.push('Acidosis + low HCO₃ — DKA criteria possible if ketones present.');
    if (!isNaN(cbg) && cbg > 600) flags.push('Very high glucose — consider HHS; check osmolality.');
    return { flags: flags, scores: [] };
  },
  note: function (S, g, join) {
    return ['SCENARIO: DKA / Hyperglycaemia', 'Glucose: ' + (S.dka_cbg || '—'), 'pH / HCO₃: ' + (S.dka_ph || '—') + ' / ' + (S.dka_hco3 || '—'), 'Ketones: ' + join(g('dka_ket')), 'Dx: ' + join(g('dka_type')), S.dka_notes || ''].filter(Boolean).join('\n');
  }
});

/* ========== 14. ANAPHYLAXIS ========== */
window.ED_SCENARIOS.push({
  id: 'anaphylaxis',
  title: 'Allergy / Anaphylaxis',
  short: 'Anaphylaxis',
  extraTs: [{ id: 'tsAdrenaline', label: 'Adrenaline given' }],
  sections: [
    scChip('an_trigger', 'Trigger', [o('Food'), o('Drug'), o('Insect sting'), o('Contrast'), o('Unknown'), o('Other')], true),
    scChip('an_feat', 'Features', [o('Urticaria / angioedema'), o('Respiratory distress / wheeze'), o('Hypotension'), o('GI symptoms'), o('Stridor'), o('Syncope')], true),
    scNum('an_weight', 'Weight (kg)', 'for adrenaline dose'),
    scInfo('<div id="anDoseHint" class="badge"></div>'),
    scChip('an_rx', 'Treatment', [o('Adrenaline IM'), o('Repeat adrenaline'), o('IV fluids'), o('Antihistamine'), o('Steroid'), o('Nebulised bronchodilator'), o('Airway support')], true),
    scChip('an_disp', 'Observation / plan', [o('Observe ≥4–6h'), o('Admit'), o('Epipen education'), o('Allergy referral')], true),
    scArea('an_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var w = parseFloat(S.an_weight || S.ped_weight);
    var flags = [];
    var feat = g('an_feat') || [];
    if (feat.indexOf('Hypotension') >= 0 || feat.indexOf('Respiratory distress / wheeze') >= 0 || feat.indexOf('Stridor') >= 0)
      flags.push('Anaphylaxis features — adrenaline IM immediate if not given.');
    var dose = null, band = 'Enter weight';
    if (!isNaN(w)) {
      // 0.01 mg/kg of 1:1000 = 0.01 ml/kg; usual max 0.5 mg
      var mg = Math.min(0.5, Math.round(w * 0.01 * 100) / 100);
      dose = mg;
      band = mg + ' mg IM (1:1000) ≈ ' + (mg) + ' ml; adult often 0.5 mg';
    }
    return {
      flags: flags,
      scores: [{ id: 'adr', title: 'Adrenaline IM guide (0.01 mg/kg, max 0.5)', total: dose, band: band, cls: '', pathway: 'Decision support — clinical judgement prevails. Use institutional concentration.' }]
    };
  },
  note: function (S, g, join) {
    return ['SCENARIO: Allergy / Anaphylaxis', 'Trigger: ' + join(g('an_trigger')), 'Features: ' + join(g('an_feat')), 'Weight: ' + (S.an_weight || '—') + ' kg', 'Rx: ' + join(g('an_rx')), 'Plan: ' + join(g('an_disp')), S.an_notes || ''].filter(Boolean).join('\n');
  }
});

/* ========== 15. SNAKE BITE ========== */
window.ED_SCENARIOS.push({
  id: 'snake',
  title: 'Snake bite',
  short: 'Snake bite',
  extraTs: [
    { id: 'tsBite', label: 'Time of bite' },
    { id: 'tsWbct', label: '20-min WBCT' },
    { id: 'tsAsv', label: 'ASV started' }
  ],
  sections: [
    scChip('sn_type', 'Suspected syndrome', [o('Haemotoxic'), o('Neurotoxic'), o('Myotoxic'), o('Unknown / dry bite')], true),
    scChip('sn_local', 'Local signs', [o('Fang marks'), o('Swelling'), o('Bleeding from site'), o('Blistering'), o('Lymphadenopathy')], true),
    scChip('sn_sys', 'Systemic signs', [o('Ptosis'), o('Ophthalmoplegia'), o('Bulbar weakness'), o('Respiratory weakness'), o('Coagulopathy / bleeding'), o('Dark urine'), o('Shock'), o('Abdominal pain')], true),
    scChip('sn_wbct', '20-min WBCT', [o('Clotted (negative)'), o('Unclotted (positive)'), o('Not done'), o('Repeat positive')]),
    scText('sn_asv', 'ASV vials given', 'e.g. 10 vials polyvalent'),
    scChip('sn_rx', 'Other Rx', [o('Neostigmine trial (neuro)'), o('Ventilatory support'), o('Tetanus'), o('Antibiotics if indicated'), o('Surgical consult')], true),
    scChip('sn_mlc', 'MLC', [o('Yes'), o('No')]),
    scArea('sn_notes', 'Notes', 'Species if known; Indian polyvalent ASV context')
  ],
  compute: function (S, g) {
    var flags = [];
    if ((g('sn_wbct') || []).indexOf('Unclotted (positive)') >= 0 || (g('sn_wbct') || []).indexOf('Repeat positive') >= 0)
      flags.push('WBCT positive — ASV indicated per national protocol.');
    if ((g('sn_sys') || []).some(function (x) { return x.indexOf('Ptosis') >= 0 || x.indexOf('Respiratory') >= 0; }))
      flags.push('Neurotoxic features — monitor ventilation; ASV ± neostigmine.');
    return { flags: flags, scores: [] };
  },
  note: function (S, g, join) {
    return ['SCENARIO: Snake bite (Indian context)', 'Syndrome: ' + join(g('sn_type')), 'Local: ' + join(g('sn_local')), 'Systemic: ' + join(g('sn_sys')), '20-min WBCT: ' + join(g('sn_wbct')), 'ASV: ' + (S.sn_asv || '—'), 'Other Rx: ' + join(g('sn_rx')), 'MLC: ' + join(g('sn_mlc')), S.sn_notes || ''].filter(Boolean).join('\n');
  }
});

/* ========== 16. MINOR INJURY / LACERATION ========== */
window.ED_SCENARIOS.push({
  id: 'laceration',
  title: 'Minor injury / Laceration',
  short: 'Laceration',
  extraTs: [{ id: 'tsWound', label: 'Wound cleaned / closed' }],
  sections: [
    scChip('lac_site', 'Site', [o('Scalp'), o('Face'), o('Hand'), o('Forearm'), o('Leg'), o('Foot'), o('Trunk'), o('Other')], true),
    scText('lac_size', 'Size / depth', 'e.g. 3 cm, subcutaneous'),
    scChip('lac_contam', 'Contamination', [o('Clean'), o('Contaminated'), o('Bite'), o('Crush')], true),
    scChip('lac_neuro', 'Neurovascular', [o('Intact'), o('Sensory deficit'), o('Motor deficit'), o('Vascular concern')], true),
    scChip('lac_rx', 'Management', [o('Irrigation'), o('LA / block'), o('Sutures'), o('Tissue adhesive'), o('Steristrips'), o('Dressing only'), o('Delayed closure'), o('Foreign body removed')], true),
    scChip('lac_tetanus', 'Tetanus', [o('Up to date'), o('Booster given'), o('Ig considered'), o('Unknown')]),
    scArea('lac_notes', 'Notes', 'Suture material / follow-up')
  ],
  compute: function (S, g) {
    var flags = [];
    if ((g('lac_contam') || []).indexOf('Bite') >= 0) flags.push('Bite wound — careful closure decisions; antibiotics as per protocol.');
    if ((g('lac_neuro') || []).some(function (x) { return x !== 'Intact'; }))
      flags.push('Neurovascular deficit — senior / specialty review.');
    return { flags: flags, scores: [] };
  },
  note: function (S, g, join) {
    return ['SCENARIO: Minor injury / Laceration', 'Site: ' + join(g('lac_site')), 'Size: ' + (S.lac_size || '—'), 'Contamination: ' + join(g('lac_contam')), 'N/V: ' + join(g('lac_neuro')), 'Rx: ' + join(g('lac_rx')), 'Tetanus: ' + join(g('lac_tetanus')), S.lac_notes || ''].filter(Boolean).join('\n');
  }
});

/* ========== 17. FEVER / DENGUE / MALARIA ========== */
window.ED_SCENARIOS.push({
  id: 'tropical',
  title: 'Fever / Dengue / Malaria',
  short: 'Tropical fever',
  extraTs: [{ id: 'tsNs1', label: 'NS1 / dengue test' }, { id: 'tsMp', label: 'Malaria smear / RDT' }],
  sections: [
    scChip('tf_syndrome', 'Syndrome', [o('Dengue suspected'), o('Malaria suspected'), o('Enteric fever'), o('Leptospirosis'), o('Scrub typhus'), o('Viral illness'), o('Bacterial sepsis'), o('Other')], true),
    scChip('tf_dengue_warn', 'Dengue warning signs', [o('Abdominal pain'), o('Persistent vomiting'), o('Fluid accumulation'), o('Mucosal bleed'), o('Lethargy / restlessness'), o('Liver tender / enlarged'), o('HCT rise with rapid platelet drop')], true),
    scChip('tf_malaria', 'Malaria features', [o('Rigors'), o('Travel / endemic area'), o('Splenomegaly'), o('Altered sensorium'), o('Jaundice'), o('Severe anaemia'), o('Blackwater')], true),
    scText('tf_plt', 'Platelet count', ''),
    scText('tf_hct', 'Haematocrit', ''),
    scChip('tf_tests', 'Tests', [o('NS1'), o('IgM dengue'), o('MP smear'), o('Malaria RDT'), o('Blood culture'), o('WIDAL / Typhidot'), o('CXR')], true),
    scArea('tf_notes', 'Notes', '')
  ],
  compute: function (S, g) {
    var flags = [];
    var w = g('tf_dengue_warn') || [];
    if (w.length) flags.push('Dengue warning sign(s) — close monitoring / consider admission.');
    if ((g('tf_malaria') || []).some(function (x) { return x.indexOf('Altered') >= 0 || x.indexOf('Blackwater') >= 0 || x.indexOf('Severe') >= 0; }))
      flags.push('Features of severe malaria — urgent smear + artesunate pathway per protocol.');
    return {
      flags: flags,
      scores: [{ id: 'dw', title: 'Dengue warning signs', total: w.length, band: w.length ? 'Present' : 'None selected', cls: w.length ? 'mod' : '', pathway: 'Decision support — clinical judgement prevails.' }]
    };
  },
  note: function (S, g, join) {
    return ['SCENARIO: Fever / Dengue / Malaria', 'Syndrome: ' + join(g('tf_syndrome')), 'Dengue warning: ' + join(g('tf_dengue_warn')), 'Malaria features: ' + join(g('tf_malaria')), 'Plt / HCT: ' + (S.tf_plt || '—') + ' / ' + (S.tf_hct || '—'), 'Tests: ' + join(g('tf_tests')), S.tf_notes || ''].filter(Boolean).join('\n');
  }
});

console.log('[ED Suite] Scenarios loaded:', window.ED_SCENARIOS.length);
