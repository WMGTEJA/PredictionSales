import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import firebirdsql

load_dotenv(Path(__file__).with_name('.env'))

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
    print(f'Connecting to {source_db} ({FIREBIRD_HOST}:{FIREBIRD_PORT} -> {db_path}) ...')
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
            print(f'  {source_db} {hdr_table}: {len(rows)} aggregated rows')
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
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, body
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'Supabase {method} {path} failed ({e.code}): {err_body}') from e


def main():
    if not FIREBIRD_USER or not FIREBIRD_PASSWORD:
        raise SystemExit('Missing FIREBIRD_USER or FIREBIRD_PASSWORD in firebird-sync/.env')
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise SystemExit('Missing SUPABASE_SERVICE_ROLE_KEY in firebird-sync/.env')

    databases = parse_databases(RAW_DATABASES)
    if not databases:
        raise SystemExit('No databases configured in FIREBIRD_DATABASES')

    synced_at = datetime.now(timezone.utc).isoformat()
    all_records: list[dict] = []
    for source_db, db_path in databases:
        all_records.extend(fetch_firebird_records(source_db, db_path, synced_at))

    print(f'\nTotal aggregated rows to sync (since {SYNC_FROM_DATE}): {len(all_records)}')

    for source_db, _ in databases:
        supabase_request('DELETE', f'sales_monthly_records?source_db=eq.{source_db}')

    batch_size = 500
    for i in range(0, len(all_records), batch_size):
        batch = all_records[i : i + batch_size]
        supabase_request(
            'POST',
            'sales_monthly_records',
            payload=batch,
            extra_headers={'Prefer': 'return=minimal'},
        )
        print(f'  Uploaded {min(i + batch_size, len(all_records))}/{len(all_records)}')

    print('Sync complete!')


if __name__ == '__main__':
    main()
