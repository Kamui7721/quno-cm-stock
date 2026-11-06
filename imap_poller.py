#!/usr/bin/env python3
"""
QUNO x Club Michel — IMAP Poller
Checks quno@clubmichel.de for new emails with PDF attachments,
extracts invoice data via Claude API, saves to Supabase.
"""

import imaplib
import email
import base64
import json
import time
import os
import logging
import urllib.request
import urllib.error
from datetime import datetime

# ── CONFIG ──────────────────────────────────────────────
IMAP_HOST     = "imap.strato.de"
IMAP_PORT     = 993
IMAP_USER     = "quno@clubmichel.de"
IMAP_PASS     = "kamui60329"

SB_URL        = "https://pduuimgbehsgfzrqwddb.supabase.co"
SB_KEY        = "sb_publishable_lT_3rpV_8HkyqA_gf0KHww_Q_GWHmpI"

CLAUDE_KEY    = "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"
CLAUDE_MODEL  = "claude-opus-4-5"

POLL_INTERVAL = 120  # seconds between checks
PROCESSED_FILE = "/opt/quno/processed_ids.json"
LOG_FILE       = "/opt/quno/poller.log"
# ────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)


def load_processed():
    if os.path.exists(PROCESSED_FILE):
        with open(PROCESSED_FILE) as f:
            return set(json.load(f))
    return set()


def save_processed(ids):
    with open(PROCESSED_FILE, "w") as f:
        json.dump(list(ids), f)


def sb_request(method, path, data=None):
    url = f"{SB_URL}/rest/v1/{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("apikey", SB_KEY)
    req.add_header("Authorization", f"Bearer {SB_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=representation")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        log.error(f"Supabase {method} {path} → {e.code}: {body}")
        return None


def claude_extract(pdf_b64, mime_type="application/pdf"):
    prompt = """Du bist ein Rechnungsparser. Analysiere diese Rechnung und extrahiere alle Daten.

Antworte NUR mit einem validen JSON-Objekt, kein Text davor oder danach:
{
  "lieferant": {
    "name": "Firmenname",
    "strasse": "Straße Hausnr",
    "ort": "PLZ Ort",
    "telefon": "Telefonnummer oder null",
    "email": "Email oder null",
    "steuer_nr": "USt-ID oder null"
  },
  "rechnung": {
    "rechnungsnummer": "Nummer",
    "rechnungsdatum": "YYYY-MM-DD",
    "faelligkeitsdatum": "YYYY-MM-DD oder null",
    "nettobetrag": 0.00,
    "steuerbetrag": 0.00,
    "gesamtbetrag": 0.00,
    "waehrung": "EUR",
    "zahlungsziel_tage": null
  },
  "positionen": [
    {
      "produkt_name": "Name",
      "kategorie": "Kategorie",
      "menge": 1,
      "einheit": "Stk",
      "einzelpreis": 0.00,
      "gesamtpreis": 0.00
    }
  ]
}"""

    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 8192,
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": mime_type,
                        "data": pdf_b64
                    }
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }]
    }

    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        method="POST"
    )
    req.add_header("x-api-key", CLAUDE_KEY)
    req.add_header("anthropic-version", "2023-06-01")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode())
            text = result["content"][0]["text"]
            # Extract JSON from response
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
    except Exception as e:
        log.error(f"Claude API error: {e}")
    return None


