
from katalog import get, KAT

MOUNT_SK = {"top": "hore", "front": "vpredu", "side": "na boku", "bottom": "dole"}
FF_NAME = {"ATX": "ATX", "MicroATX": "Micro-ATX", "MiniITX": "Mini-ITX"}


def radiator_mount(k, size, layout):
    rad = layout[k["id"]]["rad"]
    for loc in ("top", "front", "side", "bottom"):
        if loc in rad and size in _sizes_for(k, loc):
            return loc
    return None


def _sizes_for(k, loc):
    return k.get("radiatory", {}).get(loc, [])


def short(x):
    for p in ("NVIDIA GeForce ", "AMD ", "Intel ", "Sapphire PULSE Radeon "):
        if x["nazov"].startswith(p):
            return x["nazov"][len(p):]
    return x["nazov"]


def checks(b):
    cat = get()
    C, L = cat["komponenty"], cat["layout"]
    g = lambda key: C.get(b.get(key)) if b.get(key) else None
    k, c, d, r, gpu, z, ch = g("skrinka"), g("procesor"), g("doska"), g("pamat"), g("grafika"), g("zdroj"), g("chladic")
    u = [C[i] for i in b.get("ulozisko", []) if i in C]
    out = []

    def add(ok, rule, text, cats):
        out.append({"ok": bool(ok), "rule": rule, "text": text, "cats": cats})

    if c and d:
        ok = c["socket"] == d["socket"]
        add(ok, "R01" if ok else "R02", f"Socket {c['socket']} sedí s doskou" if ok else f"Procesor má socket {c['socket']}, doska {d['socket']}", ["procesor", "doska"])
    if r and d:
        ok = r["typ"] in d["ram"]
        add(ok, "R03" if ok else "R14", f"{r['typ']} je podporovaná doskou" if ok else f"RAM je {r['typ']}, doska berie len {'/'.join(d['ram'])}", ["pamat", "doska"])
    if d and k:
        ok = d["ff"] in k["ffDosky"]
        add(ok, "R04", f"Doska {FF_NAME[d['ff']]} sa zmestí do skrinky" if ok else f"Skrinka neberie dosku {FF_NAME[d['ff']]}", ["doska", "skrinka"])
    if gpu and k:
        ok = gpu["dlzka"] <= k["maxGpu"]
        add(ok, "R05" if ok else "R06", f"Grafika {gpu['dlzka']} mm ≤ {k['maxGpu']} mm" if ok else f"Grafika {gpu['dlzka']} mm je dlhšia než {k['maxGpu']} mm", ["grafika", "skrinka"])
    if ch and k and ch.get("vyska"):
        ok = ch["vyska"] <= k["maxChladic"]
        add(ok, "R07" if ok else "R08", f"Chladič {ch['vyska']} mm ≤ {k['maxChladic']} mm" if ok else f"Chladič {ch['vyska']} mm je vyšší než {k['maxChladic']} mm", ["chladic", "skrinka"])
    if ch and k and ch.get("druh") == "aio":
        loc = radiator_mount(k, ch["radiator"], L)
        add(loc, "R15" if loc else "R16", f"Radiátor {ch['radiator']} mm sa zmestí ({MOUNT_SK[loc]})" if loc else f"Skrinka nemá miesto pre radiátor {ch['radiator']} mm", ["chladic", "skrinka"])
        if gpu and loc and L[k["id"]]["rad"][loc][2] == "v":
            lim = min(k["maxGpu"], L[k["id"]]["rad"][loc][0] - L[k["id"]]["bracketX"])
            ok = gpu["dlzka"] <= lim
            add(ok, "X02", f"Grafika sa zmestí aj s radiátorom {MOUNT_SK[loc]}" if ok else f"S radiátorom {MOUNT_SK[loc]} ostáva pre grafiku len {lim} mm", ["grafika", "chladic"])
    if ch and c:
        ok = c["socket"] in ch["sockets"]
        add(ok, "R09", f"Chladič má montáž pre {c['socket']}" if ok else f"Chladič nemá montáž pre {c['socket']}", ["chladic", "procesor"])
    if ch and c and ch.get("maxTdp"):
        ok = c["tdp"] <= ch["maxTdp"]
        add(ok, "R10", f"TDP {c['tdp']} W v limite chladiča" if ok else f"TDP procesora {c['tdp']} W je nad limitom chladiča {ch['maxTdp']} W", ["chladic", "procesor"])
    if z and k:
        ok = z["ff"] in k["ffZdroja"]
        add(ok, "R11", f"Zdroj {z['ff']} sa zmestí do skrinky" if ok else f"Skrinka neberie {z['ff']} zdroj", ["zdroj", "skrinka"])
    if z and gpu:
        ok = z["w"] >= gpu["odpZdroj"]
        add(ok, "R12" if ok else "R13", f"Zdroj {z['w']} W ≥ odporúčaných {gpu['odpZdroj']} W" if ok else f"Zdroj {z['w']} W je pod odporúčaním {gpu['odpZdroj']} W pre {short(gpu)}", ["zdroj", "grafika"])
    if d and u:
        n = sum(1 for x in u if x["typ"] == "NVMe")
        if n:
            add(n <= d["m2"], "X01", f"{n}× NVMe, doska má {d['m2']} M.2" if n <= d["m2"] else f"{n}× NVMe, ale doska má len {d['m2']} M.2", ["ulozisko", "doska"])
    return out


def missing(b):
    C = get()["komponenty"]
    m = []
    c = C.get(b.get("procesor") or "")
    for kat in KAT:
        kid = kat["id"]
        if kid == "grafika":
            if not b.get("grafika") and not (c and c["igpu"]):
                m.append("grafika")
            continue
        if kat.get("multi"):
            if not b.get("ulozisko"):
                m.append(kid)
            continue
        if not b.get(kid):
            m.append(kid)
    return m


def validate_ids(b):
    C = get()["komponenty"]
    errs = []
    for kat in KAT:
        v = b.get(kat["id"])
        for i in (v if isinstance(v, list) else [v]):
            if i and (i not in C or C[i]["kat"] != kat["id"]):
                errs.append(f"Neznámy komponent {i} v kategórii {kat['nazov']}")
    return errs


def price(b):
    C = get()["komponenty"]
    s = 0.0
    for kat in KAT:
        v = b.get(kat["id"])
        for i in (v if isinstance(v, list) else [v]):
            if i:
                s += C[i]["cena"]
    return round(s, 2)


def power(b):
    C = get()["komponenty"]
    c = C.get(b.get("procesor") or "")
    g = C.get(b.get("grafika") or "")
    return (c["tdp"] if c else 0) + (g["prikon"] if g else 0) + 75
