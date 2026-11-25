"""Jadro RAG: načítanie zdrojov, embeddingy, vyhľadávanie a generovanie odpovede.

Zdroje: PDF dokumenty (data/pdf), ontológia zo Zadania 1 (data/ontologia/*.owl)
a katalóg konfigurátora (komponenty, pravidlá, hotové zostavy).
Všetko beží lokálne cez Ollamu:
  - EMBED_MODEL vytvára vektory úryvkov aj otázky,
  - LLM_MODEL píše odpoveď len z nájdených úryvkov.
"""
import hashlib
import json
import os
import re
from pathlib import Path

import httpx
import numpy as np
from pypdf import PdfReader

from katalog_text import uryvky_katalogu
from ontologia import Ontologia

OLLAMA = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "gemma3:4b")
EMBED_MODEL = os.getenv("EMBED_MODEL", "bge-m3")
DATA = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
TOP_K = int(os.getenv("TOP_K", "6"))
PDF_K = int(os.getenv("PDF_K", "2"))   # koľko z TOP_K úryvkov má byť vždy z PDF (ak nejaké sú)
CHUNK, OVERLAP = 1000, 200          # znaky na úryvok z PDF, prekryv

SYSTEM = """Si poradca PC konfigurátora. Odpovedáš po slovensky.
Používaj iba informácie z priloženého kontextu (úryvky z PDF dokumentov, z ontológie a z katalógu konfigurátora
a prípadne popis zostavy, ktorú má používateľ otvorenú v konfigurátore).
Nie všetky úryvky musia súvisieť s otázkou, použi len tie, ktoré sa jej týkajú.
Ak je priložená ZOSTAVA POUŽÍVATEĽA, otázka sa týka práve nej: diely, parametre a výsledky kontrol ber
z nej. Hotové zostavy z úryvkov sú iné zostavy, nezamieňaj ich s ňou.
Ak v kontexte odpoveď nie je, povedz to priamo a nič si nevymýšľaj.
Za každé tvrdenie daj odkaz na úryvok v hranatých zátvorkách, napríklad [2].
Odpovedaj stručne a vecne."""


# ---------------- načítanie zdrojov ----------------
def rozdel(text):
    """Rozdelí text stránky na úryvky s prekryvom, delí sa na hraniciach slov."""
    text = re.sub(r"\s+", " ", text).strip()
    out, start = [], 0
    while start < len(text):
        end = min(start + CHUNK, len(text))
        if end < len(text):
            space = text.rfind(" ", start + CHUNK // 2, end)
            end = space if space > 0 else end
        out.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - OVERLAP, start + 1)
    return [u for u in out if len(u) > 40]


def nacitaj_zdroje():
    uryvky, zdroje = [], []
    for pdf in sorted((DATA / "pdf").glob("*.pdf")):
        try:
            strany = PdfReader(pdf).pages
        except Exception as e:  # poškodené PDF preskočíme, ale ukážeme ho
            zdroje.append({"nazov": pdf.name, "druh": "pdf", "uryvky": 0, "chyba": str(e)})
            continue
        pocet = 0
        for i, strana in enumerate(strany, 1):
            for text in rozdel(strana.extract_text() or ""):
                uryvky.append({"druh": "pdf", "zdroj": pdf.name, "miesto": f"str. {i}", "text": text})
                pocet += 1
        zdroje.append({"nazov": pdf.name, "druh": "pdf", "strany": len(strany), "uryvky": pocet})

    for owl in sorted((DATA / "ontologia").glob("*.owl")):
        cast = Ontologia(owl).uryvky()
        for u in cast:
            je_zostava = u["typ"] == "Individuum" and bool(re.search(r"^Typ:.*\b(Zostava|TestovaciaZostava)\b", u["text"], re.M))
            uryvky.append({"druh": "ontologia", "zdroj": owl.name, "miesto": f"{u['typ']} {u['nazov']}", "text": u["text"], "zostava": je_zostava})
        zdroje.append({"nazov": owl.name, "druh": "ontologia", "uryvky": len(cast)})

    katalog = uryvky_katalogu()
    for u in katalog:
        uryvky.append({"druh": "katalog", "zdroj": "Katalóg konfigurátora", "miesto": u["nazov"], "text": u["text"],
                       "zostava": u["text"].startswith("Hotová zostava")})
    zdroje.append({"nazov": "Katalóg konfigurátora", "druh": "katalog", "uryvky": len(katalog)})
    return uryvky, zdroje


