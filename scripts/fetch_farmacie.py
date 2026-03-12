#!/usr/bin/env python3
"""
fetch_farmacie.py
─────────────────
Fetches "farmacie di turno" data for Milan from the farmaciediturno.org API
and stores one JSON file per day in the data/ directory.

Environment variable required:
  FARMACIEDITURNO_API_KEY  — your API key from farmaciediturno.org

How to get a key: send an e-mail to info@farmaciediturno.org
stating your name and intended use.
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

# ── Configuration ────────────────────────────────────────────────
API_KEY  = os.environ.get("FARMACIEDITURNO_API_KEY", "").strip()
BASE_URL = "https://api.farmaciediturno.org/aperteturno.asp"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# Multiple points spread across Milan so we collect more pharmacies.
# The API returns the 20 nearest to the given coordinates, so using
# several reference points gives broader coverage.
MILAN_POINTS = [
    {"name": "Centro",        "lat": 45.4654, "lon": 9.1860},
    {"name": "Nord",          "lat": 45.5060, "lon": 9.1900},
    {"name": "Sud",           "lat": 45.4190, "lon": 9.1900},
    {"name": "Est",           "lat": 45.4654, "lon": 9.2400},
    {"name": "Ovest",         "lat": 45.4654, "lon": 9.1280},
    {"name": "Nord-Est",      "lat": 45.4960, "lon": 9.2300},
    {"name": "Sud-Ovest",     "lat": 45.4350, "lon": 9.1500},
]

# How many future days to fetch (today = 0, tomorrow = 1, …)
DAYS_AHEAD = 7


def fetch_for_point(giorno: int, lat: float, lon: float) -> list:
    """Call the API for one reference point and one day offset."""
    params = {
        "key":    API_KEY,
        "output": "json",
        "lat":    lat,
        "lon":    lon,
        "filtro": "milano",
        "giorno": giorno,
    }
    resp = requests.get(BASE_URL, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    # The API wraps results in a "farmacie" key; field names vary
    raw = data.get("farmacie") or data.get("results") or []
    return raw


def normalise(raw: dict) -> dict | None:
    """Map raw API fields to a consistent structure."""
    lat = raw.get("lat") or raw.get("latitude") or ""
    lon = raw.get("lon") or raw.get("longitude") or raw.get("lng") or ""

    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (ValueError, TypeError):
        return None  # skip entries without coordinates

    nome    = raw.get("nome") or raw.get("denominazione") or raw.get("name") or ""
    via     = raw.get("indirizzo") or raw.get("via") or raw.get("address") or ""
    comune  = raw.get("comune") or raw.get("localita") or raw.get("city") or "Milano"
    tel     = raw.get("telefono") or raw.get("phone") or ""
    orario  = raw.get("orario") or raw.get("orari") or raw.get("hours") or ""

    # Build a clean address string
    if comune.lower() not in via.lower():
        indirizzo = f"{via}, {comune}"
    else:
        indirizzo = via

    return {
        "nome":      nome.strip(),
        "indirizzo": indirizzo.strip(),
        "telefono":  tel.strip(),
        "orario":    orario.strip(),
        "lat":       lat_f,
        "lon":       lon_f,
    }


def fetch_day(giorno: int) -> list:
    """Fetch and deduplicate all farmacie for a given day offset."""
    seen: dict[str, dict] = {}  # keyed by "nome|indirizzo" to deduplicate

    for point in MILAN_POINTS:
        try:
            raw_list = fetch_for_point(giorno, point["lat"], point["lon"])
        except Exception as exc:
            print(f"  Warning: could not fetch from {point['name']}: {exc}", file=sys.stderr)
            continue

        for raw in raw_list:
            entry = normalise(raw)
            if not entry:
                continue
            key = f"{entry['nome'].lower()}|{entry['indirizzo'].lower()}"
            if key not in seen:
                seen[key] = entry

    return list(seen.values())


def main():
    if not API_KEY:
        print("ERROR: FARMACIEDITURNO_API_KEY environment variable is not set.", file=sys.stderr)
        print("Request a free key from info@farmaciediturno.org", file=sys.stderr)
        sys.exit(1)

    os.makedirs(DATA_DIR, exist_ok=True)

    today     = datetime.now(timezone.utc).date()
    saved_dates: list[str] = []

    for offset in range(DAYS_AHEAD + 1):
        date     = today + timedelta(days=offset)
        date_str = date.isoformat()

        print(f"Fetching data for {date_str} (giorno={offset})…")
        farmacie = fetch_day(offset)

        if not farmacie:
            print(f"  No data returned for {date_str} — skipping.")
            continue

        payload = {
            "date":       date_str,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "farmacie":   farmacie,
        }

        out_path = os.path.join(DATA_DIR, f"farmacie-{date_str}.json")
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)

        saved_dates.append(date_str)
        print(f"  Saved {len(farmacie)} farmacie → {out_path}")

    # Write index so the website knows which dates are available
    index = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "dates":      saved_dates,
    }
    index_path = os.path.join(DATA_DIR, "index.json")
    with open(index_path, "w") as fh:
        json.dump(index, fh, indent=2)

    print(f"\nDone. {len(saved_dates)} date(s) saved.")


if __name__ == "__main__":
    main()
