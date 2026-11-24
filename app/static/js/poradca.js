"use strict";
/* Poradca (RAG): stav indexu, zdroje a rozhovor. Odpoveď prichádza po kúskoch (NDJSON):
   najprv nájdené úryvky, potom text odpovede s odkazmi [1]…[n]. */
let zostava = null;   // zostava z konfigurátora alebo hotových zostáv, na ktorú sa používateľ pýta

spusti(() => {
  const q = new URLSearchParams(location.search);
  if(q.get("zostava")){
    const z = Uloz.get("poradca", null);
    if(z){ zostava = z.b;
      $("kontext").innerHTML = `<div class="kontext-zostavy"><b>Pýtate sa na zostavu${z.nazov ? " " + esc(z.nazov) : " z konfigurátora"}</b>
        <span class="jemny">Poradca dostane jej diely aj výsledky kontroly kompatibility.</span></div>`; }
  }
  $("reindex").onclick = async () => { await fetch(API_BASE + "/api/reindex", {method: "POST"}); nacitajStav(); };
  $("navrhy").onclick = e => { const b = e.target.closest("button"); if(b) opytajSa(b.textContent); };
  $("konverzacia").addEventListener("click", e => {
    const p = e.target.closest(".odpoved .plocka"); if(!p) return;
    const d = p.closest("article").querySelector(`details[data-n="${p.dataset.n}"]`); if(!d) return;
    d.open = true; d.classList.add("svieti"); d.scrollIntoView({behavior: "smooth", block: "nearest"});
    setTimeout(() => d.classList.remove("svieti"), 1600);
  });
  const pole = $("otazka");
  $("formular").onsubmit = e => { e.preventDefault(); const t = pole.value.trim(); if(!t || $("poslat").disabled) return; pole.value = ""; pole.style.height = ""; opytajSa(t); };
  pole.onkeydown = e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); $("formular").requestSubmit(); } };
  pole.oninput = () => { pole.style.height = ""; pole.style.height = pole.scrollHeight + "px"; };
  nacitajStav().then(s => { if(q.get("q")) cakajAOpytaj(q.get("q")); });
}, {katalog: false});

async function cakajAOpytaj(otazka){
  // otázku z konfigurátora pošleme až keď je index pripravený
  for(let i = 0; i < 200; i++){
    try{ const s = await apiGet("/api/stav"); if(s.stav !== "indexujem") break; }catch(e){}
    await new Promise(r => setTimeout(r, 1500));
  }
  opytajSa(otazka);
}

async function nacitajStav(){
  let s;
  try{ s = await apiGet("/api/stav"); }
  catch(e){ $("modely").innerHTML = ""; $("zdroje").innerHTML = serverNebezi(); setTimeout(nacitajStav, 3000); return null; }
  const stavText = s.stav === "pripravene" ? `${s.uryvky} úryvkov` : s.stav === "chyba" ? "chyba" : (s.sprava || "pripravuje sa");
  $("modely").innerHTML = `<li><span>Odpovede</span><b>${esc(s.llm)}</b></li><li><span>Vyhľadávanie</span><b>${esc(s.embed)}</b></li>
    <li class="${s.stav === "chyba" ? "zly" : s.stav === "pripravene" ? "ok" : ""}"><span>Index</span><b>${esc(stavText)}</b></li>`;
  if(s.stav === "chyba") $("zdroje").innerHTML = `<p class="chyba-box">${esc(s.sprava)}</p>`;
  else {
    const skupina = (nadpis, z) => z.length ? `<h3>${nadpis}</h3><ul class="zoznam">${z.map(x => `
      <li class="${x.chyba ? "zly" : ""}" title="${esc(x.chyba || "")}"><span>${esc(x.nazov)}</span>
      <span>${x.chyba ? "nečitateľné" : x.druh === "pdf" ? `${x.strany} str.` : `${x.uryvky} úryvkov`}</span></li>`).join("")}</ul>` : "";
    const pdf = s.zdroje.filter(z => z.druh === "pdf");
    $("zdroje").innerHTML = (pdf.length ? skupina(`PDF dokumenty (${pdf.length})`, pdf) : `<h3>PDF dokumenty</h3><p class="maly jemny">Zatiaľ žiadne PDF.</p>`)
      + skupina("Ontológia zo Zadania 1", s.zdroje.filter(z => z.druh === "ontologia"))
      + skupina("Konfigurátor", s.zdroje.filter(z => z.druh === "katalog"));
  }
  if(s.stav === "indexujem") setTimeout(nacitajStav, 1500);
  return s;
}

/* jednoduché formátovanie odpovede: odseky, odrážky, tučné, odkazy [n] */
function formatuj(text){
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, n) => n.split(",").map(x => `<button type="button" class="plocka" data-n="${x.trim()}">${x.trim()}</button>`).join(""));
  return text.trim().split(/\n{2,}/).map(blok => {
    const riadky = blok.split("\n").map(r => r.replace(/^#+\s*/, ""));
    if(riadky.every(r => /^\s*[-*•]\s+/.test(r))) return `<ul>${riadky.map(r => `<li>${inline(r.replace(/^\s*[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${riadky.map(inline).join("<br>")}</p>`;
  }).join("");
}
const DRUH = {pdf: "PDF", ontologia: "ontológia", katalog: "konfigurátor"};
function zoznamZdrojov(zdroje){
  return `<ol class="zoznam-zdrojov">${zdroje.map((z, i) => `
    <li><details data-n="${i + 1}"><summary><span class="plocka">${i + 1}</span>
      <span class="meno">${esc(z.druh === "pdf" ? z.zdroj : z.miesto)}</span>
      <span class="miesto">${esc(z.druh === "pdf" ? z.miesto : DRUH[z.druh])}</span></summary>
      <pre>${esc(z.text)}</pre></details></li>`).join("")}</ol>`;
}

async function opytajSa(otazka){
  $("prazdne")?.remove();
  const blok = document.createElement("article");
  blok.innerHTML = `<p class="otazka-bublina">${esc(otazka)}</p><div class="odpoved"><p class="caka">Hľadám v dokumentoch</p></div><div class="zdroje-odpovede"></div>`;
  $("konverzacia").append(blok);
  blok.scrollIntoView({behavior: "smooth", block: "start"});
  const odp = blok.querySelector(".odpoved");
  $("poslat").disabled = true;
  let text = "";
  try{
    const r = await fetch(API_BASE + "/api/otazka", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({otazka, zostava})});
    const citac = r.body.getReader(), dek = new TextDecoder(); let buffer = "";
    for(;;){
      const {value, done} = await citac.read(); if(done) break;
      buffer += dek.decode(value, {stream: true});
      const riadky = buffer.split("\n"); buffer = riadky.pop();
      for(const riadok of riadky.filter(Boolean)){
        const m = JSON.parse(riadok);
        if(m.typ === "zdroje"){ blok.querySelector(".zdroje-odpovede").innerHTML = zoznamZdrojov(m.zdroje); odp.innerHTML = `<p class="caka">Píšem odpoveď</p>`; }
        else if(m.typ === "text"){ text += m.text; odp.innerHTML = formatuj(text); }
        else if(m.typ === "chyba"){ odp.classList.add("chyba"); odp.innerHTML = `<p>${esc(m.sprava)}</p>`; }
      }
    }
    if(!text && !odp.classList.contains("chyba")) odp.innerHTML = "<p>Model nevrátil žiadnu odpoveď.</p>";
  }catch(e){
    odp.classList.add("chyba"); odp.innerHTML = `<p>Spojenie so serverom zlyhalo: ${esc(String(e))}</p>`;
  }finally{ $("poslat").disabled = false; }
}
