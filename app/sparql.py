
import logging
import os
from decimal import Decimal
from pathlib import Path

from ontologia import Ontologia

log = logging.getLogger("sparql")
DATA = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))

PREFIXES = """PREFIX : <http://www.example.org/pc-konfigurator#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""


def local(iri: str) -> str:
    return iri.split("#")[-1] if "#" in iri else iri.rsplit("/", 1)[-1]


class Store:
    backend = "rdflib"

    def __init__(self):
        self.graph, self.pravidla = None, {}

    def init(self):
        subor = sorted((DATA / "ontologia").glob("*.owl"))[0]
        onto = Ontologia(subor)
        self.graph, self.pravidla = onto.graf(), onto.pravidla()
        log.info("Ontológia %s: %d trojíc, %d SWRL pravidiel", subor.name, len(self.graph), len(self.pravidla))

    def select(self, query: str):
        res = self.graph.query(PREFIXES + query)
        out = []
        for row in res:
            d = {}
            for var in res.vars:
                v = row[var]
                if v is None:
                    continue
                py = v.toPython() if hasattr(v, "toPython") else str(v)
                if isinstance(py, Decimal):
                    py = float(py)
                elif not isinstance(py, (int, float, bool)):
                    py = str(v)
                d[str(var)] = py
            out.append(d)
        return out


store = Store()
