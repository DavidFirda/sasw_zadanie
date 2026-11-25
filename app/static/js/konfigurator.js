"use strict";
/* Konfigurátor: výber dielov, 3D/2D náhľad, kontrola kompatibility, otázka na poradcu. */
let B = null, lenKomp = false, rezim = "3d";

spusti(() => {
  B = Uloz.get("zostava", null);                         // rozpracovaná zostava z minula
  if(!platnaZostava(B)) B = structuredClone(PRESETS[0].b);
  if(!V3.ok){ rezim = "2d"; document.querySelector('[data-mode="3d"]').disabled = true; }

  window.klikNaDiel = cat => zvolKategoriu(cat, true);   // volá 3D náhľad
  window.aktualnaZostava = () => B;                       // bočný poradca sa pýta na aktuálnu zostavu
  $("svgHost").addEventListener("click", e => { const g = e.target.closest(".part"); if(g) zvolKategoriu(g.dataset.cat, true); });
  $("svgHost").addEventListener("keydown", e => { const g = e.target.closest(".part"); if(g && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); zvolKategoriu(g.dataset.cat, true); } });
  $("kategorie").onclick = e => { const t = e.target.closest("button"); if(t) zvolKategoriu(t.dataset.cat); };
  $("moznosti").onclick = e => {
    const o = e.target.closest(".moznost"); if(!o) return; const id = o.dataset.id || null;
    if(KATMAP[activeCat].multi){ const nb = withPart(B, activeCat, id); nastav(nb); if(!nb.ulozisko.length) toast("Zostava potrebuje aspoň jeden disk."); }
    else if(B[activeCat] !== id) nastav(withPart(B, activeCat, id));
  };
  $("lenKomp").onchange = e => { lenKomp = e.target.checked; kresliMoznosti(); };
  $("preset").onchange = e => { const p = PRESETS.find(x => x.id === e.target.value); if(p) nastav(structuredClone(p.b), `Načítaná zostava ${p.nazov}`); };
  document.querySelector(".pohlad-prep .prepinac").onclick = e => { const b = e.target.closest("button"); if(!b || b.disabled) return; rezim = b.dataset.mode; kresli(); };
  $("kontroly").onclick = e => { const r = e.target.closest(".pravidlo[data-r]"); if(r) ukazPravidlo(r.dataset.r); };
  $("btnPoradca").onclick = () => Panel.otvor(B, nazovZostavy(B));   // bočný poradca (chat.js)
  kresli();
});

function nastav(nb, sprava){ B = nb; Uloz.set("zostava", B); kresli(); Panel.popis(); if(sprava) toast(sprava); }
function zvolKategoriu(cat, posun){
  activeCat = cat; kresli();
  if(posun && innerWidth < 1100) $("kategorie").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
}

