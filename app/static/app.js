const $ = (s) => document.querySelector(s);
// Na GitHub Pages je len táto stránka, server s RAG beží u vás na localhoste.
// Inú adresu servera nastavíte v URL: ?api=http://localhost:9000
const NA_PAGES = location.hostname.endsWith("github.io");
const API = new URLSearchParams(location.search).get("api") ?? (NA_PAGES ? "http://localhost:8000" : "");
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- stav indexu a zoznam zdrojov ---------- */
async function nacitajStav() {
  try {
    const s = await (await fetch(`${API}/api/stav`)).json();
    $("#llm").textContent = s.llm;
    $("#embed").textContent = s.embed;
    const jack = $("#stav");
    jack.parentElement.classList.toggle("chyba", s.stav === "chyba");
    jack.textContent = s.stav === "pripravene" ? `${s.uryvky} úryvkov v indexe`
      : s.stav === "chyba" ? "Chyba indexu" : s.sprava || "Indexujem";
    vykresliZdroje(s);
    if (s.stav === "indexujem") setTimeout(nacitajStav, 1500);
  } catch {
    $("#stav").textContent = "Server neodpovedá";
    $("#zdroje-zoznam").innerHTML = `<p class="tichy">Lokálny server na <code>${esc(API || location.origin)}</code> nebeží.</p>
      <p class="tichy male">Spustite ho príkazom <code>docker compose up</code>. Stránka sa pripojí sama.</p>`;
    setTimeout(nacitajStav, 3000);
  }
}

function vykresliZdroje(s) {
  const box = $("#zdroje-zoznam");
  if (s.stav === "chyba") {
    box.innerHTML = `<p class="tichy">${esc(s.sprava)}</p><p class="tichy male">Skontrolujte, či beží Ollama, a kliknite na Načítať zdroje znova.</p>`;
    return;
  }
  if (!s.zdroje.length) {
    box.innerHTML = `<p class="tichy">${esc(s.sprava || "Index sa vytvára.")}</p>`;
    return;
  }
  const skupina = (nadpis, polozky) => polozky.length ? `
    <div class="skupina"><h3>${nadpis}</h3><ul>${polozky.map((z) => `
      <li class="${z.chyba ? "zly" : ""}" title="${esc(z.chyba || "")}">
        <span>${esc(z.nazov)}</span>
        <span>${z.chyba ? "nečitateľné" : z.druh === "pdf" ? `${z.strany} str.` : `${z.uryvky} úryvkov`}</span>
      </li>`).join("")}</ul></div>` : "";
  const pdf = s.zdroje.filter((z) => z.druh === "pdf");
  box.innerHTML =
    skupina(`PDF dokumenty (${pdf.length})`, pdf) +
    skupina("Ontológia", s.zdroje.filter((z) => z.druh === "ontologia")) +
    (pdf.length ? "" : `<p class="tichy male">Zatiaľ žiadne PDF.</p>`);
}

$("#reindex").addEventListener("click", async () => {
  await fetch(`${API}/api/reindex`, { method: "POST" });
  nacitajStav();
});

/* ---------- jednoduché zobrazenie odpovede (odseky, odrážky, tučné, [n]) ---------- */
function formatuj(text) {
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, n) =>
      n.split(",").map((x) => `<button type="button" class="plocka" data-n="${x.trim()}">${x.trim()}</button>`).join(""));
  return text.trim().split(/\n{2,}/).map((blok) => {
    const riadky = blok.split("\n");
    if (riadky.every((r) => /^\s*[-*•]\s+/.test(r)))
      return `<ul>${riadky.map((r) => `<li>${inline(r.replace(/^\s*[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${riadky.map(inline).join("<br>")}</p>`;
  }).join("");
}

function vykresliZoznam(zdroje) {
  return `<ol class="zoznam-zdrojov">${zdroje.map((z, i) => `
    <li><details data-n="${i + 1}">
      <summary><span class="plocka">${i + 1}</span>
        <span class="meno">${esc(z.druh === "pdf" ? z.zdroj : z.miesto)}</span>
        <span class="miesto">${esc(z.druh === "pdf" ? z.miesto : "ontológia")}</span></summary>
      <pre>${esc(z.text)}</pre>
    </details></li>`).join("")}</ol>`;
}

/* ---------- otázka ---------- */
async function opytajSa(otazka) {
  $("#prazdne")?.remove();
  const blok = document.createElement("article");
  blok.innerHTML = `<p class="otazka-bublina">${esc(otazka)}</p>
    <div class="odpoved"><p class="caka">Hľadám v dokumentoch</p></div><div class="zdroje-odpovede"></div>`;
  $("#konverzacia").append(blok);
  blok.scrollIntoView({ behavior: "smooth", block: "start" });
  const odp = blok.querySelector(".odpoved");
  $("#poslat").disabled = true;

  let text = "";
  try {
    const r = await fetch(`${API}/api/otazka`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otazka }),
    });
    const citac = r.body.getReader();
    const dek = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await citac.read();
      if (done) break;
      buffer += dek.decode(value, { stream: true });
      const riadky = buffer.split("\n");
      buffer = riadky.pop();
      for (const riadok of riadky.filter(Boolean)) {
        const m = JSON.parse(riadok);
        if (m.typ === "zdroje") {
          blok.querySelector(".zdroje-odpovede").innerHTML = vykresliZoznam(m.zdroje);
          odp.innerHTML = `<p class="caka">Píšem odpoveď</p>`;
        } else if (m.typ === "text") {
          text += m.text;
          odp.innerHTML = formatuj(text);
        } else if (m.typ === "chyba") {
          odp.classList.add("chyba");
          odp.innerHTML = `<p>${esc(m.sprava)}</p>`;
        }
      }
    }
    if (!text && !odp.classList.contains("chyba")) odp.innerHTML = "<p>Model nevrátil žiadnu odpoveď.</p>";
  } catch (e) {
    odp.classList.add("chyba");
    odp.innerHTML = `<p>Spojenie so serverom zlyhalo: ${esc(String(e))}</p>`;
  } finally {
    $("#poslat").disabled = false;
  }
}

// klik na plôšku [n] v odpovedi otvorí príslušný zdroj
$("#konverzacia").addEventListener("click", (e) => {
  const p = e.target.closest(".odpoved .plocka");
  if (p) {
    const d = p.closest("article").querySelector(`details[data-n="${p.dataset.n}"]`);
    if (!d) return;
    d.open = true;
    d.classList.add("svieti");
    d.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => d.classList.remove("svieti"), 1600);
  }
  const priklad = e.target.closest(".priklady button");
  if (priklad) opytajSa(priklad.textContent);
});

const pole = $("#otazka");
$("#formular").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = pole.value.trim();
  if (!q || $("#poslat").disabled) return;
  pole.value = "";
  pole.style.height = "";
  opytajSa(q);
});
pole.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#formular").requestSubmit(); }
});
pole.addEventListener("input", () => { pole.style.height = ""; pole.style.height = pole.scrollHeight + "px"; });

if (matchMedia("(max-width: 760px)").matches) $("#zdroje-panel").open = false;
nacitajStav();
