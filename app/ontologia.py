"""Prevod ontológie (OWL/XML, .owx z WebProtégé/Protégé) na textové úryvky pre RAG.

Každá trieda, vlastnosť, individuum a SWRL pravidlo sa zmení na jeden krátky
odsek v slovenčine. WebProtégé dáva entitám náhodné IRI, preto sa všade
používa ich rdfs:label.
"""
import xml.etree.ElementTree as ET
from collections import defaultdict

OWL = "{http://www.w3.org/2002/07/owl#}"
FACET = {"minInclusive": ">=", "maxInclusive": "<=", "minExclusive": ">", "maxExclusive": "<"}


def _tag(el):
    return el.tag.replace(OWL, "")


def _iri(el):
    return el.get("IRI") or el.get("abbreviatedIRI") or ""


def _short(iri):
    return iri.replace("#", "/").replace(":", "/").rsplit("/", 1)[-1]


class Ontologia:
    def __init__(self, path):
        self.root = ET.parse(path).getroot()
        self.labels, self.comments = {}, defaultdict(list)
        self.kind = {}
        for el in self.root:
            t = _tag(el)
            if t == "Declaration":
                ent = el[0]
                self.kind[_iri(ent)] = _tag(ent)
            elif t == "AnnotationAssertion":
                prop = _iri(el[0])
                subj = el[1].text if _tag(el[1]) in ("IRI", "AbbreviatedIRI") else _iri(el[1])
                val = (el[2].text or "").strip()
                if prop.endswith("label") and val:
                    self.labels[subj] = val
                elif prop.endswith("comment") and val:
                    self.comments[subj].append(val)

    # ---------- zobrazenie výrazov (zjednodušená Manchester syntax) ----------
    def n(self, el_or_iri):
        iri = el_or_iri if isinstance(el_or_iri, str) else _iri(el_or_iri)
        return self.labels.get(iri) or _short(iri)

    def expr(self, el):
        t, ch = _tag(el), list(el)
        if t in ("Class", "NamedIndividual", "ObjectProperty", "DataProperty", "Datatype"):
            return self.n(el)
        if t == "Literal":
            return f'"{el.text or ""}"'
        if t in ("ObjectSomeValuesFrom", "DataSomeValuesFrom"):
            return f"{self.n(ch[0])} some {self.expr(ch[1])}"
        if t in ("ObjectAllValuesFrom", "DataAllValuesFrom"):
            return f"{self.n(ch[0])} only {self.expr(ch[1])}"
        if t in ("ObjectHasValue", "DataHasValue"):
            return f"{self.n(ch[0])} value {self.expr(ch[1])}"
        if "Cardinality" in t:
            word = {"Exact": "exactly", "Min": "min", "Max": "max"}[t.replace("Object", "").replace("Data", "")[:-11]]
            rest = f" {self.expr(ch[1])}" if len(ch) > 1 else ""
            return f"{self.n(ch[0])} {word} {el.get('cardinality')}{rest}"
        if t in ("ObjectIntersectionOf", "ObjectUnionOf", "DataIntersectionOf", "DataUnionOf"):
            op = " and " if "Intersection" in t else " or "
            return "(" + op.join(self.expr(c) for c in ch) + ")"
        if t in ("ObjectComplementOf", "DataComplementOf"):
            return f"not {self.expr(ch[0])}"
        if t in ("ObjectOneOf", "DataOneOf"):
            return "{" + ", ".join(self.expr(c) for c in ch) + "}"
        if t == "DatatypeRestriction":
            facets = [f"{FACET.get(_short(f.get('facet')), _short(f.get('facet')))} {f[0].text}" for f in ch[1:]]
            return f"{self.n(ch[0])}[{', '.join(facets)}]"
        return t

    def atom(self, el):
        t, ch = _tag(el), list(el)
        arg = lambda e: "?" + _short(_iri(e)) if _tag(e) == "Variable" else self.expr(e)
        if t == "ClassAtom":
            return f"{self.expr(ch[0])}({arg(ch[1])})"
        if t in ("ObjectPropertyAtom", "DataPropertyAtom"):
            return f"{self.n(ch[0])}({arg(ch[1])}, {arg(ch[2])})"
        if t == "BuiltInAtom":
            return f"swrlb:{_short(_iri(el))}({', '.join(arg(c) for c in ch)})"
        if t == "DifferentIndividualsAtom":
            return f"differentFrom({', '.join(arg(c) for c in ch)})"
        if t == "SameIndividualAtom":
            return f"sameAs({', '.join(arg(c) for c in ch)})"
        return t

    # ---------- úryvky ----------
    def uryvky(self):
        cls = defaultdict(lambda: defaultdict(list))   # iri -> sekcia -> riadky
        prop = defaultdict(lambda: defaultdict(list))
        ind = defaultdict(lambda: defaultdict(list))
        rules = []

        for el in self.root:
            t, ch = _tag(el), list(el)
            if t == "SubClassOf" and _tag(ch[0]) == "Class":
                key = "Nadtrieda" if _tag(ch[1]) == "Class" else "Obmedzenie"
                cls[_iri(ch[0])][key].append(self.expr(ch[1]))
            elif t == "EquivalentClasses":
                named = [c for c in ch if _tag(c) == "Class"]
                for c in named:
                    for o in ch:
                        if o is not c:
                            cls[_iri(c)]["Definícia (ekvivalentná trieda)"].append(self.expr(o))
            elif t == "DisjointClasses":
                for c in ch:
                    for o in ch:
                        if o is not c and _tag(c) == "Class":
                            cls[_iri(c)]["Disjunktná s"].append(self.expr(o))
            elif t in ("ObjectPropertyDomain", "DataPropertyDomain"):
                prop[_iri(ch[0])]["Doména"].append(self.expr(ch[1]))
            elif t in ("ObjectPropertyRange", "DataPropertyRange"):
                prop[_iri(ch[0])]["Rozsah"].append(self.expr(ch[1]))
            elif t in ("SubObjectPropertyOf", "SubDataPropertyOf") and _tag(ch[0]) in ("ObjectProperty", "DataProperty"):
                sup = self.n(ch[1])
                if sup not in ("topObjectProperty", "topDataProperty"):
                    prop[_iri(ch[0])]["Podvlastnosť"].append(sup)
            elif t == "InverseObjectProperties":
                prop[_iri(ch[0])]["Inverzná"].append(self.n(ch[1]))
                prop[_iri(ch[1])]["Inverzná"].append(self.n(ch[0]))
            elif t.endswith("ObjectProperty") or t == "FunctionalDataProperty":
                if t != "ObjectProperty" and ch:
                    name = {"FunctionalObjectProperty": "funkčná", "FunctionalDataProperty": "funkčná",
                            "SymmetricObjectProperty": "symetrická", "TransitiveObjectProperty": "tranzitívna",
                            "InverseFunctionalObjectProperty": "inverzne funkčná"}.get(t, t)
                    prop[_iri(ch[0])]["Charakteristika"].append(name)
            elif t == "ClassAssertion":
                ind[_iri(ch[1])]["Typ"].append(self.expr(ch[0]))
                if _tag(ch[0]) == "Class":
                    cls[_iri(ch[0])]["Individuá"].append(self.n(ch[1]))
            elif t in ("ObjectPropertyAssertion", "DataPropertyAssertion"):
                ind[_iri(ch[1])]["Vlastnosti"].append(f"{self.n(ch[0])}: {self.expr(ch[2]).strip(chr(34))}")
            elif t == "DLSafeRule":
                label = next((a[1].text for a in el.findall(OWL + "Annotation")
                              if _iri(a[0]).endswith("label") and a[1].text), "pravidlo")
                body = " ∧ ".join(self.atom(a) for a in el.find(OWL + "Body"))
                head = " ∧ ".join(self.atom(a) for a in el.find(OWL + "Head"))
                rules.append((label, body, head))

        out = []

        def add(iri, typ, sekcie):
            name = self.n(iri)
            riadky = [f"{typ} {name} (ontológia PC konfigurátora)."]
            for c in self.comments.get(iri, []):
                riadky.append(f"Popis: {c}")
            for k, v in sekcie.items():
                riadky.append(f"{k}: {'; '.join(dict.fromkeys(v))}.")
            out.append({"nazov": name, "typ": typ, "text": "\n".join(riadky)})

        for iri, k in self.kind.items():
            if k == "Class":
                add(iri, "Trieda", cls.get(iri, {}))
            elif k == "ObjectProperty":
                add(iri, "Objektová vlastnosť", prop.get(iri, {}))
            elif k == "DataProperty":
                add(iri, "Dátová vlastnosť", prop.get(iri, {}))
            elif k == "NamedIndividual":
                add(iri, "Individuum", ind.get(iri, {}))
        for label, body, head in sorted(rules):
            out.append({"nazov": label, "typ": "Pravidlo SWRL",
                        "text": f"Pravidlo SWRL {label} (ontológia PC konfigurátora).\nAk platí: {body}\nPotom platí: {head}"})
        return out
