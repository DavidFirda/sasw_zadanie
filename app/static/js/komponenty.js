"use strict";
/* Komponenty: karty podľa kategórie, hľadanie a filter výrobcu. */
spusti(() => {
  let kat = new URLSearchParams(location.search).get("kategoria") || "grafika"; if(!KATMAP[kat]) kat = "grafika";
  const kresliKarty = () => {
    $("karty").innerHTML = KAT.map(k => `<button role="tab" type="button" data-k="${k.id}" aria-selected="${k.id===kat}">${esc(k.nazov)}<span>${byKat(k.id).length}</span></button>`).join("");
    const v = [...new Set(byKat(kat).map(x => x.vyrobca))].sort();
    $("vyrobca").innerHTML = `<option value="">Všetci výrobcovia</option>` + v.map(x => `<option>${esc(x)}</option>`).join("");
  };
  const kresli = () => {
    const q = $("hladat").value.trim().toLowerCase(), v = $("vyrobca").value;
    const rows = byKat(kat).filter(x => (!q || x.nazov.toLowerCase().includes(q)) && (!v || x.vyrobca === v));
    $("riadky").innerHTML = rows.map(x => `<tr><td><div class="n">${esc(x.nazov)}</div><div class="s">${esc(x.vyrobca)}</div></td>
      <td><div class="s">${esc(specLine(x))}</div>${x.pozn ? `<div class="s">${esc(x.pozn)}</div>` : ""}${x.src ? `<div class="zdroj">${[].concat(x.src).map((u,i) => `<a href="${esc(u)}" target="_blank" rel="noopener">Zdroj údajov${x.src.length > 1 ? " " + (i+1) : ""}</a>`).join(", ")}</div>` : ""}</td>
      <td class="cena">${eur(x.cena)}</td><td><a class="btn btn-2 btn-s" href="konfigurator.html?pridat=${encodeURIComponent(x.id)}">Vložiť do zostavy</a></td></tr>`).join("")
      || `<tr><td colspan="4" class="jemny">Nič sa nenašlo. Skúste iný názov alebo zrušte filter výrobcu.</td></tr>`;
  };
  $("karty").onclick = e => { const b = e.target.closest("button"); if(b){ kat = b.dataset.k; $("hladat").value = ""; kresliKarty(); kresli(); } };
  $("hladat").oninput = kresli; $("vyrobca").onchange = kresli;
  kresliKarty(); kresli();
});
