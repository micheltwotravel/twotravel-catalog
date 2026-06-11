"""
import_properties.py — Upload 631 properties to GAS in batches of 50
Usage: python3 scripts/import_properties.py
"""
import json, urllib.request, time

GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec"
JSON_FILE = "properties_import.json"
BATCH = 50

with open(JSON_FILE, encoding="utf-8") as f:
    props = json.load(f)["properties"]

total = len(props)
print(f"Total properties to import: {total}")
print(f"Batches of {BATCH}: {(total + BATCH - 1) // BATCH}")

written = 0
for i in range(0, total, BATCH):
    batch = props[i:i+BATCH]
    payload = json.dumps({"action": "property_bulk", "data": {"properties": batch}}).encode("utf-8")
    req = urllib.request.Request(GAS_URL, data=payload,
          headers={"Content-Type": "text/plain;charset=utf-8"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode()
            try:
                result = json.loads(body)
                ok = result.get("ok") or result.get("written")
                print(f"  Batch {i//BATCH+1}: {len(batch)} props → {'✅ OK' if ok else '⚠️ '+body[:120]}")
            except:
                print(f"  Batch {i//BATCH+1}: raw response: {body[:200]}")
        written += len(batch)
    except Exception as e:
        print(f"  Batch {i//BATCH+1}: ERROR — {e}")
    time.sleep(1.5)  # be nice to GAS rate limits

print(f"\nDone. {written}/{total} properties uploaded.")
