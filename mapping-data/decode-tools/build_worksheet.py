"""
Build a self-contained HTML verification worksheet for the KAP fonts.

Each real byte is shown with its glyph in ALL FOUR fonts (KAP110/111/112/122)
so the reviewer confirms the identity per font (no blind cross-font copying),
pre-filled with my candidate reading + honest confidence. The reviewer edits
the Gujarati value / kind / notes, marks rows reviewed, and exports JSON that
gets wired back into the codebase.

Images are trimmed + downscaled + base64-embedded so the file is fully offline.
"""
import os, io, base64, json, html, datetime
from PIL import Image, ImageChops
from candidates_kap import CAND, REAL_BYTES, NOTDEF

_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))  # repo root
DSET = os.path.join(ROOT, "mapping-data/glyph-dataset")
FONTS = ["KAP110", "KAP111", "KAP112", "KAP122"]
OUT_HTML = os.path.join(ROOT, "kap-verification-worksheet.html")

def trim(im):
    """Trim surrounding whitespace, keep a small pad."""
    g = im.convert("L")
    bg = Image.new("L", g.size, 255)
    diff = ImageChops.difference(g, bg)
    bbox = diff.getbbox()
    if bbox:
        l, t, r, b = bbox
        pad = 6
        l = max(0, l - pad); t = max(0, t - pad)
        r = min(im.width, r + pad); b = min(im.height, b + pad)
        im = im.crop((l, t, r, b))
    return im

