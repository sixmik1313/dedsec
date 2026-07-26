"""
DedSec Terminal — backend Flask
Proxifie des APIs publiques reelles pour contourner les restrictions CORS
et permettre a l'app de tourner comme un vrai service.

Sources reelles utilisees :
- INTERPOL Notices API (avis de recherche / disparitions publics)     -> ws-public.interpol.int
- RTE eco2mix / ODRE (reseau electrique francais en direct)           -> odre.opendatasoft.com
- Frankfurter / BCE (taux de change de reference)                    -> api.frankfurter.app
- Digitraffic / Fintraffic (cameras routieres publiques, Finlande/UE) -> tie.digitraffic.fi
"""
from flask import Flask, jsonify, render_template, request
import requests

app = Flask(__name__)

HEADERS = {"User-Agent": "dedsec-terminal/1.0 (usage personnel, donnees publiques)"}
DIGITRAFFIC_HEADERS = {**HEADERS, "Digitraffic-User": "dedsec-terminal/1.0"}

INTERPOL_BASE = "https://ws-public.interpol.int/notices/v1"
RTE_URL = "https://odre.opendatasoft.com/api/records/1.0/search/"
FX_URL = "https://api.frankfurter.app/latest"
CAMS_URL = "https://tie.digitraffic.fi/api/weathercam/v1/stations"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/wanted")
def wanted():
    """Avis INTERPOL publics. type=red (recherches) ou yellow (disparitions)."""
    notice_type = request.args.get("type", "red")
    if notice_type not in ("red", "yellow"):
        notice_type = "red"
    name = request.args.get("name", "").strip()

    params = {"resultPerPage": 8}
    if notice_type == "red":
        params["arrestWarrantCountryId"] = request.args.get("country", "FR")
    else:
        params["nationality"] = request.args.get("country", "FR")
    if name:
        params["name"] = name

    try:
        r = requests.get(f"{INTERPOL_BASE}/{notice_type}", params=params, headers=HEADERS, timeout=8)
        r.raise_for_status()
        data = r.json()
        notices = (data.get("_embedded") or {}).get("notices", [])
        out = []
        for n in notices:
            out.append({
                "name": " ".join(filter(None, [n.get("forename"), n.get("name")])) or "Identite non communiquee",
                "nationalities": n.get("nationalities", []),
                "date_of_birth": n.get("date_of_birth"),
                "link": (n.get("_links") or {}).get("self", {}).get("href"),
            })
        return jsonify({"ok": True, "count": len(out), "notices": out})
    except requests.RequestException as e:
        return jsonify({"ok": False, "error": str(e)}), 502


@app.route("/api/grid")
def grid():
    """Reseau electrique francais en direct (RTE eco2mix)."""
    params = {"dataset": "eco2mix-national-tr", "rows": 1, "sort": "-date_heure"}
    try:
        r = requests.get(RTE_URL, params=params, headers=HEADERS, timeout=8)
        r.raise_for_status()
        data = r.json()
        records = data.get("records", [])
        if not records:
            return jsonify({"ok": False, "error": "aucune donnee disponible"}), 502
        fields = records[0]["fields"]
        return jsonify({"ok": True, "fields": fields})
    except requests.RequestException as e:
        return jsonify({"ok": False, "error": str(e)}), 502


@app.route("/api/fx")
def fx():
    """Taux de change reels (BCE, via Frankfurter)."""
    params = {"from": "EUR", "to": "USD,GBP,CHF,JPY,CAD"}
    try:
        r = requests.get(FX_URL, params=params, headers=HEADERS, timeout=8)
        r.raise_for_status()
        return jsonify({"ok": True, **r.json()})
    except requests.RequestException as e:
        return jsonify({"ok": False, "error": str(e)}), 502


@app.route("/api/cameras")
def cameras():
    """Cameras routieres publiques et reelles (reseau Digitraffic / Fintraffic, Finlande - UE).
    Renvoie une selection de stations avec l'URL directe de l'image en direct."""
    limit = int(request.args.get("limit", 12))
    try:
        r = requests.get(CAMS_URL, headers=DIGITRAFFIC_HEADERS, timeout=10)
        r.raise_for_status()
        data = r.json()
        features = data.get("features", [])
        out = []
        for f in features:
            props = f.get("properties", {})
            if props.get("state") != "OK":
                continue
            presets = props.get("presets", [])
            for p in presets:
                if not p.get("inCollection", True):
                    continue
                preset_id = p.get("presetId")
                if not preset_id:
                    continue
                out.append({
                    "id": preset_id,
                    "name": props.get("name", preset_id),
                    "direction": p.get("presetName1", ""),
                    "image": f"https://weathercam.digitraffic.fi/{preset_id}.jpg",
                    "coords": f.get("geometry", {}).get("coordinates"),
                })
                if len(out) >= limit:
                    break
            if len(out) >= limit:
                break
        return jsonify({"ok": True, "count": len(out), "cameras": out})
    except requests.RequestException as e:
        return jsonify({"ok": False, "error": str(e)}), 502


if __name__ == "__main__":
    app.run(debug=True, port=5000)
