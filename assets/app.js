/* ED EMR Suite — core application */
(function () {
  'use strict';
  var STORAGE_KEY = 'edEmrSuite_v1';
  var state = {
    scenarioId: null,
    chips: {},
    scores: {},
    checks: {},
    locked: false,
    addenda: [],
    _autoHeartA: true,
    _autoHeartR: true
  };

  function $(id) { return document.getElementById(id); }
  function val(id) {
    var el = $(id);
    if (!el) return (state[id] != null ? String(state[id]) : '') ;
    if (el.type === 'checkbox') return el.checked;
    return String(el.value || '').trim();
  }
  function setVal(id, v) {
    var el = $(id);
    if (el) {
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
    }
    state[id] = v;
  }
  function nowLocal() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtDisplay(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function minutesBetween(a, b) {
    if (!a || !b) return null;
    var da = new Date(a), db = new Date(b);
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
    return Math.round((db - da) / 60000);
  }
  function joinList(arr) {
    return arr && arr.length ? arr.join(', ') : '—';
  }
  function getChips(id) { return state.chips[id] || []; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function currentScenario() {
    if (!state.scenarioId || !window.ED_SCENARIOS) return null;
    for (var i = 0; i < window.ED_SCENARIOS.length; i++) {
      if (window.ED_SCENARIOS[i].id === state.scenarioId) return window.ED_SCENARIOS[i];
    }
    return null;
  }

  function gatherFieldState() {
    document.querySelectorAll('[data-field]').forEach(function (el) {
      var id = el.getAttribute('data-field');
      if (el.type === 'checkbox') state[id] = el.checked;
      else state[id] = el.value;
    });
    // shared fields by id
    ['uhid','ptName','age','sex','arrival','mlc','allergies','triage',
     'hr','bpRight','bpLeft','rr','spo2','temp','gcs','cbg','pain',
     'tsDoctor','tsDecision','tsDisposition',
     'docName','docDesig','docReg','docSignTime',
     'dxText','dcDetail','lamaName','lamaRel','lamaWitness',
     'xferFacility','xferReason','xferCondition'
    ].forEach(function (id) {
      var el = $(id);
      if (el) state[id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    ['dcPrecautions','dcFollowup','dcInstructions','lamaRisks','lamaSign','xferHandover'].forEach(function (id) {
      var el = $(id);
      if (el) state[id] = el.checked;
    });
  }

  /* ---------- render scenario picker ---------- */
  function renderPicker() {
    var box = $('scenarioGrid');
    if (!box || !window.ED_SCENARIOS) return;
    box.innerHTML = window.ED_SCENARIOS.map(function (sc) {
      var active = state.scenarioId === sc.id ? ' active' : '';
      return '<button type="button" class="chip scenario' + active + '" data-scenario="' + sc.id + '">' +
        escapeHtml(sc.short || sc.title) + '</button>';
    }).join('');
  }

  /* ---------- render scenario body ---------- */
  function renderScoreGroup(sec) {
    var html = '<div class="sublabel">' + escapeHtml(sec.label) + ' <span class="ds" style="font-size:.62rem;font-weight:600;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;padding:2px 6px;border-radius:99px">Decision support</span></div>';
    (sec.items || []).forEach(function (it) {
      html += '<div class="heart-block" style="border:1px solid var(--border-thin);border-radius:12px;padding:10px;margin-bottom:8px;background:#fafefc">';
      html += '<div style="font-size:.82rem;font-weight:600;margin-bottom:4px">' + escapeHtml(it.label) + '</div>';
      html += '<div style="font-size:.72rem;color:var(--muted);margin-bottom:6px">' + escapeHtml(it.opts || '') + '</div>';
      html += '<div class="chips" data-score-group="' + sec.id + '" data-score-key="' + it.id + '">';
      [0, 1, 2].forEach(function (n) {
        var cur = state.scores[sec.id] && state.scores[sec.id][it.id];
        var act = cur === n ? ' active' : '';
        html += '<button type="button" class="chip score' + act + '" data-val="' + n + '">' + n + '</button>';
      });
      html += '</div></div>';
    });
    html += '<div class="score-box" id="scorebox-' + sec.id + '"><div class="num">—</div><div class="band"></div><div class="pathway"></div></div>';
    return html;
  }

  function renderNihss() {
    var items = [
      ['loc', '1a LOC', ['0 Alert', '1 Not alert, arousable', '2 Not alert, obtunded', '3 Unresponsive']],
      ['locq', '1b LOC questions', ['0 Both correct', '1 One correct', '2 None']],
      ['locc', '1c LOC commands', ['0 Both', '1 One', '2 None']],
      ['gaze', '2 Best gaze', ['0 Normal', '1 Partial', '2 Forced']],
      ['visual', '3 Visual', ['0 None', '1 Partial', '2 Complete', '3 Bilateral']],
      ['facial', '4 Facial palsy', ['0 Normal', '1 Minor', '2 Partial', '3 Complete']],
      ['motorLarm', '5a Motor L arm', ['0 No drift', '1 Drift', '2 Some effort', '3 No effort', '4 No movement', 'UN Untestable']],
      ['motorRarm', '5b Motor R arm', ['0 No drift', '1 Drift', '2 Some effort', '3 No effort', '4 No movement', 'UN Untestable']],
      ['motorLleg', '6a Motor L leg', ['0 No drift', '1 Drift', '2 Some effort', '3 No effort', '4 No movement', 'UN Untestable']],
      ['motorRleg', '6b Motor R leg', ['0 No drift', '1 Drift', '2 Some effort', '3 No effort', '4 No movement', 'UN Untestable']],
      ['ataxia', '7 Limb ataxia', ['0 Absent', '1 One limb', '2 Two limbs', 'UN Untestable']],
      ['sensory', '8 Sensory', ['0 Normal', '1 Mild', '2 Severe']],
      ['language', '9 Best language', ['0 Normal', '1 Mild aphasia', '2 Severe', '3 Mute']],
      ['dysarthria', '10 Dysarthria', ['0 Normal', '1 Mild', '2 Severe', 'UN Untestable']],
      ['neglect', '11 Extinction/inattention', ['0 None', '1 Mild', '2 Profound']]
    ];
    var html = '<div class="sublabel">NIHSS full calculator <span class="ds" style="font-size:.62rem;font-weight:600;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;padding:2px 6px;border-radius:99px">Decision support</span></div>';
    items.forEach(function (it) {
      html += '<div class="nihss-item"><span class="lab">' + escapeHtml(it[1]) + '</span>';
      html += '<select data-field="nihss_' + it[0] + '"><option value="">—</option>';
      it[2].forEach(function (opt) {
        var m = opt.match(/^(\d+|UN)\s/);
        var v = m ? m[1] : opt;
        if (v === 'UN') v = '0'; // score UN as 0 for total but mark
        var num = opt.match(/^(\d+)/);
        var valN = num ? num[1] : '0';
        var sel = String(state['nihss_' + it[0]]) === valN ? ' selected' : '';
        html += '<option value="' + valN + '"' + sel + '>' + escapeHtml(opt) + '</option>';
      });
      html += '</select></div>';
    });
    return html;
  }

  function renderSection(sec) {
    if (sec.type === 'info') return '<div style="margin:8px 0">' + sec.html + '</div>';
    if (sec.type === 'nihss') return renderNihss();
    if (sec.type === 'score-group') return renderScoreGroup(sec);
    if (sec.type === 'chips') {
      var multi = sec.multi ? 'true' : 'false';
      var html = '<div class="sublabel">' + escapeHtml(sec.label) + '</div><div class="chips" data-chip-id="' + sec.id + '" data-multi="' + multi + '">';
      (sec.options || []).forEach(function (opt) {
        var v = opt.value, lab = opt.label || opt.value;
        var act = (state.chips[sec.id] || []).indexOf(v) >= 0 ? ' active' : '';
        var extra = '';
        if (String(lab).indexOf('Green') === 0) extra = ' tl-green';
        if (String(lab).indexOf('Amber') === 0) extra = ' tl-amber';
        if (String(lab).indexOf('Red') === 0) extra = ' tl-red';
        html += '<button type="button" class="chip' + extra + act + '" data-val="' + escapeHtml(v) + '">' + escapeHtml(lab) + '</button>';
      });
      return html + '</div>';
    }
    if (sec.type === 'checklist') {
      var html = '<div class="sublabel">' + escapeHtml(sec.label) + '</div><div class="checklist">';
      (sec.items || []).forEach(function (it) {
        var cid = sec.id + '_' + it.id;
        var checked = state[cid] || state.checks[cid] ? ' checked' : '';
        html += '<label class="check-row"><input type="checkbox" data-field="' + cid + '"' + checked + ' /> ' + escapeHtml(it.label) + '</label>';
      });
      return html + '</div>';
    }
    if (sec.type === 'textarea') {
      return '<label class="field">' + escapeHtml(sec.label) +
        '<textarea data-field="' + sec.id + '" placeholder="' + escapeHtml(sec.placeholder || '') + '">' +
        escapeHtml(state[sec.id] || '') + '</textarea></label>';
    }
    if (sec.type === 'select') {
      var html = '<label class="field">' + escapeHtml(sec.label) + '<select data-field="' + sec.id + '">';
      (sec.options || []).forEach(function (opt) {
        var v = typeof opt === 'string' ? opt : opt.value;
        var lab = typeof opt === 'string' ? (opt || 'Select') : (opt.label || opt.value);
        var sel = (state[sec.id] || '') === v ? ' selected' : '';
        html += '<option value="' + escapeHtml(v) + '"' + sel + '>' + escapeHtml(lab || 'Select') + '</option>';
      });
      return html + '</select></label>';
    }
    if (sec.type === 'date') {
      return '<label class="field">' + escapeHtml(sec.label) +
        '<input type="date" data-field="' + sec.id + '" value="' + escapeHtml(state[sec.id] || '') + '" /></label>';
    }
    if (sec.type === 'number') {
      return '<label class="field">' + escapeHtml(sec.label) +
        '<input type="number" data-field="' + sec.id + '" placeholder="' + escapeHtml(sec.placeholder || '') +
        '" value="' + escapeHtml(state[sec.id] || '') + '" /></label>';
    }
    // text default
    return '<label class="field">' + escapeHtml(sec.label) +
      '<input type="text" data-field="' + sec.id + '" placeholder="' + escapeHtml(sec.placeholder || '') +
      '" value="' + escapeHtml(state[sec.id] || '') + '" /></label>';
  }

  function renderExtraTimestamps(sc) {
    var box = $('scenarioTimestamps');
    if (!box) return;
    if (!sc || !sc.extraTs || !sc.extraTs.length) {
      box.innerHTML = '';
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    var html = '<h2 class="card-title">Scenario timestamps</h2>';
    sc.extraTs.forEach(function (t) {
      html += '<div class="ts-row"><span class="ts-label">' + escapeHtml(t.label) + '</span>';
      html += '<input type="datetime-local" data-field="' + t.id + '" id="' + t.id + '" value="' + escapeHtml(state[t.id] || '') + '" />';
      html += '<button type="button" class="btn-now" data-ts="' + t.id + '">Now</button></div>';
    });
    box.innerHTML = html;
  }

  function renderScenario() {
    var sc = currentScenario();
    var host = $('scenarioBody');
    var title = $('scenarioTitle');
    if (!sc) {
      host.innerHTML = '<p style="color:var(--muted);margin:0">Select a clinical scenario above to load its template.</p>';
      title.textContent = 'Scenario details';
      renderExtraTimestamps(null);
      updateComputes();
      return;
    }
    title.textContent = sc.title;
    var html = '';
    (sc.sections || []).forEach(function (sec) {
      html += '<div style="margin-bottom:10px">' + renderSection(sec) + '</div>';
    });
    html += '<div class="alert danger" id="scenarioFlags"></div>';
    html += '<div class="metric-badges" id="scenarioMetrics"></div>';
    html += '<div id="scenarioScores"></div>';
    host.innerHTML = html;
    renderExtraTimestamps(sc);
    bindDynamicHandlers();
    updateComputes();
  }

  function bindDynamicHandlers() {
    document.querySelectorAll('.chips[data-chip-id]').forEach(function (group) {
      group.onclick = function (e) {
        var chip = e.target.closest('.chip');
        if (!chip || state.locked) return;
        var id = group.getAttribute('data-chip-id');
        var multi = group.getAttribute('data-multi') === 'true';
        var v = chip.getAttribute('data-val');
        state.chips[id] = state.chips[id] || [];
        if (multi) {
          var ix = state.chips[id].indexOf(v);
          if (ix >= 0) state.chips[id].splice(ix, 1);
          else state.chips[id].push(v);
          if (id === 'cp_radiation') {
            if (v === 'None' && state.chips[id].indexOf('None') >= 0)
              state.chips[id] = ['None'];
            else state.chips[id] = state.chips[id].filter(function (x) { return x !== 'None'; });
          }
        } else {
          state.chips[id] = state.chips[id][0] === v ? [] : [v];
        }
        // re-render chips active state
        group.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('active', state.chips[id].indexOf(c.getAttribute('data-val')) >= 0);
        });
        onChange();
      };
    });
    document.querySelectorAll('.chips[data-score-group]').forEach(function (group) {
      group.onclick = function (e) {
        var chip = e.target.closest('.chip');
        if (!chip || state.locked) return;
        var gid = group.getAttribute('data-score-group');
        var key = group.getAttribute('data-score-key');
        var n = parseInt(chip.getAttribute('data-val'), 10);
        state.scores[gid] = state.scores[gid] || {};
        if (state.scores[gid][key] === n) delete state.scores[gid][key];
        else state.scores[gid][key] = n;
        if (gid === 'heart' && key === 'A') state._autoHeartA = false;
        if (gid === 'heart' && key === 'R') state._autoHeartR = false;
        group.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('active', parseInt(c.getAttribute('data-val'), 10) === state.scores[gid][key]);
        });
        onChange();
      };
    });
    document.querySelectorAll('[data-field]').forEach(function (el) {
      el.oninput = el.onchange = function () {
        if (el.type === 'checkbox') state[el.getAttribute('data-field')] = el.checked;
        else state[el.getAttribute('data-field')] = el.value;
        onChange();
      };
    });
    document.querySelectorAll('.btn-now').forEach(function (btn) {
      btn.onclick = function () {
        if (state.locked) return;
        var id = btn.getAttribute('data-ts');
        var v = nowLocal();
        setVal(id, v);
        var inp = document.querySelector('[data-field="' + id + '"]') || $(id);
        if (inp) inp.value = v;
        state[id] = v;
        onChange();
      };
    });
    var est = $('btnEstWeight');
    if (est) {
      est.onclick = function () {
        var ageY = parseFloat(state.age || val('age'));
        var ageMo = parseFloat(state.ped_age_mo);
        if (isNaN(ageMo) && !isNaN(ageY)) ageMo = ageY * 12;
        if (isNaN(ageMo)) { alert('Enter age (years in header or months in scenario)'); return; }
        // APLS: (age_years * 2) + 8 for 1-5; neonates separate — simple formula
        var ageYears = ageMo / 12;
        var w;
        if (ageMo < 12) w = Math.round((ageMo / 2 + 4) * 10) / 10;
        else w = Math.round((ageYears * 2 + 8) * 10) / 10;
        state.ped_weight = String(w);
        var inp = document.querySelector('[data-field="ped_weight"]');
        if (inp) inp.value = state.ped_weight;
        onChange();
      };
    }
  }

  function updateComputes() {
    gatherFieldState();
    // sync age into state for compute
    state.age = val('age');
    state.sex = val('sex');
    state.hr = val('hr');
    state.bpRight = val('bpRight');
    state.arrival = val('arrival');
    var sc = currentScenario();
    var flagsEl = $('scenarioFlags');
    var metricsEl = $('scenarioMetrics');
    var scoresEl = $('scenarioScores');
    if (!sc || !sc.compute) {
      if (flagsEl) { flagsEl.classList.remove('on'); flagsEl.innerHTML = ''; }
      if (metricsEl) metricsEl.innerHTML = '';
      if (scoresEl) scoresEl.innerHTML = '';
      updateSharedMetrics();
      updateProgress();
      saveState();
      return;
    }
    var result = sc.compute(state, getChips) || {};
    if (flagsEl) {
      if (result.flags && result.flags.length) {
        flagsEl.innerHTML = result.flags.map(escapeHtml).join('<br>');
        flagsEl.classList.add('on');
      } else { flagsEl.classList.remove('on'); flagsEl.innerHTML = ''; }
    }
    if (metricsEl) {
      metricsEl.innerHTML = (result.metrics || []).map(function (m) {
        return '<span class="badge' + (m.danger ? ' danger' : '') + '">' + escapeHtml(m.text) + '</span>';
      }).join('');
    }
    // update score boxes inside scenario
    (result.scores || []).forEach(function (s) {
      var box = $('scorebox-' + s.id);
      if (!box) {
        // create in scenarioScores area
        return;
      }
      box.className = 'score-box' + (s.cls ? ' ' + s.cls : '');
      box.innerHTML = '<div class="num">' + (s.total == null ? '—' : s.total) + '</div>' +
        '<div class="band">' + escapeHtml(s.band || '') + '</div>' +
        '<div class="pathway">' + escapeHtml(s.pathway || 'Decision support — clinical judgement prevails.') + '</div>';
    });
    if (scoresEl) {
      var extras = (result.scores || []).filter(function (s) { return !$('scorebox-' + s.id); });
      scoresEl.innerHTML = extras.map(function (s) {
        return '<div class="score-box' + (s.cls ? ' ' + s.cls : '') + '"><div class="num">' +
          (s.total == null ? '—' : s.total) + '</div><div class="band">' + escapeHtml(s.band || '') +
          '</div><div class="pathway">' + escapeHtml(s.pathway || '') + '</div></div>';
      }).join('');
    }
    // re-sync heart score chips if auto-updated
    if (sc.id === 'chest-pain' && state.scores.heart) {
      document.querySelectorAll('.chips[data-score-group="heart"]').forEach(function (group) {
        var key = group.getAttribute('data-score-key');
        group.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('active', parseInt(c.getAttribute('data-val'), 10) === state.scores.heart[key]);
        });
      });
      var box = $('scorebox-heart');
      var hs = (result.scores || []).filter(function (x) { return x.id === 'heart'; })[0];
      if (box && hs) {
        box.className = 'score-box' + (hs.cls ? ' ' + hs.cls : '');
        box.innerHTML = '<div class="num">' + (hs.total == null ? '—' : hs.total) + '</div>' +
          '<div class="band">' + escapeHtml(hs.band || '') + '</div>' +
          '<div class="pathway">' + escapeHtml(hs.pathway || '') + '</div>';
      }
    }
    state._dischargeWarn = !!result.dischargeWarn;
    updateSharedMetrics();
    updateDispositionWarn();
    updateProgress();
    saveState();
  }

  function updateSharedMetrics() {
    var arrival = val('arrival');
    var doc = val('tsDoctor');
    var html = '';
    var d2d = minutesBetween(arrival, doc);
    if (d2d != null) html += '<span class="badge">Door-to-doctor: ' + d2d + ' min</span>';
    var r = null, l = null;
    var m1 = String(val('bpRight') || '').match(/(\d+)\s*\//);
    var m2 = String(val('bpLeft') || '').match(/(\d+)\s*\//);
    if (m1) r = parseInt(m1[1], 10);
    if (m2) l = parseInt(m2[1], 10);
    var bpAlert = $('bpDiffAlert');
    if (bpAlert) {
      if (r != null && l != null && Math.abs(r - l) > 20) {
        bpAlert.textContent = 'Inter-arm SBP difference ' + Math.abs(r - l) + ' mmHg (>20).';
        bpAlert.classList.add('on');
      } else { bpAlert.classList.remove('on'); bpAlert.textContent = ''; }
    }
    var el = $('doorMetrics');
    if (el) el.innerHTML = html;
  }

  function updateDispositionWarn() {
    var d = (state.chips.disposition || [])[0] || '';
    $('dispDischarge').classList.toggle('on', d === 'Discharge');
    $('dispLama').classList.toggle('on', d === 'LAMA/DAMA');
    $('dispTransfer').classList.toggle('on', d === 'Referred/transferred');
    var warn = $('dispWarn');
    var msgs = [];
    if (d === 'Discharge' && state._dischargeWarn)
      msgs.push('Caution: high-risk features for discharge in current scenario (score / ECG / labs).');
    if (msgs.length) { warn.innerHTML = msgs.join('<br>'); warn.classList.add('on'); }
    else { warn.classList.remove('on'); warn.innerHTML = ''; }
  }

  function updateProgress() {
    var checks = [
      !!val('uhid'), !!val('ptName'), !!val('age'), !!val('sex'), !!val('arrival'),
      !!val('triage'), !!(val('allergies') || ($('nkdaChip') && $('nkdaChip').classList.contains('active'))),
      !!val('mlc'), !!state.scenarioId,
      !!((state.chips.disposition || [])[0]),
      !!val('docName') && !!val('docDesig') && !!val('docReg')
    ];
    var done = checks.filter(Boolean).length;
    var pct = Math.round((done / checks.length) * 100);
    $('progressPct').textContent = pct + '%';
    $('progressFill').style.width = pct + '%';
    var hdrOk = val('uhid') && val('ptName') && val('age') && val('sex') && val('arrival') && val('triage') && val('mlc') &&
      (val('allergies') || ($('nkdaChip') && $('nkdaChip').classList.contains('active')));
    $('card-header').classList.toggle('mandatory-empty', !hdrOk);
  }

  function onChange() {
    if (state.locked) { saveState(); return; }
    updateComputes();
  }

  function validate() {
    var missing = [];
    if (!val('uhid')) missing.push('UHID / MRN');
    if (!val('ptName')) missing.push('Patient name');
    if (!val('age')) missing.push('Age');
    if (!val('sex')) missing.push('Sex');
    if (!val('arrival')) missing.push('Arrival date & time');
    if (!val('triage')) missing.push('Triage category');
    if (!val('allergies') && !($('nkdaChip') && $('nkdaChip').classList.contains('active')))
      missing.push('Allergies (or NKDA)');
    if (!val('mlc')) missing.push('MLC status');
    if (!state.scenarioId) missing.push('Clinical scenario');
    if (!val('docName')) missing.push('Doctor name');
    if (!val('docDesig')) missing.push('Designation');
    if (!val('docReg')) missing.push('Registration number');
    var disp = (state.chips.disposition || [])[0];
    if (!disp) missing.push('Disposition');
    if (disp === 'Discharge') {
      if (!$('dcPrecautions').checked) missing.push('Discharge: return precautions');
      if (!$('dcFollowup').checked) missing.push('Discharge: follow-up plan');
      if (!$('dcInstructions').checked) missing.push('Discharge: instructions given');
    }
    if (disp === 'LAMA/DAMA') {
      if (!$('lamaRisks').checked) missing.push('LAMA: risks explained');
      if (!val('lamaName')) missing.push('LAMA: name');
      if (!val('lamaRel')) missing.push('LAMA: relationship');
      if (!val('lamaWitness')) missing.push('LAMA: witness');
      if (!$('lamaSign').checked) missing.push('LAMA: signature obtained');
    }
    if (disp === 'Referred/transferred') {
      if (!val('xferFacility')) missing.push('Transfer: facility');
      if (!val('xferReason')) missing.push('Transfer: reason');
      if (!val('xferCondition')) missing.push('Transfer: condition');
      if (!$('xferHandover').checked) missing.push('Transfer: handover');
    }
    return missing;
  }

  function pushTx(L, chk, name, doseId, timeId) {
    var c = $(chk);
    var dose = val(doseId), time = val(timeId);
    if (!(c && c.checked) && !dose && !time) return;
    var s = name;
    if (dose) s += ' — ' + dose;
    if (time) s += ' at ' + fmtDisplay(time);
    L.push(s);
  }

  function generateNote() {
    gatherFieldState();
    var L = [];
    L.push('══════════════════════════════════════');
    L.push('EMERGENCY DEPARTMENT CLINICAL NOTE');
    L.push('ED EMR Suite — NABH-friendly documentation aid');
    L.push('══════════════════════════════════════');
    L.push('');
    L.push('PATIENT DETAILS');
    L.push('---------------');
    L.push('UHID: ' + (val('uhid') || '—'));
    L.push('Name: ' + (val('ptName') || '—'));
    L.push('Age / Sex: ' + (val('age') || '—') + ' years / ' + (val('sex') || '—'));
    L.push('Arrival: ' + fmtDisplay(val('arrival')));
    L.push('Triage: ' + (val('triage') || '—'));
    var allg = val('allergies') || (($('nkdaChip') && $('nkdaChip').classList.contains('active')) ? 'NKDA' : '—');
    L.push('Allergies: ' + allg);
    L.push('MLC: ' + (val('mlc') || '—'));
    L.push('');
    L.push('TIME STAMPS');
    L.push('-----------');
    L.push('Doctor seen: ' + fmtDisplay(val('tsDoctor')));
    L.push('Decision: ' + fmtDisplay(val('tsDecision')));
    L.push('Disposition time: ' + fmtDisplay(val('tsDisposition')));
    var d2d = minutesBetween(val('arrival'), val('tsDoctor'));
    if (d2d != null) L.push('Door-to-doctor: ' + d2d + ' minutes');
    var sc = currentScenario();
    if (sc && sc.extraTs) {
      sc.extraTs.forEach(function (t) {
        L.push(t.label + ': ' + fmtDisplay(state[t.id] || ''));
      });
    }
    L.push('');
    L.push('VITALS');
    L.push('------');
    var pain = ($('pain') && $('pain').value) || val('pain') || '0';
    L.push('HR ' + (val('hr') || '—') + '/min; BP R ' + (val('bpRight') || '—') + ', L ' + (val('bpLeft') || '—') +
      '; RR ' + (val('rr') || '—') + '; SpO₂ ' + (val('spo2') || '—') + '%; Temp ' + (val('temp') || '—') +
      '°C; GCS ' + (val('gcs') || '—') + '; CBG ' + (val('cbg') || '—') + '; Pain ' + pain + '/10');
    L.push('');
    if (sc && typeof sc.note === 'function') {
      L.push(sc.note(state, getChips, joinList));
    } else {
      L.push('SCENARIO: ' + (sc ? sc.title : 'Not selected'));
    }
    L.push('');
    L.push('TREATMENT');
    L.push('---------');
    var before = L.length;
    pushTx(L, 'txAspChk', 'Aspirin', 'txAspDose', 'txAspTime');
    pushTx(L, 'txP2yChk', 'P2Y12 inhibitor', 'txP2yDose', 'txP2yTime');
    pushTx(L, 'txAcChk', 'Anticoagulant', 'txAcDose', 'txAcTime');
    pushTx(L, 'txNitChk', 'Nitrate', 'txNitDose', 'txNitTime');
    pushTx(L, 'txAnalChk', 'Analgesia', 'txAnalDose', 'txAnalTime');
    pushTx(L, 'txO2Chk', 'Oxygen', 'txO2Dose', 'txO2Time');
    pushTx(L, 'txOthChk', 'Other', 'txOthDose', 'txOthTime');
    if (L.length === before) L.push('None documented in shared treatment panel');
    if (val('dxText')) {
      L.push('');
      L.push('ADDITIONAL IMPRESSION');
      L.push(val('dxText'));
    }
    L.push('');
    L.push('DISPOSITION');
    L.push('-----------');
    var disp = (state.chips.disposition || [])[0] || '—';
    L.push(disp);
    if (disp === 'Discharge') {
      L.push('Return precautions: ' + ($('dcPrecautions').checked ? 'Yes' : 'No'));
      L.push('Follow-up plan: ' + ($('dcFollowup').checked ? 'Yes' : 'No'));
      L.push('Instructions given: ' + ($('dcInstructions').checked ? 'Yes' : 'No'));
      if (val('dcDetail')) L.push(val('dcDetail'));
    }
    if (disp === 'LAMA/DAMA') {
      L.push("Risks explained in patient's language: " + ($('lamaRisks').checked ? 'Yes' : 'No'));
      L.push('Patient/relative: ' + (val('lamaName') || '—') + ' (' + (val('lamaRel') || '—') + ')');
      L.push('Witness: ' + (val('lamaWitness') || '—'));
      L.push('Signature obtained: ' + ($('lamaSign').checked ? 'Yes' : 'No'));
    }
    if (disp === 'Referred/transferred') {
      L.push('Receiving facility: ' + (val('xferFacility') || '—'));
      L.push('Reason: ' + (val('xferReason') || '—'));
      L.push('Condition: ' + (val('xferCondition') || '—'));
      L.push('Handover given: ' + ($('xferHandover').checked ? 'Yes' : 'No'));
    }
    L.push('');
    L.push('SIGN-OFF');
    L.push('--------');
    L.push((val('docName') || '—') + ', ' + (val('docDesig') || '—'));
    L.push('Reg. No.: ' + (val('docReg') || '—'));
    L.push('Signed: ' + fmtDisplay(val('docSignTime') || (state.locked ? nowLocal() : '')));
    if (state.locked) L.push('Status: SIGNED & LOCKED');
    if (state.addenda && state.addenda.length) {
      L.push('');
      L.push('ADDENDA');
      L.push('-------');
      state.addenda.forEach(function (a, i) {
        L.push((i + 1) + '. [' + fmtDisplay(a.time) + '] ' + a.text);
      });
    }
    L.push('');
    L.push('— End of note —');
    L.push('Scores and pathways are decision support — clinical judgement prevails.');
    L.push('No patient data left this device during generation.');
    return L.join('\n');
  }

  function showModal(id) { $(id).classList.add('on'); }
  function hideModal(id) { $(id).classList.remove('on'); }

  function openGenerate(force) {
    var missing = validate();
    if (!force && missing.length) {
      $('validationContent').innerHTML =
        '<p style="margin:0 0 8px;font-weight:600;color:#991b1b">Missing mandatory / required fields:</p>' +
        '<ul class="validation-list">' + missing.map(function (m) { return '<li>' + escapeHtml(m) + '</li>'; }).join('') + '</ul>' +
        '<p style="margin:12px 0 0;font-size:.85rem;color:var(--muted)">Complete for NABH-friendly note, or generate anyway.</p>';
      showModal('modalValidate');
      return;
    }
    hideModal('modalValidate');
    $('notePreview').textContent = generateNote();
    showModal('modalNote');
  }

  function setLocked(on) {
    state.locked = on;
    document.body.classList.toggle('locked', on);
    $('lockBadge').classList.toggle('on', on);
    $('btnLock').style.display = on ? 'none' : 'inline-block';
    $('btnUnlock').style.display = on ? 'inline-block' : 'none';
    saveState();
  }

  function renderAddenda() {
    $('addendumList').innerHTML = (state.addenda || []).map(function (a, i) {
      return '<div style="padding:8px;border:1px solid var(--border-thin);border-radius:8px;margin-bottom:6px"><strong>#' +
        (i + 1) + '</strong> · ' + fmtDisplay(a.time) + '<br>' + escapeHtml(a.text) + '</div>';
    }).join('');
  }

  function collectState() {
    gatherFieldState();
    var fields = {};
    document.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (!el.id && !el.getAttribute('data-field')) return;
      var key = el.id || el.getAttribute('data-field');
      fields[key] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return {
      scenarioId: state.scenarioId,
      chips: state.chips,
      scores: state.scores,
      fields: fields,
      extras: state,
      locked: state.locked,
      addenda: state.addenda,
      _autoHeartA: state._autoHeartA,
      _autoHeartR: state._autoHeartR
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
    } catch (e) { /* ignore */ }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      state.scenarioId = s.scenarioId || null;
      state.chips = s.chips || {};
      state.scores = s.scores || {};
      state.addenda = s.addenda || [];
      state._autoHeartA = s._autoHeartA !== false;
      state._autoHeartR = s._autoHeartR !== false;
      if (s.fields) {
        Object.keys(s.fields).forEach(function (k) {
          state[k] = s.fields[k];
          var el = $(k) || document.querySelector('[data-field="' + k + '"]');
          if (!el) return;
          if (el.type === 'checkbox') el.checked = !!s.fields[k];
          else el.value = s.fields[k] == null ? '' : s.fields[k];
        });
      }
      if (s.extras) {
        Object.keys(s.extras).forEach(function (k) {
          if (typeof s.extras[k] !== 'object' || s.extras[k] === null)
            state[k] = s.extras[k];
        });
      }
      if (state.triage) {
        $('triage').value = state.triage;
        document.querySelectorAll('#triageChips .chip').forEach(function (c) {
          c.classList.toggle('active', c.getAttribute('data-val') === state.triage);
        });
      }
      if ((state.allergies || '').toUpperCase() === 'NKDA') $('nkdaChip').classList.add('active');
      if ($('pain') && state.pain != null) { $('pain').value = state.pain; $('painVal').textContent = state.pain; }
      renderAddenda();
      if (s.locked) setLocked(true);
    } catch (e) { console.warn(e); }
  }

  function selectScenario(id) {
    state.scenarioId = id;
    renderPicker();
    renderScenario();
    saveState();
  }

  function bindShared() {
    $('scenarioGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-scenario]');
      if (!b || state.locked) return;
      selectScenario(b.getAttribute('data-scenario'));
    });

    $('triageChips').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip || state.locked) return;
      var was = chip.classList.contains('active');
      $('triageChips').querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
      if (!was) { chip.classList.add('active'); $('triage').value = chip.getAttribute('data-val'); }
      else $('triage').value = '';
      state.triage = $('triage').value;
      onChange();
    });

    $('nkdaChip').addEventListener('click', function () {
      if (state.locked) return;
      this.classList.toggle('active');
      if (this.classList.contains('active')) { $('allergies').value = 'NKDA'; state.allergies = 'NKDA'; }
      else if (val('allergies') === 'NKDA') { $('allergies').value = ''; state.allergies = ''; }
      onChange();
    });

    document.querySelectorAll('.btn-now[data-ts]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var id = btn.getAttribute('data-ts');
        setVal(id, nowLocal());
        var chkMap = {
          txAspTime: 'txAspChk', txP2yTime: 'txP2yChk', txAcTime: 'txAcChk',
          txNitTime: 'txNitChk', txAnalTime: 'txAnalChk', txO2Time: 'txO2Chk', txOthTime: 'txOthChk'
        };
        if (chkMap[id] && $(chkMap[id])) $(chkMap[id]).checked = true;
        onChange();
      });
    });

    // disposition chips
    document.querySelector('.chips[data-chip-id="disposition"]').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip || state.locked) return;
      var v = chip.getAttribute('data-val');
      var cur = (state.chips.disposition || [])[0];
      state.chips.disposition = cur === v ? [] : [v];
      this.querySelectorAll('.chip').forEach(function (c) {
        c.classList.toggle('active', (state.chips.disposition || [])[0] === c.getAttribute('data-val'));
      });
      onChange();
    });

    $('pain').addEventListener('input', function () {
      $('painVal').textContent = this.value;
      state.pain = this.value;
      onChange();
    });

    document.getElementById('sharedFields').addEventListener('input', onChange);
    document.getElementById('sharedFields').addEventListener('change', onChange);

    document.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { hideModal(btn.getAttribute('data-close')); });
    });
    document.querySelectorAll('.modal-backdrop').forEach(function (bd) {
      bd.addEventListener('click', function (e) { if (e.target === bd) bd.classList.remove('on'); });
    });

    $('btnValidate').addEventListener('click', function () {
      var missing = validate();
      if (!missing.length) {
        $('validationContent').innerHTML = '<p style="margin:0;font-weight:600;color:#047857">All mandatory fields complete.</p>';
      } else {
        $('validationContent').innerHTML = '<p style="margin:0 0 8px;font-weight:600;color:#991b1b">Missing:</p><ul class="validation-list">' +
          missing.map(function (m) { return '<li>' + escapeHtml(m) + '</li>'; }).join('') + '</ul>';
      }
      showModal('modalValidate');
    });
    $('btnGenerate').addEventListener('click', function () { openGenerate(false); });
    $('btnGenFromValidate').addEventListener('click', function () { openGenerate(true); });

    $('btnCopy').addEventListener('click', function () {
      var text = $('notePreview').textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          $('btnCopy').textContent = 'Copied!';
          setTimeout(function () { $('btnCopy').textContent = 'Copy'; }, 1500);
        }).catch(function () { fallbackCopy(text); });
      } else fallbackCopy(text);
    });
    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      $('btnCopy').textContent = 'Copied!';
      setTimeout(function () { $('btnCopy').textContent = 'Copy'; }, 1500);
    }
    $('btnDownload').addEventListener('click', function () {
      var blob = new Blob([$('notePreview').textContent], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = ((val('uhid') || 'ed-note') + '_' + (state.scenarioId || 'note') + '.txt').replace(/[^\w.\-]+/g, '_');
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $('btnPrint').addEventListener('click', function () { window.print(); });

    $('btnLock').addEventListener('click', function () {
      var missing = [];
      if (!val('docName')) missing.push('Doctor name');
      if (!val('docDesig')) missing.push('Designation');
      if (!val('docReg')) missing.push('Registration number');
      if (missing.length) { alert('Cannot lock — missing: ' + missing.join(', ')); return; }
      if (!val('docSignTime')) setVal('docSignTime', nowLocal());
      setLocked(true);
    });
    $('btnUnlock').addEventListener('click', function () {
      if (confirm('Unlock signed note? Prefer addendum for audit trail.')) setLocked(false);
    });
    $('btnAddendum').addEventListener('click', function () {
      var t = val('addendumText') || ($('addendumText') && $('addendumText').value);
      if (!t || !String(t).trim()) { alert('Enter addendum text'); return; }
      state.addenda.push({ time: nowLocal(), text: String(t).trim() });
      $('addendumText').value = '';
      renderAddenda();
      saveState();
    });
    $('btnNew').addEventListener('click', function () {
      if (!confirm('Clear all fields for a new patient?')) return;
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }

  function init() {
    if (!window.ED_SCENARIOS || !window.ED_SCENARIOS.length) {
      console.error('No scenarios loaded');
    }
    if (!val('arrival') && $('arrival')) $('arrival').value = nowLocal();
    loadState();
    // restore disposition chip UI
    var dispGroup = document.querySelector('.chips[data-chip-id="disposition"]');
    if (dispGroup) {
      dispGroup.querySelectorAll('.chip').forEach(function (c) {
        c.classList.toggle('active', (state.chips.disposition || [])[0] === c.getAttribute('data-val'));
      });
    }
    renderPicker();
    renderScenario();
    bindShared();
    updateProgress();
    updateDispositionWarn();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // expose for tests
  window.ED_APP = {
    selectScenario: selectScenario,
    generateNote: generateNote,
    validate: validate,
    getState: function () { return state; },
    currentScenario: currentScenario
  };
})();