def thumb_b64(font, b, target_h=72):
    p = os.path.join(DSET, font, f"0x{b:02X}.png")
    im = Image.open(p).convert("L")
    im = trim(im)
    if im.height != target_h:
        w = max(1, round(im.width * target_h / im.height))
        im = im.resize((w, target_h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

data = []
for b in REAL_BYTES:
    guess, conf, kind, note = CAND[b]
    imgs = {f: thumb_b64(f, b) for f in FONTS}
    data.append({
        "hex": f"0x{b:02X}",
        "dec": b,
        "ascii": chr(b) if 33 <= b < 127 else "",
        "guess": guess,
        "conf": conf,
        "kind": kind,
        "note": note,
        "imgs": imgs,
    })

payload = json.dumps(data, ensure_ascii=False)
gen = datetime.date.today().isoformat()

KINDS = ["consonant","vowel","matra","sign","conjunct","ligature","digit","symbol","punct","unknown"]
kind_opts = "".join(f'<option value="{k}">{k}</option>' for k in KINDS)

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KAP Gujarati mapping — verification worksheet</title>
<style>
  :root{ color-scheme: light; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
        background:#f4f5f7; color:#1b1f24; }
  header{ position:sticky; top:0; z-index:20; background:#ffffff; border-bottom:1px solid #e2e5ea;
          padding:14px 20px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
  h1{ font-size:18px; margin:0 0 4px; }
  .sub{ font-size:13px; color:#5a6472; line-height:1.5; max-width:960px; }
  .sub b{ color:#1b1f24; }
  .bar{ display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; margin-top:10px; }
  .stat{ font-size:12px; color:#5a6472; }
  .stat b{ font-size:14px; color:#1b1f24; }
  .progwrap{ flex:1; min-width:160px; height:8px; background:#e7eaef; border-radius:5px; overflow:hidden; }
  .prog{ height:100%; width:0%; background:#2f8a4c; transition:width .2s; }
  button,select,input{ font:inherit; }
  .btn{ border:1px solid #cfd4dc; background:#fff; border-radius:7px; padding:6px 11px; font-size:13px;
        cursor:pointer; color:#1b1f24; }
  .btn:hover{ background:#f0f2f5; }
  .btn.primary{ background:#2563eb; border-color:#2563eb; color:#fff; }
  .btn.primary:hover{ background:#1d4ed8; }
  .filters{ display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; align-items:center; }
  .chip{ border:1px solid #cfd4dc; background:#fff; border-radius:14px; padding:4px 11px; font-size:12px; cursor:pointer; }
  .chip.active{ background:#1b1f24; color:#fff; border-color:#1b1f24; }
  .search{ border:1px solid #cfd4dc; border-radius:7px; padding:6px 10px; font-size:13px; min-width:150px; }
  main{ padding:18px 20px 80px; }
  .grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(310px,1fr)); gap:14px; }
  .card{ background:#fff; border:1px solid #e2e5ea; border-radius:10px; padding:12px; }
  .card.reviewed{ border-color:#2f8a4c; box-shadow:0 0 0 1px #2f8a4c22; }
  .card.flagged{ border-color:#d9822b; box-shadow:0 0 0 1px #d9822b33; }
  .chead{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  .byte{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:14px; font-weight:600; }
  .byte .asc{ color:#8a94a3; font-weight:400; margin-left:6px; }
  .conf{ font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; padding:2px 7px; border-radius:10px; font-weight:600; }
  .conf.high{ background:#dcfce7; color:#166534; }
  .conf.med{ background:#fef9c3; color:#854d0e; }
  .conf.low{ background:#fee2e2; color:#991b1b; }
  .glyphs{ display:flex; gap:6px; justify-content:space-between; background:#fafbfc; border:1px solid #eef0f3;
           border-radius:8px; padding:8px 6px; margin-bottom:10px; }
  .gcell{ display:flex; flex-direction:column; align-items:center; gap:3px; flex:1; }
  .gcell img{ height:60px; width:auto; max-width:100%; object-fit:contain; }
  .gcell span{ font-size:9.5px; color:#8a94a3; font-family:ui-monospace,monospace; }
  .row{ display:flex; gap:8px; align-items:center; margin-bottom:8px; }
  .row label{ font-size:11px; color:#5a6472; width:52px; flex:none; }
  .guj{ flex:1; border:1px solid #cfd4dc; border-radius:7px; padding:8px 10px; font-size:22px;
        line-height:1.2; font-family:"Noto Sans Gujarati","Shruti",sans-serif; }
  .guj:focus{ outline:2px solid #2563eb55; border-color:#2563eb; }
  select.kind{ flex:1; border:1px solid #cfd4dc; border-radius:7px; padding:7px 8px; font-size:13px; background:#fff; }
  input.note{ flex:1; border:1px solid #cfd4dc; border-radius:7px; padding:7px 9px; font-size:12.5px; }
  .foot{ display:flex; align-items:center; justify-content:space-between; margin-top:4px; }
  .toggles{ display:flex; gap:12px; }
  .toggles label{ width:auto; display:flex; align-items:center; gap:5px; font-size:12px; color:#3a424e; cursor:pointer; }
  .hint{ font-size:11px; color:#a2abb8; font-style:italic; }
  .hidden{ display:none !important; }
  .empty{ color:#c0392b; }
  footer{ position:fixed; bottom:0; left:0; right:0; background:#fff; border-top:1px solid #e2e5ea;
          padding:10px 20px; display:flex; gap:10px; align-items:center; box-shadow:0 -1px 4px rgba(0,0,0,.05); z-index:20; }
  footer .grow{ flex:1; font-size:12px; color:#5a6472; }
  .banner{ background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; font-size:12.5px; padding:8px 12px;
           border-radius:8px; margin-top:10px; max-width:960px; }
</style>
</head>
<body>
<header>
  <h1>KAP Gujarati mapping — verification worksheet</h1>
  <div class="sub">
    For each byte, I've rendered its glyph in <b>all four fonts</b> (they share one layout, so the letter should look the same in each — only the weight differs). I filled in my <b>best guess</b> and a colour-coded <b>confidence</b>. Please <b>correct the Gujarati</b> where I'm wrong, set the <b>kind</b>, and tick <b>Reviewed</b>. Focus first on the red (low) ones — the green (high) ones were validated against the word આપેલા. Nothing gets written into the app until you confirm here.
  </div>
  <div class="banner">
    Tip — enter the Gujarati <b>element</b> the glyph represents (a bare consonant like <b>ક</b>, a matra on its own like <b>ા</b> or <b>િ</b>, an independent vowel like <b>અ</b>, a conjunct like <b>ક્ષ</b>, a digit like <b>૧</b>, or a symbol). Leave blank &amp; tick Reviewed if a glyph is decorative/unused.
  </div>
  <div class="bar">
    <div class="progwrap"><div class="prog" id="prog"></div></div>
    <div class="stat"><b id="s_rev">0</b>/<b id="s_tot">0</b> reviewed</div>
    <div class="stat">high <b id="s_high">0</b></div>
    <div class="stat">med <b id="s_med">0</b></div>
    <div class="stat">low <b id="s_low">0</b></div>
    <div class="stat">flagged <b id="s_flag">0</b></div>
  </div>
  <div class="filters" id="filters">
    <span class="chip active" data-f="all">All</span>
    <span class="chip" data-f="todo">Needs review</span>
    <span class="chip" data-f="low">Low conf</span>
    <span class="chip" data-f="med">Med conf</span>
    <span class="chip" data-f="high">High conf</span>
    <span class="chip" data-f="reviewed">Reviewed</span>
    <span class="chip" data-f="flagged">Flagged</span>
    <input class="search" id="search" placeholder="search hex / char / note…">
  </div>
</header>
<main><div class="grid" id="grid"></div></main>
<footer>
  <div class="grow" id="fnote">Your edits stay in this page. Click <b>Download JSON</b> to save your progress and send it back for wiring into the app.</div>
  <button class="btn" onclick="loadJson()">Load JSON…</button>
  <input type="file" id="file" accept="application/json" style="display:none">
  <button class="btn primary" onclick="downloadJson()">Download JSON</button>
</footer>
<script>
const DATA = __PAYLOAD__;
const KINDS = __KINDS__;
const state = DATA.map(d => ({
  hex:d.hex, dec:d.dec, ascii:d.ascii, guess:d.guess, conf:d.conf,
  gujarati:d.guess, kind:d.kind, note:d.note, reviewed:false, flag:false, imgs:d.imgs
}));
let filter="all", q="";
const grid=document.getElementById("grid");

function kindOptions(sel){
  return KINDS.map(k=>`<option value="${k}"${k===sel?" selected":""}>${k}</option>`).join("");
}
function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }

function cardHtml(s,i){
  const gimgs = ["KAP110","KAP111","KAP112","KAP122"].map(f=>
    `<div class="gcell"><img src="${s.imgs[f]}" alt="${f} ${s.hex}"><span>${f.replace("KAP","")}</span></div>`).join("");
  return `<div class="card ${s.reviewed?'reviewed':''} ${s.flag?'flagged':''}" data-i="${i}">
    <div class="chead">
      <div class="byte">${s.hex}<span class="asc">${s.ascii?("&lsquo;"+esc(s.ascii)+"&rsquo;"):""}</span></div>
      <div class="conf ${s.conf}">${s.conf}</div>
    </div>
    <div class="glyphs">${gimgs}</div>
    <div class="row"><label>Gujarati</label>
      <input class="guj" value="${esc(s.gujarati)}" data-k="gujarati" placeholder="—">
    </div>
    <div class="row"><label>Kind</label>
      <select class="kind" data-k="kind">${kindOptions(s.kind)}</select>
    </div>
    <div class="row"><label>Note</label>
      <input class="note" value="${esc(s.note)}" data-k="note" placeholder="optional note">
    </div>
    <div class="foot">
      <div class="toggles">
        <label><input type="checkbox" data-k="reviewed" ${s.reviewed?"checked":""}> Reviewed</label>
        <label><input type="checkbox" data-k="flag" ${s.flag?"checked":""}> Flag</label>
      </div>
      <div class="hint">${s.guess?("guess: "+esc(s.guess)):"no guess"}</div>
    </div>
  </div>`;
}

function visible(s){
  if(q){
    const hay=(s.hex+" "+s.ascii+" "+s.note+" "+s.gujarati+" "+s.kind).toLowerCase();
    if(!hay.includes(q)) return false;
  }
  switch(filter){
    case "todo": return !s.reviewed && (s.conf==="low");
    case "low": return s.conf==="low";
    case "med": return s.conf==="med";
    case "high": return s.conf==="high";
    case "reviewed": return s.reviewed;
    case "flagged": return s.flag;
    default: return true;
  }
}

function render(){
  grid.innerHTML = state.map((s,i)=>visible(s)?cardHtml(s,i):"").join("");
  stats();
}
function stats(){
  const tot=state.length, rev=state.filter(s=>s.reviewed).length;
  document.getElementById("s_tot").textContent=tot;
  document.getElementById("s_rev").textContent=rev;
  document.getElementById("s_high").textContent=state.filter(s=>s.conf==="high").length;
  document.getElementById("s_med").textContent=state.filter(s=>s.conf==="med").length;
  document.getElementById("s_low").textContent=state.filter(s=>s.conf==="low").length;
  document.getElementById("s_flag").textContent=state.filter(s=>s.flag).length;
  document.getElementById("prog").style.width=(tot?Math.round(rev/tot*100):0)+"%";
}

grid.addEventListener("input", e=>{
  const card=e.target.closest(".card"); if(!card) return;
  const i=+card.dataset.i, k=e.target.dataset.k; if(!k) return;
  state[i][k] = e.target.type==="checkbox" ? e.target.checked : e.target.value;
});
grid.addEventListener("change", e=>{
  const card=e.target.closest(".card"); if(!card) return;
  const i=+card.dataset.i, k=e.target.dataset.k;
  if(k==="reviewed"||k==="flag"){
    card.classList.toggle(k==="reviewed"?"reviewed":"flagged", e.target.checked);
    stats();
  }
});
document.getElementById("filters").addEventListener("click", e=>{
  if(!e.target.classList.contains("chip")) return;
  document.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
  e.target.classList.add("active"); filter=e.target.dataset.f; render();
});
document.getElementById("search").addEventListener("input", e=>{ q=e.target.value.toLowerCase().trim(); render(); });

function downloadJson(){
  const out={
    schema:"kap-verification/v1",
    font_layout:"KAP110/111/112/122 (shared byte->glyph layout)",
    generated:"__GEN__",
    exported:new Date().toISOString(),
    entries: state.map(s=>({hex:s.hex, dec:s.dec, ascii:s.ascii,
      gujarati:s.gujarati, kind:s.kind, reviewed:s.reviewed, flag:s.flag, note:s.note, my_guess:s.guess, my_conf:s.conf}))
  };
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="kap-verification-progress.json"; a.click();
}
function loadJson(){ document.getElementById("file").click(); }
document.getElementById("file").addEventListener("change", e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{
    const j=JSON.parse(r.result); const by={};
    (j.entries||[]).forEach(x=>by[x.hex]=x);
    state.forEach(s=>{ const x=by[s.hex]; if(x){
      s.gujarati=x.gujarati??s.gujarati; s.kind=x.kind??s.kind;
      s.reviewed=!!x.reviewed; s.flag=!!x.flag; s.note=x.note??s.note; }});
    render(); document.getElementById("fnote").innerHTML="Loaded progress from file.";
  }catch(err){ alert("Could not read JSON: "+err.message); } };
  r.readAsText(f);
});
render();
</script>
</body>
</html>"""

HTML = (HTML
        .replace("__PAYLOAD__", payload)
        .replace("__KINDS__", json.dumps(KINDS))
        .replace("__GEN__", gen))

with open(OUT_HTML, "w", encoding="utf-8") as f:
    f.write(HTML)

sz = os.path.getsize(OUT_HTML)
print("wrote", OUT_HTML)
print("size: %.2f MB" % (sz/1024/1024))
print("cards:", len(data))
