# Strategy Brief Template

Use this template when the playground is a **document to be read and decided on**, not a control panel: roadmaps, architecture/strategy explorations, build-vs-buy analyses, post-incident proposals, option matrices. The reader scrolls a narrative top-to-bottom; interactivity serves comprehension (sort, filter, spotlight), not configuration.

This genre differs from the other templates: there is no live-preview pane and the "prompt output" is optional — the deliverable is the brief itself.

## Layout

```
+----------+--------------------------------------------+
| sticky   |  badges row · h1 (gradient) · lede          |
| left nav |  thesis callout · KPI strip                 |
| (scroll- |--------------------------------------------|
|  spy)    |  numbered sections, each one screen-ish:    |
|          |   1. before/after split (.vs)               |
|          |   2. timeline / roadmap (mermaid gantt)     |
|          |   3. flow diagram (mermaid flowchart)       |
|          |   4. sortable verdict matrix + filter chips |
|          |   5. card grids (tasks, risks, issues)      |
|          |   N. open questions + provenance footer     |
+----------+--------------------------------------------+
```

## Signature components

| Component | Purpose | Pattern |
|---|---|---|
| Sticky nav + scroll-spy | orient in a long doc | `nav a.active` set on scroll via `getBoundingClientRect().top > 120` walk |
| Badge/pill row | context at a glance (trigger, date, owners, status) | `.pill` rounded chips under the h1 |
| Thesis callout | the one-paragraph "so what" up top | `.callout` teal left-border; `.warn` amber for the recommendation; `.red` for the gating constraint |
| KPI strip | 4-6 numbers that frame scale | `.kpi .k` cards: big value + tiny label, color-coded |
| Before/after split | show the correction or delta | `.vs` two-column grid, red-tinted `before` / teal-tinted `after` |
| Numbered h2 chips | walkable section order | `h2 > span.n` colored square with the section number |
| Verdict matrix | compare N options/areas | sortable `<table>` (th `data-k` keys) + filter chips + `.vb` verdict badges (`v-use` green / `v-consider` amber / `v-avoid` red) |
| Card grids | tasks, risks, filed issues | `.grid2`/`.grid3` of `.card`, each with a status badge |
| Open-question form | capture the decider's answers, not just pose questions | one `.qf` block per question: selectable option chips (one may carry a `recommended` tag and start pre-selected), a free-text write-in, and a copy-button "decision reply" assembled from the selections (see below) |
| Provenance footer | how this brief was made, links to companions | `footer` with pipeline summary + source links |

## Mermaid (the one allowed external dep)

Diagrams (gantt timelines, flowcharts with decision gates) carry the roadmap story better than hand-built SVG at this density. Load from CDN **with an offline fallback**:

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
...
<script>
if (window.mermaid) {
  mermaid.initialize({startOnLoad:true, theme:"dark", securityLevel:"loose",
    themeVariables:{fontSize:"13px", fontFamily:"-apple-system,Segoe UI,Roboto,sans-serif"},
    gantt:{barHeight:22, barGap:6, topPadding:46, leftPadding:120}});
} else { // CDN down → show readable source instead of a blank box
  document.querySelectorAll(".mermaid").forEach(d=>{
    d.style.whiteSpace="pre"; d.style.fontFamily="monospace";
    d.insertAdjacentHTML("afterbegin",
      "<div style='color:#d29922;font-size:12px'>⚠ offline — showing diagram source</div>");
  });
}
</script>
```

**Semantic classDefs** — color nodes by *meaning*, then explain in a legend line:

```
classDef new   fill:#0f2a27,stroke:#2dd4bf,color:#aef5ec,stroke-width:2px   %% net-new build
classDef edit  fill:#2a230f,stroke:#d29922,color:#f5e6c0                    %% modify / human work
classDef reuse fill:#11203a,stroke:#388bfd,color:#cfe2ff                    %% existing, reuse as-is
classDef gate  fill:#1a1420,stroke:#a371f7,color:#e7d9ff,stroke-dasharray:4 3 %% human/decision gate
```

Use `gantt` with `:crit` markers for the critical path; `flowchart LR` with diamond `{...}` gate nodes for ramps and decision sequences.

## Sortable verdict matrix

```javascript
const DATA = [ {name, kind, fit, ..., verdict:"use"|"consider"|"avoid"}, ... ];
let sortKey="fit", sortDir=-1, filter="all";
function render(){
  let rows = DATA.filter(d => filter==="all" || d.verdict===filter);
  rows.sort((a,b)=>{ let x=a[sortKey], y=b[sortKey];
    if(typeof x==="string") return sortDir*x.localeCompare(y);
    return sortDir*(x-y); });
  tbody.innerHTML = rows.map(d => `<tr>...</tr>`).join("");
}
// th click → toggle direction or switch key; chip click → set filter; both re-render
```

Verdict labels are domain-specific: use/consider/avoid for vendor matrices; shipped/partial/net-new for capability maps; keep the same three-color scale.

## Scroll-spy nav

```javascript
const navLinks=[...document.querySelectorAll("nav a")];
const secs=navLinks.map(a=>document.querySelector(a.getAttribute("href")));
function spy(){ let i=secs.length-1;
  for(let j=0;j<secs.length;j++){ if(secs[j] && secs[j].getBoundingClientRect().top>120){i=j-1;break;} }
  navLinks.forEach(a=>a.classList.remove("active")); if(i>=0) navLinks[i].classList.add("active"); }
