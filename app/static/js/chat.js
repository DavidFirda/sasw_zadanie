"use strict";
/* Rozhovor s poradcom (RAG). Používa ho stránka Poradca aj bočný panel v konfigurátore. Odpoveď prichádza po kúskoch (NDJSON): najprv nájdené úryvky,
   potom text odpovede s odkazmi [1]…[n]. */

const DRUH = {pdf: "PDF", ontologia: "ontológia", katalog: "konfigurátor"};

function formatuj(text){
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, n) => n.split(",").map(x => `<button type="button" class="plocka" data-n="${x.trim()}">${x.trim()}</button>`).join(""));
  return text.trim().split(/\n{2,}/).map(blok => {
    const riadky = blok.split("\n").map(r => r.replace(/^#+\s*/, ""));
    if(riadky.every(r => /^\s*[-*•]\s+/.test(r))) return `<ul>${riadky.map(r => `<li>${inline(r.replace(/^\s*[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${riadky.map(inline).join("<br>")}</p>`;
  }).join("");
}
function zoznamZdrojov(zdroje){
  return `<ol class="zoznam-zdrojov">${zdroje.map((z, i) => `
    <li><details data-n="${i + 1}"><summary><span class="plocka">${i + 1}</span>
      <span class="meno">${esc(z.druh === "pdf" ? z.zdroj : z.miesto)}</span>
      <span class="miesto">${esc(z.druh === "pdf" ? z.miesto : DRUH[z.druh])}</span></summary>
      <pre>${esc(z.text)}</pre></details></li>`).join("")}</ol>`;
}

/* Pripojí rozhovor ku koreňovému prvku, ktorý obsahuje .konverzacia a form.vstup.
   zostava() vráti zostavu, ku ktorej sa otázka vzťahuje (alebo null). */
function pripojChat(root, zostava = () => null){
  const konv = root.querySelector(".konverzacia"), form = root.querySelector(".vstup");
  const pole = form.querySelector("textarea"), poslat = form.querySelector("button");
  let busy = false;

  konv.addEventListener("click", e => {
    const p = e.target.closest(".odpoved .plocka"); if(!p) return;
    const d = p.closest("article").querySelector(`details[data-n="${p.dataset.n}"]`); if(!d) return;
    d.open = true; d.classList.add("svieti"); d.scrollIntoView({behavior: "smooth", block: "nearest"});
    setTimeout(() => d.classList.remove("svieti"), 1600);
  });
  form.onsubmit = e => { e.preventDefault(); const t = pole.value.trim(); if(!t || busy) return; pole.value = ""; pole.style.height = ""; opytaj(t); };
  pole.onkeydown = e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); form.requestSubmit(); } };
  pole.oninput = () => { pole.style.height = ""; pole.style.height = pole.scrollHeight + "px"; };

  async function opytaj(otazka){
    root.querySelector(".uvodny")?.remove();
    const blok = document.createElement("article");
    blok.innerHTML = `<p class="otazka-bublina">${esc(otazka)}</p><div class="odpoved"><p class="caka">Hľadám v dokumentoch</p></div><div class="zdroje-odpovede"></div>`;
    konv.append(blok);
    blok.scrollIntoView({behavior: "smooth", block: "start"});
    const odp = blok.querySelector(".odpoved");
    busy = true; poslat.disabled = true;
    let text = "";
    try{
      const r = await fetch(API_BASE + "/api/otazka", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({otazka, zostava: zostava()})});
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
      odp.classList.add("chyba"); odp.innerHTML = `<p>Spojenie so serverom zlyhalo. Beží lokálny server?</p>`;
    }finally{ busy = false; poslat.disabled = false; }
  }
  return {opytaj};
}

/* ============================================================
   BOČNÝ PANEL V KONFIGURÁTORE
   ============================================================ */
const Panel = {
  chat: null, b: null, nazov: null,
  vytvor(){
    const a = document.createElement("aside");
    a.className = "bocny-panel"; a.id = "bocnyPanel"; a.setAttribute("aria-label", "Poradca"); a.hidden = true;
    a.innerHTML = `<div class="panel-hlav"><div><h2>Poradca</h2><p class="jemny maly" id="panelZostava"></p></div>
        <button class="zavriet" type="button" aria-label="Zavrieť poradcu">×</button></div>
      <div class="konverzacia"></div>
      <div class="rychle" id="panelRychle"></div>
      <form class="vstup"><label class="sr" for="panelOtazka">Otázka k zostave</label>
        <textarea id="panelOtazka" rows="1" placeholder="Otázka k zostave…"></textarea>
        <button class="btn btn-1" type="submit">Opýtať sa</button></form>`;
    document.body.append(a);
    a.querySelector(".zavriet").onclick = () => this.zavri();
    document.addEventListener("keydown", e => { if(e.key === "Escape" && !a.hidden && !document.querySelector("dialog[open]")) this.zavri(); });
    this.chat = pripojChat(a, () => this.zostava());
    a.querySelector("#panelRychle").onclick = e => { const b = e.target.closest("button"); if(b) this.chat.opytaj(b.textContent); };
    this.el = a;
  },
  zostava(){ return window.aktualnaZostava ? window.aktualnaZostava() : this.b; },
  /* Otvorí panel pre zostavu b a hneď položí úvodnú otázku. */
  otvor(b, nazov){
    if(!this.el) this.vytvor();
    this.b = b; this.nazov = nazov;
    this.el.hidden = false; requestAnimationFrame(() => this.el.classList.add("otvoreny"));
    document.body.classList.add("panel-otvoreny");
    this.popis();
    this.el.querySelector("#panelRychle").innerHTML = ["Na aké hry a programy sa zostava hodí?", "Čo by som mal vylepšiť ako prvé?", "Stačí zdroj aj pri neskoršom upgrade grafiky?", "Ako namontujem chladič?"]
      .map(t => `<button type="button">${t}</button>`).join("");
    const ok = bezChyby(this.zostava());
    this.chat.opytaj(ok ? "Je táto zostava v poriadku a na čo sa hodí?" : "Prečo táto zostava nie je v poriadku a ako ju opraviť?");
  },
  popis(){
    const b = this.zostava(); if(!b || !this.el) return;
    this.el.querySelector("#panelZostava").textContent = `${nazovZostavy(b) || (b === this.b && this.nazov) || "Vlastná zostava"}, ${eur(price(b))}. Otázky sa vzťahujú na túto zostavu.`;
  },
  zavri(){
    this.el.classList.remove("otvoreny"); document.body.classList.remove("panel-otvoreny");
    setTimeout(() => { if(!this.el.classList.contains("otvoreny")) this.el.hidden = true; }, 250);
  },
};
