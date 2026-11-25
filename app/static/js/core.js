/* Spoločný kód: načítanie katalógu z API (ontológia cez SPARQL), kontroly
   kompatibility, hlavička a päta. */
"use strict";
let C = {}, PRESETS = [], RULES = {}, TIERS = {}, LAYOUT = {}, BOARD = {}, KAT = [], KATMAP = {};
let activeCat = "grafika", prevBuild = null;
const byKat = k => Object.values(C).filter(c => c.kat === k);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const eur = n => new Intl.NumberFormat("sk-SK", {style:"currency", currency:"EUR", maximumFractionDigits: n % 1 ? 2 : 0}).format(n);
const $ = id => document.getElementById(id);

/* Na GitHub Pages je len web, server s katalógom a poradcom beží u vás na localhoste.
   Inú adresu servera nastavíte v URL: ?api=http://localhost:9000 */
const API_BASE = new URLSearchParams(location.search).get("api") ?? (location.hostname.endsWith("github.io") ? "http://localhost:8000" : "");
async function apiGet(u){ const r = await fetch(API_BASE + u); if(!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); }

async function nacitajKatalog(){
  const k = await apiGet("/api/katalog");
  C = k.komponenty; PRESETS = k.zostavy; RULES = k.pravidla; TIERS = k.tiers; LAYOUT = k.layout; BOARD = k.board; KAT = k.kategorie;
  KATMAP = Object.fromEntries(KAT.map(x => [x.id, x]));
  if(k.varovania?.length) VAROVANIA = k.varovania;
}
let VAROVANIA = [];
/* Upozornenie na chybné údaje v ontológii (napr. zlúčené form faktory). */
function varovanieOntologie(){
  if(!VAROVANIA.length) return "";
  return `<details class="info-box"><summary><b>Ontológia obsahuje protichodné údaje, kontrola kompatibility nemusí byť správna.</b></summary>
    <ul>${VAROVANIA.map(v => `<li>${esc(v)}</li>`).join("")}</ul>
    <p class="maly jemny">Opravte ontológiu v Protégé, uložte ju do <code>data/ontologia/</code> a reštartujte server.</p></details>`;
}

/* ============================================================
   KONTROLY KOMPATIBILITY (pravidlá R01–R16 z ontológie, uzavretý svet)
   ============================================================ */