document.addEventListener("scroll",spy,{passive:true}); spy();
```

## Open-question form

The closing questions section should capture decisions, not just pose them. One `.qf` block per question; the last block is a free-text write-in; a copy button assembles a paste-back reply. Pre-select the option the author would pick and tag it `recommended` — never restate an already-settled decision as a form.

```html
<div class="qf" data-q="Ship which option?">
  <h4>Q1 · Ship which option?</h4>
  <div class="opts">
    <span class="opt sel" data-v="Option A now"><span class="rec">recommended</span>Option A now</span>
    <span class="opt" data-v="Option B after the pilot">Option B after pilot</span>
  </div>
</div>
<div class="qf" data-q="Notes"><h4>Anything else</h4><textarea id="notes"></textarea></div>
<div class="reply">
  <div class="bar"><span>Decision reply — paste back to Claude</span><button id="copyBtn">Copy</button></div>
  <pre id="reply"></pre>
</div>
```

```javascript
function updateReply(){
  const lines=["Decisions on <brief title>:"];
  document.querySelectorAll(".qf[data-q]").forEach(qf=>{
    if(qf.dataset.q==="Notes") return;
    const sel=qf.querySelector(".opt.sel");
    if(sel) lines.push(`- ${qf.dataset.q} → ${sel.dataset.v}`);
  });
  const notes=document.getElementById("notes").value.trim();
  if(notes) lines.push(`- Notes: ${notes}`);
  document.getElementById("reply").textContent=lines.join("\n");
}
// option click → toggle .sel within the block → updateReply(); copy button → clipboard
```

The reply is the brief's prompt output: natural language, only the selections made, actionable without seeing the brief.

## Writing rules for this genre

- **Lead with the thesis callout** — a reader who stops after the first screen should still leave with the recommendation.
- **One correction per `.vs` row** — before/after splits lose power when rows bundle multiple claims.
- **Every diagram gets a one-line legend** explaining the color semantics.
- **Numbers in the KPI strip must be load-bearing** (task counts, readiness ratios, the critical path) — not vanity stats.
- **Grounded by construction** — structured elements (matrices, KPI numbers, contract/file lists, diff excerpts) must be derived from real sources (files, git, tickets); label anything inferred as *inferred* inline; omit missing facts rather than guess.
- **Every code excerpt gets a one-line intent summary above it** — the reader should know why the excerpt matters before parsing it.
- **End with the open-question form addressed to a named decider** (selectable answers + write-in + copy-back reply, pattern above) and a provenance footer (how the brief was produced, links to companion artifacts).
- Sections should each fit roughly one screen; if a section scrolls twice, split it.

## Example topics

- Phase roadmap for a team initiative (timeline gantt + leverage matrix + task cards)
- Build-vs-buy with a 10+ option vendor matrix (sortable, verdict-filtered)
- Architecture migration proposal (before/after, flow diagram with reuse/new/gate classes)
- Post-incident remediation plan (risks grid, gated rollout flowchart)
