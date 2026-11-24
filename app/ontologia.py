"""Ontológia zo Zadania 1 (.owl, RDF/XML z Protégé / WebProtégé).

Z jedného súboru sa vytvorí:
  - graf()     graf trojíc pre SPARQL dopyty konfigurátora,
  - pravidla() SWRL pravidlá ako text (R01 → "… → …"),
  - uryvky()   textové úryvky pre RAG: každá trieda, vlastnosť, individuum a pravidlo.

WebProtégé dáva entitám náhodné IRI (http://webprotege.stanford.edu/R…), preto
dostane každá entita nové IRI podľa svojho rdfs:label, napr. pc:Ryzen5_5600X.
"""
from collections import defaultdict

import rdflib
from rdflib import BNode, Literal, Namespace, URIRef
from rdflib.collection import Collection
from rdflib.namespace import OWL, RDF, RDFS

NS = Namespace("http://www.example.org/pc-konfigurator#")
SWRL = Namespace("http://www.w3.org/2003/11/swrl#")
SWRLB = "http://www.w3.org/2003/11/swrlb#"
ENTITY = {OWL.Class: "Trieda", OWL.ObjectProperty: "Objektová vlastnosť",
          OWL.DatatypeProperty: "Dátová vlastnosť", OWL.NamedIndividual: "Individuum"}
CHAR = {OWL.FunctionalProperty: "funkčná", OWL.SymmetricProperty: "symetrická",
        OWL.TransitiveProperty: "tranzitívna", OWL.InverseFunctionalProperty: "inverzne funkčná"}
FACET = {"minInclusive": ">=", "maxInclusive": "<=", "minExclusive": ">", "maxExclusive": "<"}


def _frag(iri):
    return str(iri).replace("#", "/").rsplit("/", 1)[-1]


