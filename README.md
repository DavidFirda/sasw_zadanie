# PC konfigurátor s poradcom (RAG)

Webová aplikácia nad ontológiou PC konfigurátora: **hotové zostavy**, **3D konfigurátor** s kontrolou
kompatibility, prehľad **komponentov** a **poradca**, ktorý odpovedá metódou RAG len z vlastných
zdrojov: z ~10 PDF dokumentov (manuály a datasheety), z ontológie zo Zadania 1 a z katalógu
konfigurátora. Jazykový model aj embeddingy bežia lokálne cez [Ollamu](https://ollama.com).

| Bod zadania 3 | Kde je splnený |
|---|---|
| 1. Spojazdniť RAG u seba lokálne | Ollama (`gemma3:4b` na odpovede, `bge-m3` na embeddingy), kód v `app/rag.py` |
| 2. Pridať ±10 PDF a ontológiu z 1. zadania | `data/pdf/` (PDF), `data/ontologia/pc_konfigurator.owx` (ontológia z WebProtégé) |
| 3. Appka / web | web na http://localhost:8000 alebo na GitHub Pages; poradca na stránke **Poradca** a z konfigurátora tlačidlom **Opýtať sa poradcu na zostavu** |
| 4. Dokumentácia + obhajoba | tento súbor, časť [Obhajoba](#obhajoba) |

## Spustenie

### A) Python (najjednoduchšie)

1. Nainštalujte Ollamu z https://ollama.com/download a stiahnite modely (raz, ~4,5 GB):
   ```bash
   ollama pull gemma3:4b
   ollama pull bge-m3
   ```
2. Spustite server (Python 3.10+):
   ```bash
   cd app
   pip install -r requirements.txt
   python -m uvicorn main:app --port 8000
   ```
3. Otvorte http://localhost:8000.

### B) Docker

Ollama beží priamo v počítači (ako v kroku A.1), server v Dockeri:

```bash
copy .env.example .env        # Linux/macOS: cp .env.example .env
docker compose pull app       # stiahne hotový image z GitHubu (APP_IMAGE v .env)
docker compose up
```

Bez `docker compose pull` sa image postaví lokálne. Ak chcete aj Ollamu v Dockeri, nastavte
v `.env` `OLLAMA_URL=http://ollama:11434` a spustite `docker compose --profile ollama up`
(modely sa stiahnu samé pri prvom štarte, na procesore je to pomalšie).

Pri prvom spustení sa počítajú embeddingy všetkých úryvkov (1–5 minút podľa počtu PDF), stav
vidno v hlavičke webu a na stránke Poradca. Výsledok sa uloží do `data/.index/`; ďalšie spustenia ho len načítajú.

### C) Web na GitHub Pages

GitHub Pages hosťuje len statické súbory, preto je na `github.io` iba web. Server (katalóg,
poradca) beží u vás a web sa k nemu pripája na `http://localhost:8000`. Funguje to
teda len na počítači, kde server beží.

| Workflow | Kedy sa spustí | Výsledok |
|---|---|---|
| `.github/workflows/pages.yml` | push do `main` so zmenou v `app/static/` | web na `https://<účet>.github.io/<repozitár>/` |
| `.github/workflows/docker.yml` | push do `main` so zmenou v `app/` | image `ghcr.io/<účet>/<repozitár>:latest` |

Prvé nastavenie: v repozitári **Settings → Pages → Source: GitHub Actions**, potom v **Actions**
spustiť „Web na GitHub Pages" cez **Run workflow**. Image nastavte ako verejný na profile v
**Packages → Package settings → Change visibility**.

Chrome sa pri prvom otvorení stránky z github.io opýta na prístup k lokálnej sieti, zvoľte
**Povoliť**. Server na inom porte nastavíte v adrese: `…/?api=http://localhost:9000`.

## PDF dokumenty

PDF patria do `data/pdf/`. Po zmene kliknite na stránke Poradca na **Načítať zdroje znova**.
Manuály výrobcov do verejného repozitára radšej nedávajte (autorské práva).

| # | Dokument | Odkaz |
|---|---|---|
| 1 | Noctua NH-D15 – návod na montáž | [noctua.at](https://noctua.at/pub/media/blfa_files/manual/noctua_nh_d15_manual_en_web_3.pdf) |
| 2 | Noctua NM-AM5 – montáž na socket AM5 | [noctua.at](https://noctua.at/pub/media/blfa_files/manual/noctua_nm_am5_4_MP78_manual_en_web_1.pdf) |
| 3 | MSI MAG B650M MORTAR – príručka k doske | [msi.com](https://download-2.msi.com/archive/mnu_exe/mb/MAGB650MMORTAR.pdf) |
| 4 | Corsair SF Platinum (SF750) – manuál zdroja | [corsair.com](https://assets.corsair.com/image/upload/corsairmedia/sys_master/productcontent/SF_PLATINUM_User_Manual.pdf) |
| 5 | be quiet! Pure Power 12 M – manuál zdroja | [mediaexpert.pl](https://www.mediaexpert.pl/products/files/72/7226476/Instrukcja-obslugi-BE-QUIET-Pure-Power-12.pdf) |
| 6 | AMD Ryzen 7000 – prehľad procesorov | [amd.com](https://www.amd.com/content/dam/amd/en/documents/partner-hub/ryzen/amd-ryzen-7000-series-desktop-processors-quick-reference-guide.pdf) |
| 7 | Kingston FURY Beast DDR5-6000 – datasheet | [kingston.com](https://www.kingston.com/datasheets/KF560C36BWE2K2-32.pdf) |
| 8 | Samsung SSD 870 EVO – datasheet | [samsung.com](https://download.semiconductor.samsung.com/resources/data-sheet/Samsung_SSD_870_EVO_Data_Sheet_Rev1.1_230509_10129500053000.pdf) |
| 9 | Crucial P3 Plus – produktový list | [crucial.com](https://crucial.com/content/dam/crucial/ssd-products/p3-plus/flyers/b2c/crucial-p3plus-productflyer-consumer.pdf) |
| 10 | Cooler Master NR200P – produktový list skrinky | [igorslab.de](https://www.igorslab.de/wp-content/uploads/2022/02/Product-Sheet-MasterBox-NR200P-Color-Variants.pdf) |

## Ako to funguje

```
KONFIGURÁTOR
  data/katalog/pc_konfigurator.owl ─► rdflib (SPARQL) ─► /api/katalog ─► web: zostavy, 3D konfigurátor, komponenty
PORADCA (RAG)
  data/pdf/*.pdf ───────────────┐
  data/ontologia/*.owx ─────────┼─► úryvky textu ─► bge-m3 ─► vektory (data/.index/)
  katalóg konfigurátora ────────┘
  otázka (+ zostava z konfigurátora) ─► bge-m3 ─► 6 najpodobnejších úryvkov ─► gemma3:4b ─► odpoveď s [1]…[6]
```

**Konfigurátor.** Katalóg (52 komponentov, 12 hotových zostáv, pravidlá) sa číta SPARQL dopytmi
z úplnej ontológie `pc_konfigurator.owl`. Konfigurátor kontroluje kompatibilitu podľa SWRL pravidiel
R01–R16 (socket, typ RAM, rozmery, výkon zdroja); kliknutím na kód pravidla sa ukáže jeho zápis
v ontológii. 3D model sa kreslí z rozmerov v ontológii (three.js), vzhľad dopĺňa `vizual.json`.

**Poradca.**
1. *Zdroje* (`app/rag.py`): PDF sa delia na úryvky po ~1000 znakov s prekryvom 200 (pamätajú
   si stranu). Ontológia z WebProtégé (`app/ontologia.py`) sa prečíta zo súboru OWL/XML a každá
   trieda, vlastnosť, individuum a SWRL pravidlo je jeden odsek textu (226 úryvkov). Katalóg
   konfigurátora pridá komponenty, pravidlá a hotové zostavy (83 úryvkov, `app/katalog_text.py`).
2. *Embeddingy*: `bge-m3` (viacjazyčný) zmení úryvky na vektory, uložia sa do `data/.index/`.
3. *Vyhľadanie*: otázka sa zmení na vektor, vyberie sa 6 úryvkov s najvyššou kosínusovou podobnosťou.
   Pri otázke na zostavu sa hľadá aj podľa jej dielov.
4. *Generovanie*: `gemma3:4b` dostane očíslované úryvky, a ak sa pýtate z konfigurátora alebo
   z hotových zostáv, aj danú zostavu s výsledkami kontrol. Odpovedá po slovensky len z nich
   a cituje ich ako `[1]`.
5. *Web*: odpoveď prichádza priebežne; kliknutím na číslo sa ukáže presný úryvok (strana PDF,
   entita ontológie alebo položka katalógu).

Prečo dve ontológie: konfigurátor potrebuje úplný katalóg s rozmermi a cenami (`pc_konfigurator.owl`,
52 komponentov), poradca indexuje ontológiu, ktorú ste ručne vytvorili vo WebProtégé v Zadaní 1.

Príklad úryvku z ontológie:
```
Pravidlo SWRL Z01 (ontológia PC konfigurátora).
Ak platí: Zostava(?z) ∧ maProcesor(?z, ?c) ∧ maDosku(?z, ?d) ∧ procesorNepasujeNaDosku(?c, ?d)
Potom platí: maProblem(?z, Problem_Socket)
```

## Štruktúra projektu

```
app/
  main.py          server (FastAPI): /api/katalog, /api/stav, /api/otazka, /api/reindex
  sparql.py        načítanie katalógovej ontológie do rdflib
  katalog.py       katalóg zo SPARQL dopytov
  kontrola.py      kontrola kompatibility (pre poradcu)
  rag.py           poradca: zdroje, embeddingy, vyhľadávanie, odpoveď
  ontologia.py     ontológia zo Zadania 1 (.owx) na úryvky textu
  katalog_text.py  katalóg a aktuálna zostava ako text pre poradcu
  static/          web: index.html (hotové zostavy), konfigurator.html, komponenty.html, poradca.html
data/
  katalog/         pc_konfigurator.owl a vizual.json (konfigurátor, 3D)
  ontologia/       ontológia zo Zadania 1 (poradca)
  pdf/             PDF dokumenty (poradca)
.github/workflows/ GitHub Pages a Docker image
```

## Nastavenia

| Premenná | Predvolene | Význam |
|---|---|---|
| `LLM_MODEL` | `gemma3:4b` | model na odpovede (slabší počítač `gemma3:1b`) |
| `EMBED_MODEL` | `bge-m3` | model na embeddingy |
| `OLLAMA_URL` | `http://localhost:11434` | adresa Ollamy (v Dockeri `host.docker.internal`) |
| `TOP_K` | `6` | počet úryvkov v kontexte |
| `CORS_ORIGINS` | `https://[\w-]+\.github\.io` | z ktorých stránok smie web volať server |

## Riešenie problémov

- **Stránka hlási, že server neodpovedá**: spustite server (časť Spustenie) a obnovte stránku.
- **Poradca: „Ollama nebeží"**: spustite Ollamu a kliknite na Načítať zdroje znova.
- **Chyba „model … not found"**: `ollama pull <model>`.
- **GitHub stránka sa nepripojí, localhost áno**: v Chrome povoľte prístup k lokálnej sieti
  (ikona vľavo od adresy → Nastavenia lokality). Safari to môže blokovať.
- **PDF je „nečitateľné"**: súbor je poškodený alebo chránený, nahraďte ho.

## Obhajoba

1. **Lokálny beh**: stránka Poradca ukazuje modely, počet úryvkov a všetky zdroje (10 PDF,
   ontológia, katalóg konfigurátora). Pridajte jedno PDF, kliknite na Načítať zdroje znova a ukážte, že pribudlo.
2. **Otázka na PDF**: „Ako sa montuje chladič Noctua NH-D15 na socket AM5?" Kliknite na `[1]`
   a ukážte stranu manuálu.
3. **Otázka na ontológiu**: „Ktoré pravidlo zistí, že procesor nepasuje na základnú dosku?"
4. **RAG v konfigurátore**: vyberte nekompatibilný diel (napr. pamäť DDR4 k doske s DDR5) a
   kliknite na **Opýtať sa poradcu na zostavu**. Poradca vidí vašu zostavu aj výsledky kontrol.
5. **Otázka mimo zdrojov**: „Kto vyhral MS v hokeji?" Poradca má povedať, že to v zdrojoch nie je.

Časté otázky: *Prečo RAG?* Model sám nepozná vaše PDF ani ontológiu a vymýšľal by si; RAG mu
dodá presné úryvky a odpoveď sa dá overiť. *Ako sa do RAG dostala ontológia?* Každá entita
a pravidlo sa prevedie na odsek textu a indexuje sa rovnako ako PDF. *Prečo bge-m3?* Je
viacjazyčný, slovenská otázka nájde aj anglický text manuálu.
