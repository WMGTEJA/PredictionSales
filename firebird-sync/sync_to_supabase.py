import json
import logging
from logging.handlers import RotatingFileHandler
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import firebirdsql

BASE_DIR = Path(sys.executable).resolve().parent if getattr(sys, 'frozen', False) else Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')

LOG_PATH = BASE_DIR / 'sync.log'
logger = logging.getLogger('prediction_sales_sync')
logger.setLevel(logging.INFO)
_fmt = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
_file_handler = RotatingFileHandler(LOG_PATH, maxBytes=512 * 1024, backupCount=2, encoding='utf-8')
_file_handler.setFormatter(_fmt)
_stream_handler = logging.StreamHandler(sys.stdout)
_stream_handler.setFormatter(_fmt)
logger.addHandler(_file_handler)
logger.addHandler(_stream_handler)

FIREBIRD_HOST = os.getenv('FIREBIRD_HOST', '192.168.1.32')
FIREBIRD_PORT = int(os.getenv('FIREBIRD_PORT', '3050'))
FIREBIRD_USER = os.getenv('FIREBIRD_USER', '')
FIREBIRD_PASSWORD = os.getenv('FIREBIRD_PASSWORD', '')
SYNC_FROM_DATE = os.getenv('SYNC_FROM_DATE', '2024-01-01')

RAW_DATABASES = os.getenv(
    'FIREBIRD_DATABASES',
    r'ACC-0002=C:\eStream\SQLAccounting\DB\ACC-0002.FDB,ACC-0006=C:\eStream\SQLAccounting\DB\ACC-0006.FDB',
)

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://nqxkywfmkakdkhdwivck.supabase.co').rstrip('/')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

DOC_TABLES = [
    ('SO', 'SL_SO', 'SL_SODTL'),
    ('IV', 'SL_IV', 'SL_IVDTL'),
    ('DO', 'SL_DO', 'SL_DODTL'),
    ('CS', 'SL_CS', 'SL_CSDTL'),
    ('CN', 'SL_CN', 'SL_CNDTL'),
    ('DN', 'SL_DN', 'SL_DNDTL'),
]

ON_CONFLICT_COLS = 'source_db,doc_type,period,item_code,company_code,company_name'


def build_query(hdr_table: str, dtl_table: str) -> str:
    return f"""
SELECT
  EXTRACT(YEAR FROM h.DOCDATE) AS DOC_YEAR,
  EXTRACT(MONTH FROM h.DOCDATE) AS DOC_MONTH,
  TRIM(d.ITEMCODE) AS ITEM_CODE,
  COALESCE(NULLIF(TRIM(MAX(d.DESCRIPTION)), ''), NULLIF(TRIM(MAX(i.DESCRIPTION)), ''), '') AS ITEM_DESC,
  COALESCE(TRIM(MAX(i.STOCKGROUP)), '') AS STOCK_GROUP,
  COALESCE(TRIM(h.CODE), '') AS COMPANY_CODE,
  COALESCE(TRIM(h.COMPANYNAME), '') AS COMPANY_NAME,
  SUM(COALESCE(d.SQTY, 0)) AS TOTAL_SQTY,
  SUM(COALESCE(d.QTY, 0)) AS TOTAL_QTY,
  SUM(COALESCE(d.LOCALAMOUNT, 0)) AS TOTAL_AMOUNT
FROM {hdr_table} h
JOIN {dtl_table} d ON d.DOCKEY = h.DOCKEY
LEFT JOIN ST_ITEM i ON i.CODE = d.ITEMCODE
WHERE COALESCE(h.CANCELLED, 'FALSE') <> 'TRUE'
  AND h.DOCDATE >= '{SYNC_FROM_DATE}'
  AND d.ITEMCODE IS NOT NULL
  AND TRIM(d.ITEMCODE) <> ''
GROUP BY 1, 2, 3, 6, 7
"""


def parse_databases(raw: str) -> list[tuple[str, str]]:
    dbs = []
    for part in raw.split(','):
        part = part.strip()
        if not part or '=' not in part:
            continue
        name, path = part.split('=', 1)
        dbs.append((name.strip(), path.strip()))
    return dbs


