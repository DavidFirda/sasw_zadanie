"""Text z katalógu konfigurátora pre RAG: komponenty, pravidlá, hotové zostavy
a popis zostavy, ktorú má používateľ práve otvorenú v konfigurátore."""
from katalog import get, KAT, TIERS
from kontrola import checks, missing, price, power, FF_NAME

KATMAP = {k["id"]: k for k in KAT}


def spec(x):
    k = x["kat"]
    if k == "skrinka":
        return f"{x['rozmer'][0]}×{x['sirka']}×{x['rozmer'][1]} mm, {x.get('farba','')}, grafika do {x['maxGpu']} mm, chladič do {x['maxChladic']} mm, radiátory {'/'.join(map(str, x['radiatorySizes']))} mm, dosky {', '.join(FF_NAME[f] for f in x['ffDosky'])}, zdroj {'/'.join(x['ffZdroja'])}"
    if k == "procesor":
        return f"socket {x['socket']}, {x['jadra']} jadier/{x['vlakna']} vlákien, {x['ghz'][0]}–{x['ghz'][1]} GHz, TDP {x['tdp']} W, pamäť {'/'.join(x['ram'])}, {'s integrovanou grafikou' if x['igpu'] else 'bez integrovanej grafiky'}"
    if k == "doska":
        return f"socket {x['socket']}, čipset {x['cipset']}, {FF_NAME[x['ff']]}, {'/'.join(x['ram'])}, {x['ramSloty']} sloty RAM do {x['maxRam']} GB, {x['m2']}× M.2"
    if k == "pamat":
        return f"{x['typ']}-{x['mts']}, {x['kap']} GB v {x['moduly']} moduloch{', RGB' if x['rgb'] else ''}"
    if k == "grafika":
        return f"{x['vram']} GB {x['vramTyp']}, príkon {x['prikon']} W, odporúčaný zdroj {x['odpZdroj']} W, dĺžka {x['dlzka']} mm, výška {x['vyska']} mm, {x['sloty']} slotu"
    if k == "ulozisko":
        return f"{x['typ']}, {x['kap']} GB"
    if k == "zdroj":
        return f"{x['w']} W, {x['ff']}, 80 PLUS {x['cert']}"
    if k == "chladic":
        return (f"vodný AIO, radiátor {x['radiator']} mm" if x["druh"] == "aio" else f"vzduchový, výška {x['vyska']} mm") + f", sockety {', '.join(x['sockets'])}" + (f", do {x['maxTdp']} W" if x.get("maxTdp") else "")
    return ""


def uryvky_katalogu():
    cat = get()
    out = []
    add = lambda nazov, text: out.append({"nazov": nazov, "text": text})
    add("Výkon zdroja", "Odporúčaný zdroj od výrobcu grafiky platí pre celý systém. Odhad spotreby: TDP procesora + príkon grafiky + 75 W na ostatné diely.")
    for x in cat["komponenty"].values():
        add(x["nazov"], f"{KATMAP[x['kat']]['nazov']} {x['nazov']} (ID {x['id']}), výrobca {x['vyrobca']}: {spec(x)}. "
            f"Orientačná cena {x['cena']:.0f} €.{(' ' + x['pozn']) if x.get('pozn') else ''}")
    for rid, r in cat["pravidla"].items():
        add(f"{rid} {r['nazov']}", f"Pravidlo kompatibility {rid}: {r['nazov']}. {r['vysv']} Zápis v ontológii: {r['swrl']}")
    for z in cat["zostavy"]:
        diely = []
        for k in KAT:
            v = z["b"].get(k["id"])
            ids = v if isinstance(v, list) else [v]
            diely.append(k["nazov"] + ": " + (" + ".join(cat["komponenty"][i]["nazov"] for i in ids if i) or "bez grafickej karty"))
        add(z["nazov"], f"Hotová zostava {z['nazov']}, kategória {TIERS[z['tier']]}, určená na {z['ucel']}. {'; '.join(diely)}. "
            f"Cena {price(z['b']):.0f} €, odhad spotreby {power(z['b'])} W.")
    return out


def popis_zostavy(b):
    """Krátky popis aktuálnej zostavy z konfigurátora aj s výsledkami kontrol."""
    C = get()["komponenty"]
    riadky = []
    for k in KAT:
        v = b.get(k["id"])
        ids = v if isinstance(v, list) else [v]
        prazdne = "bez grafickej karty (integrovaná grafika procesora)" if k["id"] == "grafika" else "nevybraté"
        riadky.append(f"- {k['nazov']}: {', '.join(C[i]['nazov'] for i in ids if i in C) or prazdne}")
    kontroly = "; ".join(("OK " if c["ok"] else "CHYBA ") + c["rule"] + " " + c["text"] for c in checks(b))
    chyba = missing(b)
    return ("Zostava, ktorú má používateľ otvorenú v konfigurátore:\n" + "\n".join(riadky)
            + f"\nCena {price(b):.0f} €, odhad spotreby {power(b)} W.\nKontroly: {kontroly}"
            + (f"\nChýba: {', '.join(chyba)}" if chyba else ""))