# ---------------- Ollama ----------------
def embed(texty):
    vektory = []
    with httpx.Client(timeout=600) as c:
        for i in range(0, len(texty), 32):
            r = c.post(f"{OLLAMA}/api/embed", json={"model": EMBED_MODEL, "input": texty[i:i + 32]})
            r.raise_for_status()
            vektory += r.json()["embeddings"]
    v = np.array(vektory, dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def zabezpec_modely(stav):
    """Ak model v Ollame chýba, stiahne ho (prvé spustenie)."""
    with httpx.Client(timeout=None) as c:
        mame = {m["name"] for m in c.get(f"{OLLAMA}/api/tags").json().get("models", [])}
        for m in (EMBED_MODEL, LLM_MODEL):
            if m not in mame and f"{m}:latest" not in mame:
                stav(f"Sťahujem model {m} (len pri prvom spustení)")
                c.post(f"{OLLAMA}/api/pull", json={"model": m, "stream": False}).raise_for_status()


# ---------------- index ----------------
class Index:
    def __init__(self):
        self.uryvky, self.zdroje, self.vektory = [], [], None

    def postav(self, stav=lambda s: None):
        stav("Kontrolujem modely v Ollame")
        zabezpec_modely(stav)
        stav("Čítam PDF a ontológiu")
        uryvky, zdroje = nacitaj_zdroje()

        # vektory sa ukladajú do data/.index, aby sa pri ďalšom štarte nepočítali znova
        podpis = hashlib.sha1(json.dumps([EMBED_MODEL, [u["text"] for u in uryvky]]).encode()).hexdigest()
        cache = DATA / ".index"
        subor = cache / f"{podpis}.npy"
        if subor.exists():
            vektory = np.load(subor)
        else:
            stav(f"Počítam embeddingy pre {len(uryvky)} úryvkov")
            vektory = embed([u["text"] for u in uryvky]) if uryvky else np.zeros((0, 1), np.float32)
            cache.mkdir(exist_ok=True)
            for stary in cache.glob("*.npy"):
                stary.unlink()
            np.save(subor, vektory)
        self.uryvky, self.zdroje, self.vektory = uryvky, zdroje, vektory

    def hladaj(self, otazka, k=TOP_K, bez_zostav=False):
        """k najpodobnejších úryvkov. Ak sú v indexe PDF, PDF_K z nich je vždy z PDF
        (tie najpodobnejšie), aby sa manuály dostali do kontextu aj vtedy, keď
        podobnosťou vyhrávajú krátke úryvky z ontológie. Model sám posúdi, či sa hodia.
        bez_zostav: pri otázke na zostavu používateľa vynechá úryvky o iných zostavách."""
        if not self.uryvky:
            return []
        skore = self.vektory @ embed([otazka])[0]
        poradie = [int(i) for i in np.argsort(-skore) if not (bez_zostav and self.uryvky[i].get("zostava"))]
        pdf = [i for i in poradie if self.uryvky[i]["druh"] == "pdf"][:PDF_K]
        ostatne = [i for i in poradie if i not in pdf][:k - len(pdf)]
        vyber = sorted(pdf + ostatne, key=lambda i: -skore[i])
        return [dict(self.uryvky[i], skore=round(float(skore[i]), 3)) for i in vyber]


DRUH = {"pdf": "PDF", "ontologia": "Ontológia", "katalog": "Katalóg"}


def odpoved(otazka, najdene, zostava=""):
    """Generátor kúskov textu odpovede (stream z Ollamy)."""
    kontext = "\n\n".join(
        f"[{i}] ({DRUH[u['druh']]}: {u['zdroj']}, {u['miesto']})\n{u['text']}"
        for i, u in enumerate(najdene, 1))
    uvod = f"{zostava}\n\n" if zostava else ""   # zostava používateľa ide na začiatok, aby mala prednosť
    spravy = [{"role": "system", "content": SYSTEM},
              {"role": "user", "content": f"{uvod}Úryvky zo zdrojov:\n{kontext}\n\nOtázka: {otazka}"}]
    with httpx.stream("POST", f"{OLLAMA}/api/chat", timeout=600,
                      json={"model": LLM_MODEL, "messages": spravy, "stream": True,
                            "options": {"temperature": 0.2}}) as r:
        r.raise_for_status()
        for riadok in r.iter_lines():
            if riadok:
                cast = json.loads(riadok)
                if cast.get("message", {}).get("content"):
                    yield cast["message"]["content"]
