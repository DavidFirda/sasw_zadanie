"""Katalóg konfigurátora zostavený SPARQL dopytmi nad ontológiou zo Zadania 1.

Ontológia obsahuje všetko, čo súvisí s kompatibilitou (parametre, ceny,
hotové zostavy). Súbor vizual.json dopĺňa iba vzhľad pre 3D model (farebný štýl,
rozmiestnenie dielov v skrinke), ktorý do ontológie nepatrí.
"""
import json
from collections import defaultdict

from sparql import DATA, store, local

VIZUAL_PATH = DATA / "vizual.json"

KAT = [
    {"id": "skrinka", "nazov": "Skrinka", "trieda": "Skrinka"},
    {"id": "procesor", "nazov": "Procesor", "trieda": "Procesor"},
    {"id": "doska", "nazov": "Základná doska", "trieda": "ZakladnaDoska"},
    {"id": "pamat", "nazov": "Pamäť RAM", "trieda": "OperacnaPamat"},
    {"id": "grafika", "nazov": "Grafická karta", "trieda": "GrafickaKarta"},
    {"id": "ulozisko", "nazov": "Úložisko", "trieda": "Ulozisko", "multi": True},
    {"id": "zdroj", "nazov": "Zdroj", "trieda": "Zdroj"},
    {"id": "chladic", "nazov": "Chladič CPU", "trieda": "Chladic"},
]
TRIEDA_KAT = {"Skrinka": "skrinka", "Procesor": "procesor", "ZakladnaDoska": "doska", "OperacnaPamat": "pamat",
              "GrafickaKarta": "grafika", "SSD_NVMe": "ulozisko", "SSD_SATA": "ulozisko", "HDD": "ulozisko",
              "Zdroj": "zdroj", "VzduchovyChladic": "chladic", "VodnyChladicAIO": "chladic"}
FF_ZDROJA = {"ZdrojATX": "ATX", "SFX": "SFX", "SFX_L": "SFX-L"}
TIERS = {"dostupna": "Cenovo dostupné", "stredna": "Stredná trieda", "highend": "High-end"}

PRAVIDLA = {
    "R01": ("Procesor pasuje na dosku (socket)", "Procesor a doska musia mať rovnaký socket."),
    "R02": ("Procesor nepasuje na dosku", "Ak sa sockety líšia, procesor sa do dosky fyzicky nedá vložiť."),
    "R03": ("Pamäť pasuje do dosky", "RAM musí mať typ (DDR4/DDR5), ktorý doska podporuje."),
    "R04": ("Doska sa zmestí do skrinky", "Form faktor dosky musí byť medzi tými, ktoré skrinka podporuje."),
    "R05": ("Grafika sa zmestí do skrinky", "Dĺžka karty musí byť najviac taká, ako povoľuje skrinka."),
    "R06": ("Grafika sa nezmestí", "Karta je dlhšia než limit skrinky."),
    "R07": ("Chladič sa zmestí do skrinky", "Výška vzduchového chladiča musí byť v limite skrinky."),
    "R08": ("Chladič sa nezmestí", "Chladič je vyšší, než dovoľuje skrinka, bočnica by nešla zavrieť."),
    "R09": ("Chladič pasuje na procesor", "Chladič musí mať montáž pre socket procesora."),
    "R10": ("Chladič nestačí na TDP", "Procesor má vyššie TDP, než na aké je chladič určený."),
    "R11": ("Zdroj sa zmestí do skrinky", "Form faktor zdroja (ATX/SFX) musí skrinka podporovať."),
    "R12": ("Zdroj stačí pre grafiku", "Výkon zdroja musí dosiahnuť výrobcom odporúčaný výkon pre celý systém."),
    "R13": ("Zdroj nestačí pre grafiku", "Zdroj je slabší, než odporúča výrobca karty."),
    "R14": ("Pamäť nepasuje do dosky", "DDR4 a DDR5 majú iný zárez, modul sa do slotu nedá vložiť."),
    "R15": ("Radiátor sa zmestí do skrinky", "Veľkosť radiátora vodného chladiča musí skrinka podporovať."),
    "R16": ("Radiátor sa nezmestí", "Radiátor je väčší než najväčší, ktorý skrinka podporuje."),
    "X01": ("Počet M.2 slotov", "NVMe diskov nesmie byť viac než M.2 slotov na doske."),
    "X02": ("Grafika a predný radiátor", "Radiátor s ventilátormi vpredu skráti miesto pre grafickú kartu."),
}

_cache = None


def _rules_from_ontology():
    """SWRL pravidlá z ontológie (R01 → text pravidla) pre zobrazenie v konfigurátore."""
    return store.pravidla


