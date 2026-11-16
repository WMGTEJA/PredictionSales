import os
from pathlib import Path
from dotenv import load_dotenv
import firebirdsql

load_dotenv(Path(__file__).with_name('.env'))

for db_name, db_path in [
    ('ACC-0002', r'C:\eStream\SQLAccounting\DB\ACC-0002.FDB'),
    ('ACC-0006', r'C:\eStream\SQLAccounting\DB\ACC-0006.FDB'),
]:
    conn = firebirdsql.connect(
        host=os.getenv('FIREBIRD_HOST', '192.168.1.32'),
        port=int(os.getenv('FIREBIRD_PORT', '3050')),
        database=db_path,
        user=os.getenv('FIREBIRD_USER'),
        password=os.getenv('FIREBIRD_PASSWORD'),
    )
    cur = conn.cursor()
    print(f'\n=== {db_name} (Oct 2026) ===')
    for tbl, dtl in [('SL_SO', 'SL_SODTL'), ('SL_IV', 'SL_IVDTL')]:
        cur.execute(f"""
            SELECT COALESCE(h.CANCELLED, 'NULL'), COUNT(*), SUM(COALESCE(d.QTY, 0)), SUM(COALESCE(d.SQTY, 0))
            FROM {tbl} h
            JOIN {dtl} d ON d.DOCKEY = h.DOCKEY
            WHERE h.DOCDATE >= '2026-10-01' AND h.DOCDATE < '2026-11-01'
            GROUP BY 1
        """)
        print(f'  {tbl}:', cur.fetchall())
    conn.close()