function hddX(L){ return Math.min(L.hdd[0], L.W - L.frontIn - 150); }
function radFrontMounted(k, ch){ if(!ch || ch.druh !== "aio") return false; const loc = radiatorMount(k, ch.radiator); const L = LAYOUT[k.id]; return !!(loc && L.rad[loc] && L.rad[loc][2] === "v"); }
function comps(b){
  return { k:C[b.skrinka], c:C[b.procesor], d:C[b.doska], r:C[b.pamat], g:b.grafika?C[b.grafika]:null,
    u:(b.ulozisko||[]).map(id=>C[id]).filter(Boolean), z:C[b.zdroj], ch:C[b.chladic] };
}
function checks(b){
  const {k,c,d,r,g,u,z,ch} = comps(b); const out = [];
  const add = (ok, rule, text, cats) => out.push({ok, rule, text, cats});
  if (c && d) add(c.socket===d.socket, c.socket===d.socket?"R01":"R02", c.socket===d.socket ? `Socket ${c.socket} sedí s doskou` : `Procesor má socket ${c.socket}, doska ${d.socket}`, ["procesor","doska"]);
  if (r && d) add(d.ram.includes(r.typ), d.ram.includes(r.typ)?"R03":"R14", d.ram.includes(r.typ) ? `${r.typ} je podporovaná doskou` : `RAM je ${r.typ}, doska berie len ${d.ram.join("/")}`, ["pamat","doska"]);
  if (d && k) add(k.ffDosky.includes(d.ff), "R04", k.ffDosky.includes(d.ff) ? `Doska ${ffName(d.ff)} sa zmestí do skrinky` : `Skrinka neberie dosku ${ffName(d.ff)} (len ${k.ffDosky.map(ffName).join(", ")})`, ["doska","skrinka"]);
  if (g && k) add(g.dlzka<=k.maxGpu, g.dlzka<=k.maxGpu?"R05":"R06", g.dlzka<=k.maxGpu ? `Grafika ${g.dlzka} mm ≤ ${k.maxGpu} mm` : `Grafika ${g.dlzka} mm je dlhšia než ${k.maxGpu} mm`, ["grafika","skrinka"]);
  if (ch && k && ch.vyska) add(ch.vyska<=k.maxChladic, ch.vyska<=k.maxChladic?"R07":"R08", ch.vyska<=k.maxChladic ? `Chladič ${ch.vyska} mm ≤ ${k.maxChladic} mm` : `Chladič ${ch.vyska} mm je vyšší než ${k.maxChladic} mm`, ["chladic","skrinka"]);
  if (ch && k && ch.druh==="aio"){ const loc=radiatorMount(k,ch.radiator); add(!!loc, loc?"R15":"R16", loc ? `Radiátor ${ch.radiator} mm sa zmestí (${MOUNT_SK[loc]})` : `Skrinka nemá miesto pre radiátor ${ch.radiator} mm (podporuje ${radiatorList(k)})`, ["chladic","skrinka"]); }
  if (ch && k && g && ch.druh==="aio"){ const loc=radiatorMount(k,ch.radiator); const L=LAYOUT[k.id]; const R=loc&&L.rad[loc]; if(R&&R[2]==="v"){ const lim=Math.min(k.maxGpu,R[0]-L.bracketX); add(g.dlzka<=lim,"X02", g.dlzka<=lim?`Grafika ${g.dlzka} mm sa zmestí aj s predným radiátorom (do ${lim} mm)`:`S radiátorom ${MOUNT_SK[loc]} ostáva pre grafiku len ${lim} mm, karta má ${g.dlzka} mm`,["grafika","chladic"]); } }
  if (ch && c) add(ch.sockets.includes(c.socket), "R09", ch.sockets.includes(c.socket) ? `Chladič má montáž pre ${c.socket}` : `Chladič nemá montáž pre ${c.socket} (len ${ch.sockets.join(", ")})`, ["chladic","procesor"]);
  if (ch && c && ch.maxTdp) add(c.tdp<=ch.maxTdp, "R10", c.tdp<=ch.maxTdp ? `TDP ${c.tdp} W v limite chladiča ${ch.maxTdp} W` : `TDP procesora ${c.tdp} W je nad limitom chladiča ${ch.maxTdp} W`, ["chladic","procesor"]);
  if (z && k) add(k.ffZdroja.includes(z.ff), "R11", k.ffZdroja.includes(z.ff) ? `Zdroj ${z.ff} sa zmestí do skrinky` : `Skrinka neberie ${z.ff} zdroj (len ${k.ffZdroja.join(", ")})`, ["zdroj","skrinka"]);
  if (z && g) add(z.w>=g.odpZdroj, z.w>=g.odpZdroj?"R12":"R13", z.w>=g.odpZdroj ? `Zdroj ${z.w} W ≥ odporúčaných ${g.odpZdroj} W` : `Zdroj ${z.w} W je pod odporúčaním ${g.odpZdroj} W pre ${shortName(g)}`, ["zdroj","grafika"]);
  if (d && u.length){ const n=u.filter(x=>x.typ==="NVMe").length; if(n) add(n<=d.m2, "X01", n<=d.m2 ? `${n}× NVMe, doska má ${d.m2} M.2 sloty` : `${n}× NVMe, ale doska má len ${d.m2} M.2`, ["ulozisko","doska"]); }
  return out;
}
const MOUNT_SK = {top:"hore", front:"vpredu", side:"na boku", bottom:"dole"};
function radiatorMount(k, size){ for(const loc of ["top","front","side","bottom"]) if((k.radiatory[loc]||[]).includes(size)) return loc; return null; }
function radiatorList(k){ const all = new Set(); Object.values(k.radiatory).forEach(a => a.forEach(v => all.add(v))); return [...all].sort((a,b) => a-b).join("/") + " mm"; }
function missing(b){
  const m = []; const c = C[b.procesor];
  for (const k of KAT){
    if (k.id === "grafika"){ if(!b.grafika && !(c && c.igpu)) m.push("grafika"); continue; }
    if (k.multi){ if(!(b.ulozisko||[]).length) m.push(k.id); continue; }
    if (!b[k.id]) m.push(k.id);
  }
  return m;
}
function price(b){ let s = 0; for (const k of KAT){ const v = b[k.id]; if(Array.isArray(v)) v.forEach(id => s += C[id].cena); else if(v) s += C[v].cena; } return s; }
function powerEst(b){ const {c,g} = comps(b); return (c?c.tdp:0) + (g?g.prikon:0) + 75; }
function ffName(f){ return {ATX:"ATX", MicroATX:"Micro-ATX", MiniITX:"Mini-ITX"}[f] || f; }
function shortName(x){ return x.nazov.replace(/^(NVIDIA GeForce |AMD |Intel |Sapphire PULSE Radeon )/, ""); }
function withPart(b, kat, id){ const n = structuredClone(b); if(KATMAP[kat].multi){ const s = new Set(n.ulozisko); s.has(id) ? s.delete(id) : s.add(id); n.ulozisko = [...s]; } else n[kat] = id; return n; }
function bezChyby(b){ return !checks(b).some(x => !x.ok) && !missing(b).length; }
function specLine(x){
  switch(x.kat){
    case "skrinka": return `${x.rozmer[0]}×${x.sirka}×${x.rozmer[1]} mm, ${x.farba==="biela"?"biela":"čierna"}, GPU do ${x.maxGpu} mm, chladič do ${x.maxChladic} mm, radiátor ${radiatorList(x)}, dosky ${x.ffDosky.map(ffName).join(", ")}`;
    case "procesor": return `${x.socket}, ${x.jadra} jadier / ${x.vlakna} vlákien, ${x.ghz[0]}–${x.ghz[1]} GHz, TDP ${x.tdp} W${x.turbo?` (turbo ${x.turbo} W)`:""}, ${x.ram.join("/")}`;
    case "doska": return `${x.socket}, ${x.cipset}, ${ffName(x.ff)}, ${x.ram.join("/")}, ${x.ramSloty} sloty RAM, ${x.m2}× M.2`;
    case "pamat": return `${x.typ}-${x.mts}, ${x.kap} GB (${x.moduly} moduly)${x.rgb?", RGB":""}`;
    case "grafika": return `${x.vram} GB ${x.vramTyp}, ${x.prikon} W, ${x.dlzka} × ${x.vyska} mm, ${String(x.sloty).replace(".",",")} slotu, zdroj od ${x.odpZdroj} W`;
    case "ulozisko": return `${x.typ==="NVMe"?"M.2 NVMe":x.typ==="HDD"?"3,5\" HDD":"2,5\" SATA SSD"}, ${x.kap>=1000?(x.kap/1000)+" TB":x.kap+" GB"}`;
    case "zdroj": return `${x.w} W, ${x.ff}, 80 PLUS ${x.cert}`;
    case "chladic": return x.druh==="aio" ? `Vodný AIO, radiátor ${x.radiator} mm, ${x.sockets.join(", ")}` : `${x.druh==="vezovy"?"Vežový":"Nízkoprofilový"}, výška ${x.vyska} mm, ${x.sockets.join(", ")}${x.maxTdp?`, do ${x.maxTdp} W`:""}`;
  }
  return "";
}

