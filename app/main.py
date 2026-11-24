"""Webový server: API pre otázky a statická stránka s chatom."""
import json
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import rag

index = rag.Index()
NEBEZI = f"Ollama nebeží na {rag.OLLAMA}. Spustite ju a kliknite na Načítať zdroje znova."
stav = {"stav": "indexujem", "sprava": "Spúšťam"}


def indexuj():
    stav.update(stav="indexujem", sprava="Spúšťam")
    try:
        index.postav(lambda s: stav.update(sprava=s))
        stav.update(stav="pripravene", sprava="")
    except httpx.ConnectError:
        stav.update(stav="chyba", sprava=NEBEZI)
    except Exception as e:
        stav.update(stav="chyba", sprava=f"{type(e).__name__}: {e}")


@asynccontextmanager
async def lifespan(_):
    threading.Thread(target=indexuj, daemon=True).start()   # index sa stavia na pozadí
    yield


app = FastAPI(title="RAG – PC konfigurátor", lifespan=lifespan)

# Stránka z GitHub Pages (https://<ucet>.github.io) volá tento server na localhoste.
# allow_private_network: Chrome to vyžaduje, keď verejná stránka volá localhost.
app.add_middleware(CORSMiddleware, allow_origin_regex=os.getenv("CORS_ORIGINS", r"https://[\w-]+\.github\.io"),
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"], allow_private_network=True)


@app.get("/api/stav")
def get_stav():
    return {**stav, "llm": rag.LLM_MODEL, "embed": rag.EMBED_MODEL,
            "zdroje": index.zdroje, "uryvky": len(index.uryvky)}


@app.post("/api/reindex")
def reindex():
    if stav["stav"] != "indexujem":
        threading.Thread(target=indexuj, daemon=True).start()
    return get_stav()


class Otazka(BaseModel):
    otazka: str


@app.post("/api/otazka")
def otazka(o: Otazka):
    """Odpoveď ide ako NDJSON: najprv nájdené zdroje, potom kúsky textu."""
    def prud():
        try:
            if stav["stav"] != "pripravene":
                raise RuntimeError("Index ešte nie je pripravený.")
            najdene = index.hladaj(o.otazka)
            yield json.dumps({"typ": "zdroje", "zdroje": najdene}, ensure_ascii=False) + "\n"
            for kus in rag.odpoved(o.otazka, najdene):
                yield json.dumps({"typ": "text", "text": kus}, ensure_ascii=False) + "\n"
        except httpx.ConnectError:
            yield json.dumps({"typ": "chyba", "sprava": NEBEZI}, ensure_ascii=False) + "\n"
        except Exception as e:
            yield json.dumps({"typ": "chyba", "sprava": f"{type(e).__name__}: {e}"}, ensure_ascii=False) + "\n"
    return StreamingResponse(prud(), media_type="application/x-ndjson")


app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")
