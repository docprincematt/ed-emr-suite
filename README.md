# ED EMR Suite

Offline Emergency Department documentation suite for Indian ED workflows (NABH/JCI-friendly), ErMate-inspired mint/emerald UI.

## Quick start

**Easiest:** double-click `index.html` (fully self-contained — CSS + JS inlined). Works offline.

Optional modular entry (same folder required):

```bash
# open modular build (loads assets/)
xdg-open index.modular.html
```

Local server (optional):

```bash
python3 -m http.server 8080 --directory /path/to/ed-emr-suite
```

## Phone use

1. Copy the whole `ed-emr-suite` folder (or at least `index.html`) to the phone.
2. Open `index.html` in Chrome / Safari / Edge.
3. Add to Home Screen if desired.
4. Data stays in that browser’s `localStorage` (`edEmrSuite_v1`).

## Intranet hosting

1. Drop the folder on any static host (Nginx, IIS, Apache, NAS).
2. No backend or database required.
3. Edit print header `[Hospital Name]` in `index.html`.
4. Paste generated notes into the hospital EMR per policy.

## Scenarios (17)

1. Chest pain / ACS — HEART, door-to-ECG  
2. Trauma (ATLS) — MIST, cABCDE, GCS, eFAST, shock index, MLC  
3. Sepsis — qSOFA, SIRS, lactate, hour-1 bundle, 30 ml/kg  
4. Shortness of breath — CURB-65, Wells PE, PERC, ABG, NIV  
5. Stroke / TIA — LKW window, door-to-CT, NIHSS, ABCD², thrombolysis contraindications  
6. Abdominal pain — Alvarado, surgical red flags, UPT, POCUS  
7. AMS / Poisoning — AEIOU-TIPS, toxidromes, OP, antidotes, MLC  
8. Paediatric fever — weight estimate, NICE traffic light, PAT, dose guides  
9. OB / Gyn — LMP→GA/EDD, ectopic, PPH/eclampsia, MEOWS-style  
10. Syncope — San Francisco Syncope Rule (CHESS)  
11. Seizure  
12. Headache — red flags, Ottawa SAH  
13. DKA / Hyperglycaemia — pH/HCO₃/ketones, fluid & insulin checklist  
14. Allergy / Anaphylaxis — adrenaline IM by weight  
15. Snake bite — 20-min WBCT, ASV, neuro/haemotoxic (Indian context)  
16. Minor injury / Laceration — wound, tetanus  
17. Fever / Dengue / Malaria — warning signs, tropical workup  

All scores are labelled **decision support — clinical judgement prevails**.

## Shared features

- Patient header, triage, allergies, MLC  
- Shared + scenario timestamps with “Now”  
- Vitals (bilateral BP alert)  
- Scenario chip grid  
- Shared treatment panel  
- Disposition logic (Discharge / LAMA / Transfer checklists)  
- Sign & lock + timed addenda  
- Validate → Generate note (Copy / Download / Print)  
- Autosave per browser profile  

## Files

| Path | Role |
|------|------|
| `index.html` | **Use this** — single-file offline app |
| `index.modular.html` | Multi-file entry (needs `assets/`) |
| `index.single.html` | Duplicate of bundled `index.html` |
| `assets/app.css` | Styles (source) |
| `assets/app.js` | Core app (source) |
| `assets/scenarios.js` | Scenario modules (source) |
| `README.md` | This file |

After editing `assets/*`, rebuild the bundled `index.html` by inlining CSS/JS (or use `index.modular.html` while developing).

## How to add a new scenario module

1. Open `assets/scenarios.js`.
2. `window.ED_SCENARIOS.push({ ... })` with:
   - `id`, `title`, `short`
   - `extraTs` — optional timestamp fields
   - `sections` — use helpers `scChip`, `scText`, `scNum`, `scSelect`, `scArea`, `scScore`, `scChecklist`, `scInfo`
   - `compute(state, getChips)` — return `{ flags, scores, metrics, dischargeWarn }`
   - `note(state, getChips, join)` — return scenario narrative string
3. Keep score pathway text: `Decision support — clinical judgement prevails.`
4. Re-bundle into `index.html` if you distribute the single file:

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('ed-emr-suite')  # adjust path
css = (root/'assets/app.css').read_text()
sc = (root/'assets/scenarios.js').read_text()
app = (root/'assets/app.js').read_text()
html = (root/'index.modular.html').read_text()
out = (html
  .replace('<link rel="stylesheet" href="assets/app.css" />', '<style>\n'+css+'\n</style>')
  .replace('<script src="assets/scenarios.js"></script>\n<script src="assets/app.js"></script>',
           '<script>\n'+sc+'\n</script>\n<script>\n'+app+'\n</script>'))
(root/'index.html').write_text(out)
print('rebuilt')
PY
```

5. Smoke-test: open the app, select the new scenario, Generate note.

## Privacy

Patient data never leaves the device. Clear site data or use **New patient** on shared workstations.

## Requirements

Modern browser (Chrome, Edge, Firefox, Safari). No internet required after files are local.
