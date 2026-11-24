PredictionSales — Automatic SQL Accounting -> Supabase Sync
============================================================

No Python or extra software is needed on the server (DESKTOP-OAGE5OA).

SETUP (3 Steps):
1. Copy this entire folder to the server, e.g.:
      C:\PredictionSalesSync\

2. Check the `.env` file inside the folder:
   - On DESKTOP-OAGE5OA itself, `FIREBIRD_HOST=localhost` (or `127.0.0.1` or `192.168.1.32`) works.
   - Make sure `FIREBIRD_USER`, `FIREBIRD_PASSWORD`, `FIREBIRD_DATABASES`,
     `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are filled in.

3. Right-click `install_auto_sync.bat` -> "Run as administrator".
   - This creates a silent Windows Scheduled Task (`PredictionSalesAutoSync`)
     that runs every 15 minutes automatically (even when nobody is logged in).
   - It immediately runs a test sync and logs results to `sync.log`.

NOTES:
- 100% read-only on SQL Accounting (.FDB databases are never modified).
- Uses safe zero-downtime upsert to Supabase so the website is never empty mid-sync.
- To check sync history or troubleshoot, open `sync.log` in this folder.
- To remove the scheduled task cleanly, right-click `uninstall_auto_sync.bat` -> "Run as administrator".
