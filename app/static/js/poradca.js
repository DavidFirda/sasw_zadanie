"use strict";
const OTAZKY = {
  "Komponenty a kompatibilita": [
    "Aký socket má Ryzen 5 5600X a ktoré dosky ho podporujú?",
    "Zmestí sa grafika Sapphire RX 9070 XT do skrinky Cooler Master NR200P?",
    "Stačí zdroj be quiet! Pure Power 12 M 650W pre Radeon RX 9070 XT?",
    "Ktorý chladič sa hodí k procesoru Ryzen 5 7600X?",
    "Akú pamäť RAM potrebujem k doske MSI MAG B650M Mortar?",
  ],
  "Ontológia a pravidlá": [
    "Ktoré pravidlo zistí, že procesor nepasuje na základnú dosku?",
    "Čo musí spĺňať herná zostava?",
    "Aké typy problémov so zostavou ontológia pozná?",
    "Čo je podľa ontológie kompaktná skrinka?",
    "Prečo má zostava Test_ZlySocketAPamat problémy?",
  ],
  "Z manuálov (PDF)": [
    "Ako sa montuje chladič Noctua NH-D15 na socket AM5?",
    "Koľko M.2 slotov má doska MSI MAG B650M Mortar a ako sa do nich montuje disk?",
    "Aké konektory má zdroj Corsair SF750?",
    "Akú rýchlosť čítania a zápisu má Samsung 870 EVO?",
  ],
  "Mimo zdrojov (test)": [
    "Kto vyhral majstrovstvá sveta v hokeji v roku 2024?",
    "Koľko dnes stojí grafika RTX 4090 v obchode?",
    "Aký notebook si mám kúpiť do školy?",
    "Aká bude cena pamätí RAM budúci rok?",
    "Napíš mi básničku o procesore.",
  ],
};

spusti(() => {
  $("otazky").innerHTML = Object.entries(OTAZKY).map(([skupina, q]) =>
    `<div class="skupina-otazok"><h3>${skupina}</h3><div class="navrhy">${q.map(t => `<button type="button">${esc(t)}</button>`).join("")}</div></div>`).join("");
  const chat = pripojChat($("chat"));
  $("otazky").onclick = e => { const b = e.target.closest("button"); if(b) chat.opytaj(b.textContent); };
  $("reindex").onclick = async () => { await fetch(API_BASE + "/api/reindex", {method: "POST"}); nacitajStav(); };
  nacitajStav();
}, {katalog: false});

async function nacitajStav(){
  let s;
  try{ s = await apiGet("/api/stav"); }
  catch(e){ $("modely").innerHTML = ""; $("zdroje").innerHTML = serverNebezi(); setTimeout(nacitajStav, 3000); return; }
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
      + skupina("Ontológia ako katalóg konfigurátora", s.zdroje.filter(z => z.druh === "katalog"));
  }
  if(s.stav === "indexujem") setTimeout(nacitajStav, 1500);
}
