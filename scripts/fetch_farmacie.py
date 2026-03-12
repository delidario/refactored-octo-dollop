#!/usr/bin/env python3
"""
fetch_farmacie.py
─────────────────
Scarica la lista delle farmacie di turno a Milano dalla pagina pubblica
di farmaciediturno.org, geocodifica gli indirizzi con Nominatim (OpenStreetMap)
e salva i risultati in data/farmacie-YYYY-MM-DD.json.

Non richiede nessuna chiave API.
"""

import json
import os
import re
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

# ── Configurazione ───────────────────────────────────────────────
SOURCE_URL   = "https://www.farmaciediturno.org/comune.asp?cod=15146"
NOMINATIM    = "https://nominatim.openstreetmap.org/search"
DATA_DIR     = os.path.join(os.path.dirname(__file__), "..", "data")
CACHE_FILE   = os.path.join(DATA_DIR, "geocoding_cache.json")

HEADERS = {
    # Un User-Agent standard da browser è sufficiente per leggere pagine pubbliche
    "User-Agent": (
        "Mozilla/5.0 (compatible; FarmacieMilanoMap/1.0; "
        "personal non-commercial use)"
    ),
    "Accept-Language": "it-IT,it;q=0.9",
}

# ── Carica / salva la cache delle coordinate ─────────────────────
def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_cache(cache: dict) -> None:
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

# ── Scarica e analizza la pagina HTML ────────────────────────────
def scrape_farmacie() -> list[dict]:
    print(f"Scaricamento da: {SOURCE_URL}")
    resp = requests.get(SOURCE_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or "utf-8"

    soup = BeautifulSoup(resp.text, "html.parser")
    farmacie = []

    # Cerca tutte le righe di tabella con dati di farmacia
    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 2:
            continue

        testo = [c.get_text(" ", strip=True) for c in cells]

        # La riga di intestazione o righe vuote vengono saltate
        if not testo[0] or testo[0].lower() in ("farmacia", "nome", "denominazione"):
            continue

        nome     = testo[0] if len(testo) > 0 else ""
        indirizzo = testo[1] if len(testo) > 1 else ""
        telefono = ""
        orario   = ""

        # Cerca telefono (pattern: cifre, spazi, trattini)
        for cella in testo[2:]:
            if re.search(r"\d[\d\s\-/]{5,}", cella) and not telefono:
                telefono = cella.strip()
            elif re.search(r"\d{1,2}[:\.]?\d{2}", cella) and not orario:
                orario = cella.strip()

        if nome and indirizzo:
            farmacie.append({
                "nome":      nome,
                "indirizzo": indirizzo,
                "telefono":  telefono,
                "orario":    orario,
            })

    print(f"  Trovate {len(farmacie)} farmacie nella pagina.")
    return farmacie

# ── Geocodifica un indirizzo con Nominatim ───────────────────────
def geocode(indirizzo: str, cache: dict) -> tuple[float, float] | tuple[None, None]:
    # Usa la cache per evitare chiamate ripetute
    chiave = indirizzo.lower().strip()
    if chiave in cache:
        return cache[chiave]["lat"], cache[chiave]["lon"]

    query = f"{indirizzo}, Milano, Italia"
    try:
        resp = requests.get(
            NOMINATIM,
            params={"q": query, "format": "json", "limit": 1},
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        risultati = resp.json()
        if risultati:
            lat = float(risultati[0]["lat"])
            lon = float(risultati[0]["lon"])
            cache[chiave] = {"lat": lat, "lon": lon}
            return lat, lon
    except Exception as e:
        print(f"  Geocoding fallito per '{indirizzo}': {e}")

    # Nominatim ha un limite di 1 richiesta al secondo — rispettiamolo
    time.sleep(1.1)
    return None, None

# ── Main ─────────────────────────────────────────────────────────
def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    cache = load_cache()

    # Scarica la lista di oggi
    farmacie_raw = scrape_farmacie()
    if not farmacie_raw:
        print("Nessuna farmacia trovata. Controlla se il sito ha cambiato struttura.")
        return

    # Geocodifica ogni farmacia
    print("Geocodifica degli indirizzi in corso...")
    farmacie = []
    for f in farmacie_raw:
        lat, lon = geocode(f["indirizzo"], cache)
        time.sleep(1.1)  # rispetta il rate limit di Nominatim

        if lat is None:
            print(f"  SKIP (no coordinate): {f['nome']} — {f['indirizzo']}")
            continue

        farmacie.append({**f, "lat": lat, "lon": lon})

    save_cache(cache)
    print(f"  {len(farmacie)} farmacie geocodificate su {len(farmacie_raw)}.")

    # Salva il file del giorno
    today_str = datetime.now(timezone.utc).date().isoformat()
    payload = {
        "date":       today_str,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "farmacie":   farmacie,
    }
    out_path = os.path.join(DATA_DIR, f"farmacie-{today_str}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"  Salvato: {out_path}")

    # Aggiorna l'indice delle date disponibili
    index_path = os.path.join(DATA_DIR, "index.json")
    index = {"dates": [], "updated_at": ""}
    if os.path.exists(index_path):
        with open(index_path) as f:
            index = json.load(f)

    if today_str not in index["dates"]:
        index["dates"].append(today_str)
        index["dates"].sort(reverse=True)   # più recente prima

    # Mantieni solo gli ultimi 30 giorni nell'indice
    index["dates"] = index["dates"][:30]
    index["updated_at"] = datetime.now(timezone.utc).isoformat()

    with open(index_path, "w") as f:
        json.dump(index, f, indent=2)

    print(f"\nFatto. Date disponibili: {', '.join(index['dates'])}")


if __name__ == "__main__":
    main()
