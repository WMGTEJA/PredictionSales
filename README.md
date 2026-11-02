# Sales Forecast & Prediction System

A web-based sales prediction and forecasting platform designed for West Malayan Group monthly sales delivery data.

## Features

- **Direct Google Sheet Sync:** Reads directly from the shared Google Sheet tab **`SO JAN-OCT`** (`Stock Group`, `Item Code`, `Item Desc`, `Month`, `Qty`) without requiring file uploads or database storage.
- **November 2026 Prediction:** Computes item-level demand predictions for November 2026 using 10 months of historical trend momentum and weighted averages (Jan–Oct 2026).
- **Zero Storage Bottlenecks:** No database / Supabase connection required. All historical aggregations and forecast modeling run instantly in-browser with offline caching.
- **Stock Group & Item Filtering:** Search and filter by Stock Group (`RS-FG`, `CS-FG`, `DUTCH-FG`, `SK-FG`, `MONT-FG`, `OEM-FG`, etc.), item descriptions, item codes, and trend states.
- **Pieces vs. Cartons View:** Automatically parses pack configurations (e.g., `200GX12` = 12 pcs/ctn, `150GX36` = 36 pcs/ctn) and toggles between pieces and carton counts.
- **Model Backtest Accuracy:** Verifies forecasting accuracy against actual October 2026 demand.
- **One-Click Excel Export:** Download complete prediction spreadsheets with item codes, descriptions, stock groups, monthly history, and expected November ranges.

---

## Quick Start (Local Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local server:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

---

## Google Sheet Data Source

The project connects to:
- **Sheet Link:** [Google Spreadsheet](https://docs.google.com/spreadsheets/d/1YELCEtZsFbwstQKGAjTELzwfr4VrPH16IiU4tw1nBEI/edit?gid=1334404777#gid=1334404777)
- **Tab Name:** `SO JAN-OCT`
- **Columns:** `Stock Group`, `Item Code`, `Item Desc`, `Month`, `Qty`
- **Forecast Output:** Projected demand for **November 2026**