def fetch_firebird_records(source_db: str, db_path: str, synced_at: str) -> list[dict]:
    logger.info('Connecting to %s (%s:%s -> %s) ...', source_db, FIREBIRD_HOST, FIREBIRD_PORT, db_path)
    conn = firebirdsql.connect(
        host=FIREBIRD_HOST,
        port=FIREBIRD_PORT,
        database=db_path,
        user=FIREBIRD_USER,
        password=FIREBIRD_PASSWORD,
    )
    records = []
    try:
        cur = conn.cursor()
        for doc_type, hdr_table, dtl_table in DOC_TABLES:
            cur.execute(build_query(hdr_table, dtl_table))
            rows = cur.fetchall()
            logger.info('  %s %s: %d aggregated rows', source_db, hdr_table, len(rows))
            for yr, mo, item_code, item_desc, stock_group, comp_code, comp_name, sqty, qty, amt in rows:
                period = f'{int(yr):04d}-{int(mo):02d}'
                records.append({
                    'source_db': source_db,
                    'doc_type': doc_type,
                    'period': period,
                    'item_code': item_code,
                    'item_desc': item_desc or '',
                    'stock_group': stock_group or '',
                    'company_code': comp_code or '',
                    'company_name': comp_name or '',
                    'qty': float(sqty or 0),
                    'doc_qty': float(qty or 0),
                    'amount': round(float(amt or 0), 2),
                    'synced_at': synced_at,
                })
    finally:
        conn.close()
    return records


def supabase_request(method: str, path: str, payload=None, extra_headers=None):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
    }
    if extra_headers:
        headers.update(extra_headers)
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, body
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'Supabase {method} {path} failed ({e.code}): {err_body}') from e


def main():
    logger.info('=== Starting SQL Accounting -> Supabase sync ===')
    if not FIREBIRD_USER or not FIREBIRD_PASSWORD:
        logger.error('Missing FIREBIRD_USER or FIREBIRD_PASSWORD in %s', BASE_DIR / '.env')
        raise SystemExit(1)
    if not SUPABASE_SERVICE_ROLE_KEY:
        logger.error('Missing SUPABASE_SERVICE_ROLE_KEY in %s', BASE_DIR / '.env')
        raise SystemExit(1)

    databases = parse_databases(RAW_DATABASES)
    if not databases:
        logger.error('No databases configured in FIREBIRD_DATABASES')
        raise SystemExit(1)

    synced_at = datetime.now(timezone.utc).isoformat()
    all_records: list[dict] = []
    synced_dbs: list[str] = []

    for source_db, db_path in databases:
        try:
            db_records = fetch_firebird_records(source_db, db_path, synced_at)
            all_records.extend(db_records)
            synced_dbs.append(source_db)
        except Exception as exc:
            logger.error('Failed reading Firebird %s: %s', source_db, exc)
            raise SystemExit(1)

    logger.info('Total aggregated rows to upsert (since %s): %d', SYNC_FROM_DATE, len(all_records))

    # 1. Zero-downtime upsert in batches (never leaves the table empty)
    batch_size = 500
    upsert_path = f'sales_monthly_records?on_conflict={ON_CONFLICT_COLS}'
    for i in range(0, len(all_records), batch_size):
        batch = all_records[i : i + batch_size]
        supabase_request(
            'POST',
            upsert_path,
            payload=batch,
            extra_headers={'Prefer': 'resolution=merge-duplicates,return=minimal'},
        )
        logger.info('  Upserted %d/%d', min(i + batch_size, len(all_records)), len(all_records))

    # 2. Clean up stale rows (e.g., cancelled/removed docs) older than this sync timestamp
    encoded_ts = urllib.parse.quote(synced_at, safe='')
    for source_db in synced_dbs:
        encoded_db = urllib.parse.quote(source_db, safe='')
        supabase_request(
            'DELETE',
            f'sales_monthly_records?source_db=eq.{encoded_db}&synced_at=lt.{encoded_ts}',
            extra_headers={'Prefer': 'return=minimal'},
        )

    logger.info('=== Sync complete! ===')


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        logger.exception('Unexpected sync error: %s', e)
        raise SystemExit(1)