/* Rozpracovaná zostava sa pamätá v prehliadači (ak to prehliadač dovolí). */
const Uloz = {
  get(k, d){ try{ const v = localStorage.getItem("pck." + k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem("pck." + k, JSON.stringify(v)); }catch(e){} },
};
function platnaZostava(b){ return b && KAT.every(k => k.multi ? Array.isArray(b[k.id]) && b[k.id].every(i => C[i]) : (b[k.id] == null && k.id === "grafika") || (C[b[k.id]] && C[b[k.id]].kat === k.id)); }
function nazovZostavy(b){ const p = PRESETS.find(x => JSON.stringify(normB(x.b)) === JSON.stringify(normB(b))); return p ? p.nazov : null; }
function normB(b){ const o = {}; KAT.forEach(k => { o[k.id] = k.multi ? [...(b[k.id]||[])].sort() : (b[k.id] ?? null); }); return o; }

/* ============================================================
   HLAVIČKA, PÄTA, STAV SERVERA
   ============================================================ */
const IKONA = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="6" width="20" height="20" rx="4" fill="#2d7563"/><rect x="11" y="11" width="10" height="10" rx="2" fill="#f2b36a"/><path d="M10 2v4M16 2v4M22 2v4M10 26v4M16 26v4M22 26v4M2 10h4M2 16h4M2 22h4M26 10h4M26 16h4M26 22h4" stroke="#2d7563" stroke-width="2" stroke-linecap="round"/></svg>`;
function vykresliRamec(){
  const str = document.body.dataset.strana;
  const nav = [["konfigurator","index.html","Konfigurátor"],["poradca","poradca.html","Poradca"]];
  const h = document.createElement("header"); h.className = "hlavicka";
  h.innerHTML = `<div class="obal">
    <a class="znacka" href="index.html">${IKONA}<b>PC konfigurátor</b></a>
    <nav class="nav" id="nav" aria-label="Hlavná navigácia">${nav.map(([id,u,t]) => `<a href="${u}" ${str===id?'aria-current="page"':""}>${t}</a>`).join("")}</nav>
    <span class="server" id="server" role="status"><i></i><span>Kontrolujem server</span></span>
    <button class="menu-btn" type="button" aria-controls="nav" aria-expanded="false" id="menuBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span class="sr">Menu</span></button>
  </div>`;
  document.body.prepend(h);
  const f = document.createElement("footer"); f.className = "pata";
  f.innerHTML = `<div class="obal"><span>Študentský projekt: ontológia PC konfigurátora, SPARQL a RAG poradca.</span><span>Ceny sú orientačné.</span></div>`;
  document.body.append(f);
  $("menuBtn").onclick = e => { const o = $("nav").classList.toggle("otvorene"); e.currentTarget.setAttribute("aria-expanded", o); };
  stavServera();
}
async function stavServera(){
  const el = $("server"); if(!el) return;
  try{
    const s = await apiGet("/api/stav");
    el.className = "server " + (s.stav === "pripravene" ? "ok" : s.stav === "chyba" ? "zly" : "caka");
    el.lastElementChild.textContent = s.stav === "pripravene" ? "Poradca pripravený" : s.stav === "chyba" ? "Poradca nedostupný" : "Poradca sa pripravuje";
    el.title = s.stav === "chyba" ? s.sprava : `${s.llm}, ${s.embed}`;
    if(s.stav === "indexujem") setTimeout(stavServera, 3000);
    return s;
  }catch(e){
    el.className = "server zly"; el.lastElementChild.textContent = "Server nebeží";
    setTimeout(stavServera, 4000);
  }
}
function serverNebezi(){
  return `<div class="info-box"><h2>Lokálny server nebeží</h2>
    <p>Katalóg, konfigurátor aj poradca čítajú dáta z ontológie cez server na <code>${esc(API_BASE || location.origin)}</code>.</p>
    <p>Spustite ho v priečinku projektu príkazom <code>docker compose up --no-deps app</code> alebo v priečinku <code>app</code> príkazom <code>python -m uvicorn main:app --port 8000</code>. Stránka sa pripojí sama.</p></div>`;
}
function toast(t){ let el = $("toast"); if(!el){ el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role","status"); document.body.append(el); }
  el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2600); }
function ukazPravidlo(id){ const r = RULES[id]; if(!r) return; let d = $("dlgPravidlo"); if(!d){ d = document.createElement("dialog"); d.id = "dlgPravidlo"; document.body.append(d); d.addEventListener("click", e => { if(e.target === d || e.target.dataset.zavriet !== undefined) d.close(); }); }
  d.innerHTML = `<div class="dlg"><h2>${esc(id)} ${esc(r.nazov)}</h2><p>${esc(r.vysv)}</p><p class="maly jemny">Pravidlo v ontológii:</p><pre>${esc(r.swrl)}</pre><div class="tl"><button class="btn btn-2 btn-s" type="button" data-zavriet>Zavrieť</button></div></div>`; d.showModal(); }

/* Spustenie stránky: hlavička, katalóg (ak ho stránka potrebuje), potom init. */
async function spusti(init, {katalog = true} = {}){
  vykresliRamec();
  if(!katalog){ init && init(); return; }
  try{ await nacitajKatalog(); }
  catch(e){
    // server nebeží: ukážeme návod a po jeho spustení stránku obnovíme
    document.querySelector("main").innerHTML = `<div class="obal">${serverNebezi()}</div>`;
    for(;;){ await new Promise(r => setTimeout(r, 3000)); try{ await apiGet("/api/stav"); location.reload(); return; }catch(e){} }
  }
  init && init();
  document.querySelector("main")?.insertAdjacentHTML("afterbegin", VAROVANIA.length ? `<div class="obal-varovanie">${varovanieOntologie()}</div>` : "");
}