class Ontologia:
    def __init__(self, path):
        povodny = rdflib.Graph()
        povodny.parse(path, format="xml")
        # entity s popiskom dostanú IRI podľa popisku
        nove = {}
        for typ in ENTITY:
            for s in povodny.subjects(RDF.type, typ):
                lab = povodny.value(s, RDFS.label)
                if isinstance(s, URIRef) and lab:
                    nove[s] = NS[str(lab).strip().replace(" ", "_")]
        self.g = rdflib.Graph()
        self.g.bind("pc", NS)
        for s, p, o in povodny:
            self.g.add((nove.get(s, s), nove.get(p, p), nove.get(o, o)))

    # ---------- pomocné ----------
    def n(self, x):
        """Meno entity: lokálna časť IRI (= rdfs:label), pre ostatné fragment IRI."""
        return str(x)[len(NS):] if str(x).startswith(str(NS)) else _frag(x)

    def zoznam(self, head):
        return list(Collection(self.g, head)) if head else []

    def expr(self, x):
        """Výraz triedy v zjednodušenej Manchester syntaxi."""
        g = self.g
        if isinstance(x, Literal):
            return f'"{x}"'
        if isinstance(x, URIRef):
            return self.n(x)
        if (x, RDF.type, OWL.Restriction) in g:
            p = self.n(g.value(x, OWL.onProperty))
            for pred, slovo in ((OWL.someValuesFrom, "some"), (OWL.allValuesFrom, "only"), (OWL.hasValue, "value")):
                if (v := g.value(x, pred)) is not None:
                    return f"{p} {slovo} {self.expr(v)}"
            for pred, slovo in ((OWL.qualifiedCardinality, "exactly"), (OWL.cardinality, "exactly"),
                                (OWL.minQualifiedCardinality, "min"), (OWL.minCardinality, "min"),
                                (OWL.maxQualifiedCardinality, "max"), (OWL.maxCardinality, "max")):
                if (v := g.value(x, pred)) is not None:
                    trieda = g.value(x, OWL.onClass) or g.value(x, OWL.onDataRange)
                    return f"{p} {slovo} {v}" + (f" {self.expr(trieda)}" if trieda is not None else "")
        for pred, op in ((OWL.intersectionOf, " and "), (OWL.unionOf, " or ")):
            if (v := g.value(x, pred)) is not None:
                return "(" + op.join(self.expr(c) for c in self.zoznam(v)) + ")"
        if (v := g.value(x, OWL.complementOf)) is not None:
            return f"not {self.expr(v)}"
        if (v := g.value(x, OWL.oneOf)) is not None:
            return "{" + ", ".join(self.expr(c) for c in self.zoznam(v)) + "}"
        if (v := g.value(x, OWL.onDatatype)) is not None:
            fasety = []
            for f in self.zoznam(g.value(x, OWL.withRestrictions)):
                for p, o in g.predicate_objects(f):
                    fasety.append(f"{FACET.get(_frag(p), _frag(p))} {o}")
            return f"{self.n(v)}[{', '.join(fasety)}]"
        return "výraz"

    def atom(self, a):
        g = self.g
        arg = lambda v: "?" + _frag(v) if (v, RDF.type, SWRL.Variable) in g else self.expr(v)
        typ = g.value(a, RDF.type)
        if typ == SWRL.ClassAtom:
            return f"{self.expr(g.value(a, SWRL.classPredicate))}({arg(g.value(a, SWRL.argument1))})"
        if typ in (SWRL.IndividualPropertyAtom, SWRL.DatavaluedPropertyAtom):
            return f"{self.n(g.value(a, SWRL.propertyPredicate))}({arg(g.value(a, SWRL.argument1))}, {arg(g.value(a, SWRL.argument2))})"
        if typ == SWRL.BuiltinAtom:
            args = ", ".join(arg(v) for v in self.zoznam(g.value(a, SWRL.arguments)))
            return f"swrlb:{_frag(g.value(a, SWRL.builtin))}({args})"
        if typ in (SWRL.DifferentIndividualsAtom, SWRL.SameIndividualAtom):
            meno = "differentFrom" if typ == SWRL.DifferentIndividualsAtom else "sameAs"
            return f"{meno}({arg(g.value(a, SWRL.argument1))}, {arg(g.value(a, SWRL.argument2))})"
        return "atóm"

    # ---------- výstupy ----------
    def graf(self):
        return self.g

    def pravidla(self):
        """SWRL pravidlá ako text: {"R01": "Procesor(?c) ∧ … → procesorPasujeNaDosku(?c, ?d)"}."""
        out = {}
        for r in self.g.subjects(RDF.type, SWRL.Imp):
            label = self.g.value(r, RDFS.label)
            if label:
                telo = " ∧ ".join(self.atom(a) for a in self.zoznam(self.g.value(r, SWRL.body)))
                hlava = " ∧ ".join(self.atom(a) for a in self.zoznam(self.g.value(r, SWRL.head)))
                out[str(label).split()[0]] = (telo, hlava)
        return {k: f"{t} → {h}" for k, (t, h) in sorted(out.items())}

    def uryvky(self):
        g = self.g
        sekcie = defaultdict(lambda: defaultdict(list))
        vlastnosti = set(g.subjects(RDF.type, OWL.ObjectProperty)) | set(g.subjects(RDF.type, OWL.DatatypeProperty))

        for c in g.subjects(RDF.type, OWL.Class):
            if not isinstance(c, URIRef):
                continue
            for sup in g.objects(c, RDFS.subClassOf):
                sekcie[c]["Nadtrieda" if isinstance(sup, URIRef) else "Obmedzenie"].append(self.expr(sup))
            for e in g.objects(c, OWL.equivalentClass):
                sekcie[c]["Definícia (ekvivalentná trieda)"].append(self.expr(e))
            for d in set(g.objects(c, OWL.disjointWith)) | set(g.subjects(OWL.disjointWith, c)):
                sekcie[c]["Disjunktná s"].append(self.expr(d))
        for ad in g.subjects(RDF.type, OWL.AllDisjointClasses):
            cleny = self.zoznam(g.value(ad, OWL.members))
            for c in cleny:
                sekcie[c]["Disjunktná s"] += [self.expr(o) for o in cleny if o != c]

        for p in vlastnosti:
            for d in g.objects(p, RDFS.domain):
                sekcie[p]["Doména"].append(self.expr(d))
            for r in g.objects(p, RDFS.range):
                sekcie[p]["Rozsah"].append(self.expr(r))
            for t in g.objects(p, RDF.type):
                if t in CHAR:
                    sekcie[p]["Charakteristika"].append(CHAR[t])
            for i in set(g.objects(p, OWL.inverseOf)) | set(g.subjects(OWL.inverseOf, p)):
                sekcie[p]["Inverzná"].append(self.n(i))
            for sup in g.objects(p, RDFS.subPropertyOf):
                if sup not in (OWL.topObjectProperty, OWL.topDataProperty):
                    sekcie[p]["Podvlastnosť"].append(self.n(sup))

        for i in g.subjects(RDF.type, OWL.NamedIndividual):
            for t in g.objects(i, RDF.type):
                if t != OWL.NamedIndividual:
                    sekcie[i]["Typ"].append(self.expr(t))
                    if isinstance(t, URIRef):
                        sekcie[t]["Individuá"].append(self.n(i))
            for p, o in g.predicate_objects(i):
                if p in vlastnosti:
                    sekcie[i]["Vlastnosti"].append(f"{self.n(p)}: {o if isinstance(o, Literal) else self.n(o)}")

        out = []
        for typ, nazov in ENTITY.items():
            for e in sorted(g.subjects(RDF.type, typ), key=self.n):
                if not str(e).startswith(str(NS)):
                    continue
                riadky = [f"{nazov} {self.n(e)} (ontológia PC konfigurátora)."]
                riadky += [f"Popis: {c}" for c in g.objects(e, RDFS.comment) if str(c).strip()]
                riadky += [f"{k}: {'; '.join(dict.fromkeys(v))}." for k, v in sekcie[e].items()]
                out.append({"nazov": self.n(e), "typ": nazov, "text": "\n".join(riadky)})
        for label, text in self.pravidla().items():
            telo, hlava = text.split(" → ")
            out.append({"nazov": label, "typ": "Pravidlo SWRL",
                        "text": f"Pravidlo SWRL {label} (ontológia PC konfigurátora).\nAk platí: {telo}\nPotom platí: {hlava}"})
        return out
