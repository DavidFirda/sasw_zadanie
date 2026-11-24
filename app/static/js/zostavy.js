"use strict";
/* Hotové zostavy: filter podľa cenovej kategórie a zoradenie podľa ceny. */
spusti(() => {
  let tier = new URLSearchParams(location.search).get("kategoria") || "vsetky", smer = "asc";
  const kresli = () => {
    $("tierPrep").innerHTML = [["vsetky","Všetky"], ...Object.entries(TIERS).filter(([t]) => PRESETS.some(p => p.tier === t))].map(([t,n]) => `<button type="button" data-t="${t}" aria-pressed="${t===tier}">${n}</button>`).join("");
    const z = PRESETS.filter(p => tier === "vsetky" || p.tier === tier).sort((a,b) => (price(a.b) - price(b.b)) * (smer === "asc" ? 1 : -1));
    $("zoznam").innerHTML = z.map(zostavaRiadok).join("") || `<p class="jemny">V ontológii zatiaľ nie je žiadna hotová zostava. Pridajte individuum triedy Zostava s vlastnosťami cenovaKategoria a ucelPopis.</p>`;
  };
  $("tierPrep").onclick = e => { const b = e.target.closest("button"); if(b){ tier = b.dataset.t; kresli(); } };
  $("zoradit").onchange = e => { smer = e.target.value; kresli(); };
  kresli();
});
