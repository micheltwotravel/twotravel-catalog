#!/usr/bin/env python3
"""
PERF-8: Monitoreo automático semanal de PageSpeed — two.travel
Corre con: python3 perf-8-monitor.py
Configurar como cron semanal: 0 9 * * 1 python3 /path/to/perf-8-monitor.py

Requisitos:
  pip install requests

Alertas: se envía email si score < 75 o Blocking Time > 400ms.
Configurar SMTP_* abajo o exportar como variables de entorno.
"""

import requests
import json
import smtplib
import os
import time
from email.mime.text import MIMEText
from datetime import datetime

# ── Configuración ──────────────────────────────
API_KEY   = os.getenv("PAGESPEED_API_KEY", "")   # opcional, sin key funciona pero con límite
SCORE_MIN = 75       # alerta si score baja de aquí
TBT_MAX   = 400      # ms — alerta si Total Blocking Time sube de aquí

PAGES = [
    "https://two.travel",
    "https://two.travel/cartagena",
    "https://two.travel/bodas",
]

# ── Email (SMTP) ───────────────────────────────
SMTP_HOST   = os.getenv("SMTP_HOST",   "smtp.gmail.com")
SMTP_PORT   = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER   = os.getenv("SMTP_USER",   "")       # ej. alerts@two.travel
SMTP_PASS   = os.getenv("SMTP_PASS",   "")       # app password
ALERT_TO    = os.getenv("ALERT_TO",   "ray@two.travel,michel@two.travel")
ALERT_FROM  = os.getenv("ALERT_FROM", SMTP_USER)
# ──────────────────────────────────────────────


def check_page(url: str) -> dict:
    params = {
        "url": url,
        "strategy": "mobile",
        "category": "performance",
    }
    if API_KEY:
        params["key"] = API_KEY

    r = requests.get(
        "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
        params=params,
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()

    lh   = data.get("lighthouseResult", {})
    cats = lh.get("categories", {})
    audits = lh.get("audits", {})

    score   = round((cats.get("performance", {}).get("score", 0) or 0) * 100)
    tbt_ms  = round(audits.get("total-blocking-time", {}).get("numericValue", 0) or 0)
    lcp_s   = round((audits.get("largest-contentful-paint", {}).get("numericValue", 0) or 0) / 1000, 1)
    fcp_s   = round((audits.get("first-contentful-paint",  {}).get("numericValue", 0) or 0) / 1000, 1)

    return {
        "url":   url,
        "score": score,
        "tbt":   tbt_ms,
        "lcp":   lcp_s,
        "fcp":   fcp_s,
        "alert": score < SCORE_MIN or tbt_ms > TBT_MAX,
    }


def send_alert(results: list):
    date_str = datetime.now().strftime("%d %b %Y")
    lines = [f"⚠ two.travel PageSpeed Alert — {date_str}\n"]

    for r in results:
        flag = "🔴" if r["alert"] else "🟢"
        lines.append(
            f"{flag} {r['url']}\n"
            f"   Score: {r['score']}/100  (min {SCORE_MIN})\n"
            f"   Blocking Time: {r['tbt']} ms  (max {TBT_MAX} ms)\n"
            f"   LCP: {r['lcp']} s  |  FCP: {r['fcp']} s\n"
        )

    body = "\n".join(lines)
    print(body)

    if not SMTP_USER or not SMTP_PASS:
        print("⚠ SMTP no configurado — solo se muestra en consola.")
        return

    msg = MIMEText(body)
    msg["Subject"] = f"⚠ two.travel PageSpeed bajo del objetivo — {date_str}"
    msg["From"]    = ALERT_FROM
    msg["To"]      = ALERT_TO

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.sendmail(ALERT_FROM, ALERT_TO.split(","), msg.as_string())
    print("✅ Alerta enviada a", ALERT_TO)


def main():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Revisando PageSpeed móvil…\n")
    results = []
    any_alert = False

    for i, url in enumerate(PAGES):
        if i > 0:
            time.sleep(10)  # evitar rate limit sin API key
        try:
            r = check_page(url)
            results.append(r)
            flag = "🔴" if r["alert"] else "🟢"
            print(f"{flag}  {url}  →  score {r['score']}  |  TBT {r['tbt']}ms  |  LCP {r['lcp']}s")
            if r["alert"]:
                any_alert = True
        except Exception as e:
            print(f"❌  {url}  →  Error: {e}")
            any_alert = True

    # Guardar log
    log_file = os.path.join(os.path.dirname(__file__), "pagespeed-log.json")
    try:
        history = json.load(open(log_file)) if os.path.exists(log_file) else []
    except Exception:
        history = []

    history.append({
        "date":    datetime.now().isoformat(),
        "results": results,
    })
    with open(log_file, "w") as f:
        json.dump(history[-52:], f, indent=2)  # guardar últimas 52 semanas
    print(f"\n📄 Log guardado en {log_file}")

    if any_alert:
        send_alert([r for r in results if r["alert"]])
    else:
        print("\n✅ Todo OK — ninguna página bajó del objetivo.")


if __name__ == "__main__":
    main()