def save_to_supabase(data, pdf_b64=None):
    if not data:
        return False

    lief_data = data.get("lieferant", {})
    rech_data = data.get("rechnung", {})
    positionen = data.get("positionen", [])

    lief_name = lief_data.get("name", "").strip()
    if not lief_name:
        log.warning("No supplier name found, skipping")
        return False

    # Find or create Lieferant
    existing = sb_request("GET", f"lieferanten?name=ilike.{urllib.parse.quote(lief_name)}&limit=1")
    if existing:
        lieferant_id = existing[0]["id"]
        log.info(f"Lieferant exists: {lief_name}")
    else:
        new_lief = sb_request("POST", "lieferanten", {
            "name": lief_name,
            "adresse": f"{lief_data.get('strasse','')} {lief_data.get('ort','')}".strip(),
            "email": lief_data.get("email"),
            "telefon": lief_data.get("telefon"),
            "steuer_nr": lief_data.get("steuer_nr")
        })
        lieferant_id = new_lief[0]["id"] if new_lief else None
        log.info(f"Neuer Lieferant angelegt: {lief_name}")

    # Save Rechnung
    rechnung = sb_request("POST", "rechnungen", {
        "rechnungsnummer": rech_data.get("rechnungsnummer"),
        "lieferant_id": lieferant_id,
        "lieferant_name": lief_name,
        "rechnungsdatum": rech_data.get("rechnungsdatum"),
        "faelligkeitsdatum": rech_data.get("faelligkeitsdatum"),
        "nettobetrag": rech_data.get("nettobetrag", 0),
        "steuerbetrag": rech_data.get("steuerbetrag", 0),
        "gesamtbetrag": rech_data.get("gesamtbetrag", 0),
        "waehrung": rech_data.get("waehrung", "EUR"),
        "zahlungsziel_tage": rech_data.get("zahlungsziel_tage"),
        "status": "offen",
        "quelle": "email"
    })

    if not rechnung:
        log.error("Failed to save Rechnung")
        return False

    rechnung_id = rechnung[0]["id"]
    log.info(f"Rechnung gespeichert: {rech_data.get('rechnungsnummer')} (ID: {rechnung_id})")

    # Save Positionen + auto-create Produkte
    for pos in positionen:
        prod_name = pos.get("produkt_name", "").strip()
        if not prod_name:
            continue

        # Find or create Produkt
        existing_prod = sb_request("GET", f"produkte?name=ilike.{urllib.parse.quote(prod_name)}&limit=1")
        if existing_prod:
            produkt_id = existing_prod[0]["id"]
        else:
            new_prod = sb_request("POST", "produkte", {
                "name": prod_name,
                "kategorie": pos.get("kategorie", "Sonstige"),
                "einheit": pos.get("einheit", "Stk"),
                "preis_pro_einheit": pos.get("einzelpreis", 0)
            })
            produkt_id = new_prod[0]["id"] if new_prod else None
            log.info(f"Neues Produkt angelegt: {prod_name}")

        sb_request("POST", "rechnungspositionen", {
            "rechnung_id": rechnung_id,
            "produkt_id": produkt_id,
            "produkt_name": prod_name,
            "kategorie": pos.get("kategorie", "Sonstige"),
            "menge": pos.get("menge", 0),
            "einheit": pos.get("einheit", "Stk"),
            "einzelpreis": pos.get("einzelpreis", 0),
            "gesamtpreis": pos.get("gesamtpreis", 0)
        })

    log.info(f"✓ {len(positionen)} Positionen gespeichert")
    return True


def check_mail(processed_ids):
    log.info("Checking mailbox...")
    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(IMAP_USER, IMAP_PASS)
        mail.select("INBOX")

        _, msg_ids = mail.search(None, "UNSEEN")
        ids = msg_ids[0].split()
        log.info(f"Found {len(ids)} unread emails")

        for mid in ids:
            mid_str = mid.decode()
            if mid_str in processed_ids:
                continue

            _, msg_data = mail.fetch(mid, "(RFC822)")
            msg = email.message_from_bytes(msg_data[0][1])

            subject = msg.get("Subject", "")
            sender = msg.get("From", "")
            msg_id = msg.get("Message-ID", mid_str)

            if msg_id in processed_ids:
                continue

            log.info(f"Processing: {subject} from {sender}")

            # Find PDF attachments
            for part in msg.walk():
                ct = part.get_content_type()
                cd = str(part.get("Content-Disposition", ""))

                if ct == "application/pdf" or (ct == "application/octet-stream" and ".pdf" in cd.lower()):
                    pdf_bytes = part.get_payload(decode=True)
                    if not pdf_bytes:
                        continue

                    pdf_b64 = base64.b64encode(pdf_bytes).decode()
                    log.info(f"PDF found ({len(pdf_bytes)} bytes), sending to Claude...")

                    data = claude_extract(pdf_b64)
                    if data:
                        success = save_to_supabase(data, pdf_b64)
                        if success:
                            log.info("✓ Invoice processed successfully")
                        else:
                            log.error("Failed to save to Supabase")
                    else:
                        log.error("Claude extraction failed")

            processed_ids.add(msg_id)
            save_processed(processed_ids)

        mail.logout()

    except Exception as e:
        log.error(f"IMAP error: {e}")


def main():
    import urllib.parse  # ensure available
    log.info("QUNO IMAP Poller starting...")
    log.info(f"Monitoring: {IMAP_USER}")
    log.info(f"Supabase: {SB_URL}")
    log.info(f"Poll interval: {POLL_INTERVAL}s")

    processed_ids = load_processed()

    while True:
        try:
            check_mail(processed_ids)
        except Exception as e:
            log.error(f"Unexpected error: {e}")
        log.info(f"Sleeping {POLL_INTERVAL}s...")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