function kresli(){
  document.querySelectorAll(".pohlad-prep [data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === rezim));
  $("host3d").hidden = rezim !== "3d"; $("svgHost").hidden = rezim === "3d";
  $("pohladInfo").textContent = rezim === "3d" ? "Ťahaním otočíte, kolieskom priblížite, kliknutím na diel ho zmeníte." : "Bokorys v mierke. Kliknutím na diel ho zmeníte.";
  if(rezim === "3d") V3.render(B); else $("svgHost").innerHTML = renderSVG(B);
  $("merace").innerHTML = renderGauges(B);
  kresliKategorie(); kresliMoznosti(); kresliSuhrn(); kresliPreset();
}
function stavKategorie(cat){ if(missing(B).includes(cat)) return "none"; return checks(B).some(x => !x.ok && x.cats.includes(cat)) ? "bad" : "ok"; }
function hodnotaKategorie(cat){
  const v = B[cat];
  if(Array.isArray(v)) return v.length ? v.map(i => shortName(C[i])).join(" + ") : "nevybraté";
  if(!v) return cat === "grafika" ? "integrovaná grafika" : "nevybraté";
  return shortName(C[v]);
}
function kresliKategorie(){
  $("kategorie").innerHTML = KAT.map(k => { const s = stavKategorie(k.id);
    return `<button role="tab" type="button" data-cat="${k.id}" aria-selected="${activeCat===k.id}"><i class="${s==="ok"?"":s}" aria-hidden="true"></i><b>${esc(k.nazov)}</b><span>${esc(hodnotaKategorie(k.id))}</span></button>`; }).join("");
}
function kresliMoznosti(){
  const k = KATMAP[activeCat]; $("katNazov").textContent = k.nazov;
  const ids = byKat(activeCat).map(x => x.id); if(activeCat === "grafika") ids.push(null);
  const teraz = price(B);
  const html = ids.map(id => {
    if(id === null){
      const c = C[B.procesor]; const ok = c && c.igpu; const sel = !B.grafika; if(lenKomp && !ok && !sel) return "";
      return `<button type="button" class="moznost${ok?"":" nekomp"}" data-id="" aria-pressed="${sel}"><span class="n">Bez grafickej karty</span><span class="c">${sel ? "" : "−" + eur(C[B.grafika]?.cena || 0)}</span><span class="s">Obraz cez integrovanú grafiku procesora.</span>${ok ? "" : `<span class="w">${esc(shortName(c))} nemá integrovanú grafiku</span>`}</button>`;
    }
    const x = C[id]; const sel = k.multi ? B.ulozisko.includes(id) : B[activeCat] === id;
    const cand = withPart(B, activeCat, id); const probs = checks(cand).filter(p => !p.ok && p.cats.includes(activeCat));
    if(lenKomp && probs.length && !sel) return "";
    const diff = price(cand) - teraz;
    const cena = k.multi ? (sel ? "v zostave" : "+" + eur(x.cena)) : (sel ? eur(x.cena) : (diff >= 0 ? "+" : "−") + eur(Math.abs(diff)));
    return `<button type="button" class="moznost${probs.length?" nekomp":""}" data-id="${id}" aria-pressed="${sel}">
      <span class="n">${esc(x.nazov)}</span><span class="c">${cena}</span><span class="s">${esc(specLine(x))}</span>
      ${probs.map(p => `<span class="w">${esc(p.text)}</span>`).join("")}</button>`;
  }).join("");
  $("moznosti").innerHTML = html || `<p class="jemny">Žiadny diel v tejto kategórii nepasuje k zvyšku zostavy. Vypnite filter alebo zmeňte iný diel.</p>`;
}
function kresliSuhrn(){
  const ch = checks(B), zle = ch.filter(x => !x.ok), miss = missing(B), ok = !zle.length && !miss.length, n = zle.length + miss.length;
  $("spolu").textContent = eur(price(B));
  const s = $("stav"); s.className = "stav " + (ok ? "ok" : "bad");
  s.textContent = ok ? `Zostava je v poriadku, odhad spotreby ${powerEst(B)} W` : `${n} ${n === 1 ? "problém" : n < 5 ? "problémy" : "problémov"} s kompatibilitou`;
  $("kontrolySum").textContent = ok ? `Kontrola kompatibility: všetkých ${ch.length} v poriadku` : `Kontrola kompatibility: ${n} na opravu`;
  if(!ok) $("kontrolyBox").open = true;
  const li = x => `<li class="${x.ok?"ok":"bad"}"><span class="ic" aria-hidden="true">${x.ok?"✓":"✕"}</span><span>${esc(x.text)}</span><button class="pravidlo" type="button" data-r="${x.rule}" aria-label="Pravidlo ${x.rule}">${x.rule}</button></li>`;
  $("kontroly").innerHTML = zle.map(li).join("") + miss.map(m => `<li class="bad"><span class="ic">○</span><span>Chýba: ${esc(KATMAP[m].nazov)}</span><span></span></li>`).join("") + ch.filter(x => x.ok).map(li).join("");
}
function kresliPreset(){
  const m = nazovZostavy(B);
  $("preset").innerHTML = `<option value="">${m ? "Hotová zostava" : "Vlastná zostava"}</option>` + Object.entries(TIERS).map(([t,tn]) => `<optgroup label="${tn}">` +
    PRESETS.filter(p => p.tier === t).map(p => `<option value="${p.id}" ${m === p.nazov ? "selected" : ""}>${esc(p.nazov)} (${eur(price(p.b))})</option>`).join("") + "</optgroup>").join("");
}
