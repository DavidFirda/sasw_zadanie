# Zadanie 3: RAG nad PDF dokumentmi a ontológiou PC konfigurátora

Lokálny poradca, ktorý odpovedá na otázky o PC komponentoch. Odpovede skladá **len z vlastných
zdrojov**: z ~10 PDF dokumentov (manuály a datasheety komponentov) a z ontológie PC konfigurátora
zo Zadania 1. Jazykový model aj embeddingy bežia lokálne cez [Ollamu](https://ollama.com),
nič sa neposiela na internet.

| Bod zadania | Kde je splnený |
|---|---|
| 1. Spojazdniť RAG u seba lokálne | Ollama (`gemma3:4b` na odpovede, `bge-m3` na embeddingy) + Python server v `app/` |
| 2. Pridať ±10 PDF a ontológiu z 1. zadania | `data/pdf/` (PDF), `data/ontologia/pc_konfigurator.owx` (ontológia z WebProtégé) |
| 3. Appka / web | webová stránka na http://localhost:8000 alebo na GitHub Pages (`app/static/`) |
| 4. Dokumentácia + obhajoba | tento súbor, časť [Obhajoba](#obhajoba) |

## Spustenie

### A) Bez Dockeru (odporúčané, Ollama vie využiť grafickú kartu)

1. Nainštalujte Ollamu z https://ollama.com/download a nechajte ju bežať.
2. Stiahnite modely (stačí raz, spolu ~4,5 GB):
   ```bash
   ollama pull gemma3:4b
   ollama pull bge-m3
   ```
3. Nainštalujte Python balíky (Python 3.10+) a spustite server:
   ```bash
   cd app
   pip install -r requirements.txt
   python -m uvicorn main:app --port 8000
   ```
   Na Windows použite `py -m pip …` a `py -m uvicorn …`.
4. Otvorte http://localhost:8000.

Pri prvom spustení sa počítajú embeddingy všetkých úryvkov (podľa počtu PDF 1–5 minút).
Výsledok sa uloží do `data/.index/`, ďalšie spustenia sú okamžité.

### B) Docker

```bash
docker compose up --build
```

Otvorte http://localhost:8000. Aplikácia pri prvom štarte sama stiahne oba modely do Ollamy
v kontajneri (stav vidno v hlavičke stránky). V Dockeri beží model na procesore, odpovede sú
pomalšie. Ak máte Ollamu nainštalovanú priamo v počítači, nastavte v `.env`
`OLLAMA_URL=http://host.docker.internal:11434` (viď `.env.example`).

### C) GitHub: web na GitHub Pages, server u vás

GitHub Pages vie hosťovať iba statické súbory, preto je na `github.io` len webová stránka.
Server s vyhľadávaním a model bežia u vás a stránka sa k nim pripojí na `http://localhost:8000`.
Funguje to teda len na počítači, kde server beží; inde stránka ukáže „Server neodpovedá".

V repozitári sú dva automatické workflowy (`.github/workflows/`):

| Workflow | Kedy sa spustí | Výsledok |
|---|---|---|
| `pages.yml` | push do `main` so zmenou v `app/static/` | stránka na `https://<účet>.github.io/<repozitár>/` |
| `docker.yml` | push do `main` so zmenou v `app/` | image `ghcr.io/<účet>/<repozitár>:latest` (amd64 aj arm64) |

Prvé nastavenie:

1. Vytvorte na GitHube repozitár (napr. `pc-rag`) a nahrajte doň obsah tohto priečinka:
   ```bash
   git init && git add . && git commit -m "RAG nad PDF a ontológiou"
   git branch -M main
   git remote add origin https://github.com/<účet>/pc-rag.git
   git push -u origin main
   ```
2. V repozitári otvorte **Settings → Pages** a v **Source** zvoľte **GitHub Actions**. Potom v
   záložke **Actions** spustite znova workflow „Web na GitHub Pages" (prvý beh pred týmto
   nastavením zlyhá).
3. Po dobehnutí workflowu „Docker image" nastavte image ako verejný: na svojom profile
   **Packages → pc-rag → Package settings → Change visibility → Public**. Inak treba pred
   stiahnutím `docker login ghcr.io`.

Spustenie servera u vás z hotového image:

```bash
cp .env.example .env        # Windows: copy .env.example .env
# v .env nastavte APP_IMAGE=ghcr.io/<účet>/pc-rag:latest (malými písmenami)
docker compose pull app
docker compose up
```

Potom otvorte `https://<účet>.github.io/pc-rag/`. Chrome sa pri prvom pripojení môže opýtať,
či stránka smie pristupovať k zariadeniam v lokálnej sieti, zvoľte **Povoliť**. Ak sa stránka
v Safari nepripojí, použite Chrome, Edge alebo Firefox. Server na inom porte nastavíte v adrese
stránky: `…/pc-rag/?api=http://localhost:9000`.

Server prijíma požiadavky iba zo stránok `https://*.github.io` a z vlastnej adresy
(premenná `CORS_ORIGINS`).

Pozor na autorské práva: manuály výrobcov do verejného repozitára radšej nedávajte, stačí ich
mať lokálne v `data/pdf/` (do Dockeru sa pripájajú z disku, nie z image).

## PDF dokumenty

PDF patria do priečinka `data/pdf/`. Po pridaní alebo zmazaní PDF kliknite na stránke na
**Načítať zdroje znova**, index sa prepočíta.

Odporúčaná sada (manuály a datasheety komponentov, ktoré sú v ontológii):

| # | Dokument | Odkaz |
|---|---|---|
| 1 | Noctua NH-D15 – návod na montáž | [noctua.at](https://noctua.at/pub/media/blfa_files/manual/noctua_nh_d15_manual_en_web_3.pdf) |
| 2 | Noctua NM-AM5 – montáž na socket AM5 | [noctua.at](https://noctua.at/pub/media/blfa_files/manual/noctua_nm_am5_4_MP78_manual_en_web_1.pdf) |
| 3 | MSI MAG B650M MORTAR – používateľská príručka | [msi.com](https://download-2.msi.com/archive/mnu_exe/mb/MAGB650MMORTAR.pdf) |
| 4 | Corsair SF Platinum (SF750) – manuál zdroja | [corsair.com](https://assets.corsair.com/image/upload/corsairmedia/sys_master/productcontent/SF_PLATINUM_User_Manual.pdf) |
| 5 | be quiet! Pure Power 12 M – manuál zdroja | [mediaexpert.pl](https://www.mediaexpert.pl/products/files/72/7226476/Instrukcja-obslugi-BE-QUIET-Pure-Power-12.pdf) |
| 6 | AMD Ryzen 7000 Desktop – prehľad procesorov | [amd.com](https://www.amd.com/content/dam/amd/en/documents/partner-hub/ryzen/amd-ryzen-7000-series-desktop-processors-quick-reference-guide.pdf) |
| 7 | Kingston FURY Beast DDR5-6000 32 GB – datasheet | [kingston.com](https://www.kingston.com/datasheets/KF560C36BWE2K2-32.pdf) |
| 8 | Samsung SSD 870 EVO – datasheet | [samsung.com](https://download.semiconductor.samsung.com/resources/data-sheet/Samsung_SSD_870_EVO_Data_Sheet_Rev1.1_230509_10129500053000.pdf) |
| 9 | Crucial P3 Plus – produktový list | [crucial.com](https://crucial.com/content/dam/crucial/ssd-products/p3-plus/flyers/b2c/crucial-p3plus-productflyer-consumer.pdf) |
| 10 | Cooler Master NR200P – produktový list skrinky | [igorslab.de](https://www.igorslab.de/wp-content/uploads/2022/02/Product-Sheet-MasterBox-NR200P-Color-Variants.pdf) |

Dá sa použiť ľubovoľné iné PDF s textovou vrstvou. Naskenované PDF (len obrázky) nemajú
text, aplikácia z nich nič nevyčíta.

## Ako to funguje

```
INDEXOVANIE (pri štarte)
  data/pdf/*.pdf  ─┐
                   ├─► textové úryvky ─► bge-m3 ─► vektory (data/.index/)
  ontológia .owx  ─┘

OTÁZKA
  otázka ─► bge-m3 ─► 6 najpodobnejších úryvkov ─► gemma3:4b ─► odpoveď s citáciami [1]…[6]
```

1. **Načítanie zdrojov** (`app/rag.py`, `nacitaj_zdroje`)
   - PDF: text každej strany sa rozdelí na úryvky po ~1000 znakov s prekryvom 200 znakov.
     Každý úryvok si pamätá súbor a číslo strany.
   - Ontológia (`app/ontologia.py`): súbor OWL/XML sa prečíta a každá **trieda, vlastnosť,
     individuum a SWRL pravidlo** sa zmení na jeden odsek textu. WebProtégé dáva entitám
     náhodné IRI, preto sa všade používa ich `rdfs:label`. Príklad úryvku:
     ```
     Pravidlo SWRL Z01 (ontológia PC konfigurátora).
     Ak platí: Zostava(?z) ∧ maProcesor(?z, ?c) ∧ maDosku(?z, ?d) ∧ procesorNepasujeNaDosku(?c, ?d)
     Potom platí: maProblem(?z, Problem_Socket)
     ```
     Z ontológie vznikne 226 úryvkov: 46 tried, 42 objektových a 44 dátových vlastností,
     71 individuí a 23 pravidiel.
2. **Embeddingy**: model `bge-m3` (viacjazyčný, zvláda slovenčinu) zmení každý úryvok na vektor.
   Vektory sa uložia do `data/.index/`, prepočítajú sa len pri zmene zdrojov.
3. **Vyhľadanie**: otázka sa tiež zmení na vektor a vyberie sa 6 úryvkov s najvyššou
   kosínusovou podobnosťou.
4. **Generovanie**: `gemma3:4b` dostane očíslované úryvky a pokyn odpovedať po slovensky iba
   z nich a citovať ich ako `[1]`. Odpoveď sa na stránku posiela priebežne (streaming).
5. **Web** ukáže odpoveď, zoznam použitých úryvkov (PDF so stranou alebo entita ontológie)
   a kliknutím na `[n]` otvorí presný text, z ktorého model vychádzal.

## Štruktúra projektu

```
app/
  main.py          web server (FastAPI): /api/stav, /api/otazka, /api/reindex
  rag.py           načítanie PDF, embeddingy, vyhľadávanie, generovanie odpovede
  ontologia.py     prevod ontológie (.owx) na textové úryvky
  static/          webová stránka (HTML, CSS, JS, písmo Archivo)
data/
  pdf/             sem patria PDF
  ontologia/       ontológia zo Zadania 1
.github/workflows/ nasadenie webu na GitHub Pages a build Docker image
docker-compose.yml
.env.example       nastavenia pre Docker (hotový image, adresa Ollamy)
```

## Nastavenia

Premenné prostredia (nepovinné):

| Premenná | Predvolene | Význam |
|---|---|---|
| `LLM_MODEL` | `gemma3:4b` | model na odpovede; slabší počítač `gemma3:1b`, silnejší `qwen2.5:7b` |
| `EMBED_MODEL` | `bge-m3` | model na embeddingy |
| `OLLAMA_URL` | `http://localhost:11434` | adresa Ollamy |
| `TOP_K` | `6` | počet úryvkov v kontexte |
| `CORS_ORIGINS` | `https://[\w-]+\.github\.io` | z ktorých stránok smie web volať server (regulárny výraz) |

Po zmene `EMBED_MODEL` sa index prepočíta automaticky.

## Riešenie problémov

- **V hlavičke je „Chyba indexu" a „Ollama nebeží"**: spustite Ollamu (na Windows/macOS
  aplikáciu Ollama, na Linuxe `ollama serve`) a kliknite na Načítať zdroje znova.
- **Chyba „model … not found"**: model nie je stiahnutý, spustite `ollama pull <model>`.
- **PDF má v zozname „nečitateľné"**: súbor je poškodený alebo chránený, nahraďte ho.
- **Stránka na github.io hlási „Server neodpovedá"**: server u vás nebeží alebo beží na inom
  porte. Spustite `docker compose up` a skontrolujte, či funguje http://localhost:8000.
- **Odpovede sú pomalé**: použite menší model (`LLM_MODEL=gemma3:1b`) alebo spustenie bez
  Dockeru, kde Ollama použije grafickú kartu.

## Obhajoba

Čo ukázať (asi 5 minút):

1. **Lokálny beh**: hlavička stránky ukazuje modely (U1, U2) a počet úryvkov v indexe. Bez
   internetu to funguje rovnako.
2. **Zdroje**: v ľavom paneli je 10 PDF a ontológia. Pridajte jedno PDF do `data/pdf`, kliknite
   na Načítať zdroje znova a ukážte, že pribudlo.
3. **Otázka na PDF**: „Ako sa montuje chladič Noctua NH-D15 na socket AM5?" Kliknite na `[1]`
   a ukážte stranu manuálu, z ktorej odpoveď vznikla.
4. **Otázka na ontológiu**: „Ktoré pravidlo zistí, že procesor nepasuje na základnú dosku?"
   Odpoveď by mala citovať SWRL pravidlá (R02, Z01) z vašej ontológie.
5. **Otázka mimo zdrojov**: napr. „Kto vyhral MS v hokeji?" Model má odpovedať, že to v
   zdrojoch nie je. Tým ukážete, že odpovedá len z dokumentov.

Časté otázky:

- *Prečo RAG a nie len model?* Model sám nepozná vaše PDF ani ontológiu a vymýšľal by si.
  RAG mu dodá presné úryvky a odpoveď sa dá overiť cez citácie.
- *Ako sa do RAG dostala ontológia?* Každá entita a pravidlo sa prevedie na odsek textu
  (`app/ontologia.py`) a indexuje sa rovnako ako PDF.
- *Prečo bge-m3?* Je viacjazyčný, takže slovenská otázka nájde aj anglický text manuálu.