def load():
    global _cache
    viz = json.load(open(VIZUAL_PATH, encoding="utf-8"))

    # 1) typy komponentov
    rows = store.select("""SELECT ?i ?t WHERE { ?i a ?t . FILTER(?t IN (:Skrinka, :Procesor, :ZakladnaDoska, :OperacnaPamat,
        :GrafickaKarta, :SSD_NVMe, :SSD_SATA, :HDD, :Zdroj, :VzduchovyChladic, :VodnyChladicAIO)) }""")
    typ = {local(r["i"]): local(r["t"]) for r in rows}

    # 2) všetky vlastnosti komponentov
    rows = store.select("""SELECT ?i ?p ?o WHERE { ?i a ?t . FILTER(?t IN (:Skrinka, :Procesor, :ZakladnaDoska, :OperacnaPamat,
        :GrafickaKarta, :SSD_NVMe, :SSD_SATA, :HDD, :Zdroj, :VzduchovyChladic, :VodnyChladicAIO)) ?i ?p ?o . }""")
    props = defaultdict(lambda: defaultdict(list))
    for r in rows:
        props[local(r["i"])][local(r["p"])].append(r["o"])

    # 3) popisky (výrobcovia a pod.)
    labels = {}
    for r in store.select("SELECT ?x ?l WHERE { ?x rdfs:label ?l . FILTER(lang(?l) = 'sk' || lang(?l) = '') }"):
        labels[local(r["x"])] = r["l"].replace("_", " ")

    def one(p, k, default=None):
        v = p.get(k)
        return v[0] if v else default

    def loc(v):
        return local(v) if isinstance(v, str) else v

    C = {}
    for cid, t in typ.items():
        p = props[cid]
        kat = TRIEDA_KAT[t]
        x = {"id": cid, "kat": kat, "nazov": one(p, "nazov", labels.get(cid, cid)),
             "vyrobca": labels.get(loc(one(p, "vyrobil", "")), loc(one(p, "vyrobil", ""))),
             "cena": float(one(p, "cenaEur", 0))}
        if p.get("source"):
            x["src"] = sorted(p["source"])
        if p.get("comment"):
            x["pozn"] = p["comment"][0]
        if p.get("farba"):
            x["farba"] = one(p, "farba")
        if kat == "skrinka":
            x.update(ffDosky=sorted({loc(v) for v in p["podporujeFormFaktorDosky"]}, key=["ATX", "MicroATX", "MiniITX"].index),
                     ffZdroja=sorted({FF_ZDROJA[loc(v)] for v in p["podporujeFormFaktorZdroja"]}),
                     maxGpu=int(one(p, "maxDlzkaGPUmm")), maxChladic=int(one(p, "maxVyskaChladicaMm")),
                     rozmer=[int(one(p, "hlbkaMm")), int(one(p, "vyskaMm"))], sirka=int(one(p, "sirkaMm")),
                     radiatorySizes=sorted(int(v) for v in p["podporujeRadiatorMm"]),
                     maxRadiator=int(one(p, "maxRadiatorMm")))
        elif kat == "procesor":
            x.update(socket=loc(one(p, "maSocket")), ram=sorted(loc(v) for v in p["podporujeTypPamate"]),
                     jadra=int(one(p, "pocetJadier")), vlakna=int(one(p, "pocetVlakien")),
                     ghz=[float(one(p, "zakladnaFrekvenciaGHz")), float(one(p, "boostFrekvenciaGHz"))],
                     tdp=int(one(p, "tdpW")), l3=int(one(p, "l3CacheMB")),
                     igpu=str(one(p, "maIntegrovanuGrafiku")).lower() in ("true", "1"))
            if p.get("maxTurboPrikonW"):
                x["turbo"] = int(one(p, "maxTurboPrikonW"))
        elif kat == "doska":
            x.update(socket=loc(one(p, "podporujeSocket")), cipset=loc(one(p, "maCipset")), ff=loc(one(p, "maFormFaktorDosky")),
                     ram=sorted(loc(v) for v in p["podporujeTypPamate"]), ramSloty=int(one(p, "pocetRAMSlotov")),
                     maxRam=int(one(p, "maxRAMGB")), m2=int(one(p, "pocetM2Slotov")))
        elif kat == "pamat":
            x.update(typ=loc(one(p, "maTypPamate")), kap=int(one(p, "kapacitaGB")), mts=int(one(p, "frekvenciaMTs")),
                     moduly=int(one(p, "pocetModulov")), rgb=str(one(p, "maRGB")).lower() in ("true", "1"))
        elif kat == "grafika":
            x.update(vram=int(one(p, "vramGB")), vramTyp=one(p, "typVRAM"), prikon=int(one(p, "prikonGrafikyW")),
                     odpZdroj=int(one(p, "odporucanyZdrojW")), dlzka=int(one(p, "dlzkaMm")), vyska=int(one(p, "vyskaKartyMm")),
                     sloty=float(one(p, "sirkaSlotov")), fans=int(one(p, "pocetVentilatorov")))
        elif kat == "ulozisko":
            x.update(typ={"SSD_NVMe": "NVMe", "SSD_SATA": "SATA", "HDD": "HDD"}[t], kap=int(one(p, "kapacitaGB")))
        elif kat == "zdroj":
            x.update(ff=FF_ZDROJA[loc(one(p, "maFormFaktorZdroja"))], w=int(one(p, "vykonW")), cert=one(p, "certifikacia80Plus"))
        elif kat == "chladic":
            x.update(sockets=sorted(loc(v) for v in p["podporujeSocket"]),
                     maxTdp=int(one(p, "maxTDPChladicaW")) if p.get("maxTDPChladicaW") else None)
            if t == "VodnyChladicAIO":
                x.update(druh="aio", radiator=int(one(p, "velkostRadiatoraMm")))
            else:
                x["vyska"] = int(one(p, "vyskaChladicaMm"))
                x["druh"] = "nizky" if x["vyska"] < 80 else "vezovy"
        # vzhľad pre 3D (nie je v ontológii)
        for k, v in viz["komponenty"].get(cid, {}).items():
            x.setdefault(k, v)
        C[cid] = x

    order = [k["id"] for k in KAT]
    C = dict(sorted(C.items(), key=lambda kv: (order.index(kv[1]["kat"]), kv[1]["cena"])))

    # 4) pripravené zostavy (bez testovacích)
    rows = store.select("""SELECT ?z ?l ?kat ?ucel ?p ?o WHERE {
        ?z a :Zostava ; :cenovaKategoria ?kat ; :ucelPopis ?ucel .
        ?z rdfs:label ?lab . OPTIONAL { ?z :nazov ?n } BIND(COALESCE(?n, ?lab) AS ?l)
        FILTER NOT EXISTS { ?z a :TestovaciaZostava }
        ?z ?p ?o . FILTER(?p IN (:maProcesor, :maDosku, :maPamat, :maGrafiku, :maUlozisko, :maZdroj, :maSkrinku, :maChladic)) }""")
    pmap = {"maProcesor": "procesor", "maDosku": "doska", "maPamat": "pamat", "maGrafiku": "grafika",
            "maUlozisko": "ulozisko", "maZdroj": "zdroj", "maSkrinku": "skrinka", "maChladic": "chladic"}
    Z = {}
    for r in rows:
        zid = local(r["z"])
        z = Z.setdefault(zid, {"id": zid, "nazov": r["l"].replace("_", " "), "tier": r["kat"], "ucel": r["ucel"],
                               "b": {"grafika": None, "ulozisko": []}})
        k = pmap[local(r["p"])]
        if k == "ulozisko":
            if local(r["o"]) not in z["b"]["ulozisko"]:
                z["b"]["ulozisko"].append(local(r["o"]))
        else:
            z["b"][k] = local(r["o"])
    for z in Z.values():
        z["b"]["ulozisko"].sort(key=lambda u: ["NVMe", "SATA", "HDD"].index(C[u]["typ"]))
    tier_order = list(TIERS)
    presets = sorted(Z.values(), key=lambda z: (tier_order.index(z["tier"]), sum_price(C, z["b"])))

    swrl = _rules_from_ontology()
    rules = {k: {"nazov": v[0], "vysv": v[1], "swrl": swrl.get(k, "rozšírenie webu (uzavretý svet)" if k.startswith("X") else "v ontológii nie je zapísané ako SWRL pravidlo")} for k, v in PRAVIDLA.items()}

    _cache = {"kategorie": KAT, "komponenty": C, "zostavy": presets, "pravidla": rules, "tiers": TIERS,
              "varovania": _varovania(),
              "layout": viz["layout"], "board": viz["board"],
              "zdroj": {"backend": store.backend, "trojic": store.select("SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }")[0]["n"]}}
    return _cache


def _varovania():
    """Údaje, ktoré majú mať jednu hodnotu, ale v ontológii ich je viac (typicky po uložení
    odvodených tvrdení reasonera, keď sa individuá zlúčili cez owl:sameAs)."""
    pary = {tuple(sorted((local(r["a"]), local(r["b"])))) for r in store.select("SELECT ?a ?b WHERE { ?a owl:sameAs ?b }")}
    out = [f"V ontológii je {a} = {b} (owl:sameAs)." for a, b in sorted(pary) if a != b]
    for r in store.select("""SELECT ?i ?p (COUNT(DISTINCT ?o) AS ?n) WHERE {
            ?i ?p ?o . FILTER(?p IN (:maFormFaktorDosky, :maFormFaktorZdroja, :maSocket, :maTypPamate)) }
            GROUP BY ?i ?p HAVING (COUNT(DISTINCT ?o) > 1)"""):
        out.append(f"{local(r['i'])} má {r['n']} hodnoty vlastnosti {local(r['p'])}, má mať jednu.")
    return out


def sum_price(C, b):
    s = 0
    for k, v in b.items():
        for i in (v if isinstance(v, list) else [v]):
            if i:
                s += C[i]["cena"]
    return s


def get():
    return _cache or load()
