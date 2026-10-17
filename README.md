# BNP Paribas — Automated Term Sheet & Trade Booking Reconciliation Engine

An end-to-end, two-pass LLM fixed-income trade term sheet reconciliation solution built for Capital Markets Middle-Office Operations. It extracts **19 structured economic and legal attributes** from unstructured Trade Term Sheets (`.pdf`, `.docx`, `.txt`) via the **Google Gemini API**, enforces strict **Pydantic / JSON Schema type validation** (isolating `PARSING_ERROR` from mismatches), grounds every extracted field with **verbatim source quotes**, ingests multi-trade booking system extracts (`.csv`, `.json`, `.xml`), and executes a **second programmatic LLM pass** to classify discrepancies into **`MATCH`**, **`FALSE_ALERT` (with reason)**, **`TRUE_MISMATCH` (with reason)**, and **`PARSING_ERROR`**.

---

## Repository Structure

```text
├── reconcile_termsheet.py                      # Standalone Python CLI script (Pydantic + google-genai 2-Pass Pipeline)
├── requirements.txt                            # Python dependencies (google-genai, pydantic, pypdf, python-docx)
├── DOCUMENTATION.md                            # Concise 2-page technical report (Workflow, LLM Design, Challenges, DevOps)
├── sample_data/                                # Supplied sample Term Sheets & Booking System Extracts
│   ├── Genel_Energy_Finance_4_Term_Sheet.txt   # Sample 1: Genel Energy USD 300M 9.25% Senior Unsecured Bond Term Sheet
│   ├── Genel_Energy_bond_trades.csv            # Sample 1: Multi-trade Booking Extract (CSV)
│   ├── Genel_Energy_bond_trades.json           # Sample 1: Multi-trade Booking Extract (JSON)
│   ├── IDBI_Bank_Omni_AT1_Term_Sheet.txt       # Sample 2: IDBI Bank Rs.1,500 Cr 10.75% Perpetual AT1 Bond Term Sheet
│   ├── IDBI_Bank_bond_trades.csv               # Sample 2: Multi-trade Booking Extract (CSV)
│   └── IDBI_Bank_bond_trades.json              # Sample 2: Multi-trade Booking Extract (JSON)
├── server.ts                                   # Express API backend (/api/parse-document & /api/reconcile)
├── src/                                        # Full-Stack Interactive Web Workbench (React + TypeScript + Tailwind)
│   ├── App.tsx                                 # Main Reconciliation Workbench & Verbatim Evidence Viewer
│   ├── components/                             # Visual Analytics Dashboard (Donut, Stacked Bars, Hotspots, Heatmap)
│   ├── data/sampleScenarios.ts                 # Canonical 19-field schemas & baseline evaluation datasets
│   └── utils/                                  # Multi-format export engine (PDF, Excel .xlsx, CSV) & dynamic parser
└── README.md                                   # Setup, configuration, and end-to-end execution guide
```

---

## Option A: Running the Python CLI Script (`reconcile_termsheet.py`)

### 1. Environment Setup & Prerequisites
- **Python Version:** Python `3.10+` (`3.10`, `3.11`, or `3.12`)
- **Free-Tier LLM API Key:** Obtain a free Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
# Clone the repository
git clone https://github.com/<YOUR_USERNAME>/bnp-paribas-termsheet-reconciliation.git
cd bnp-paribas-termsheet-reconciliation

# Create and activate a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 2. API Key Configuration
Set the `GEMINI_API_KEY` environment variable in your terminal:

```bash
# macOS / Linux
export GEMINI_API_KEY="your_gemini_api_key_here"

# Windows (PowerShell)
$env:GEMINI_API_KEY="your_gemini_api_key_here"
```

### 3. End-to-End Execution on Supplied Sample Data

#### Run Default Workflow (Genel Energy Term Sheet vs. CSV Booking Extract)
```bash
python reconcile_termsheet.py
```

#### Run on Genel Energy (JSON Booking Extract)
```bash
python reconcile_termsheet.py \
  --termsheet "sample_data/Genel_Energy_Finance_4_Term_Sheet.txt" \
  --booking "sample_data/Genel_Energy_bond_trades.json" \
  --output "genel_reconciliation_report.json"
```

#### Run on IDBI Bank Omni AT1 Perpetual Bond (CSV or JSON Booking Extract)
```bash
python reconcile_termsheet.py \
  --termsheet "sample_data/IDBI_Bank_Omni_AT1_Term_Sheet.txt" \
  --booking "sample_data/IDBI_Bank_bond_trades.csv" \
  --output "idbi_reconciliation_report.json"
```

#### Run on Any Custom PDF / Word (`.docx`) Term Sheet & CSV / JSON Booking Extract
```bash
python reconcile_termsheet.py \
  --termsheet "/path/to/Term_Sheet.pdf" \
  --booking "/path/to/bond_trades.csv" \
  --output "custom_reconciliation_report.json"
```

---

## Option B: Running the Full-Stack Interactive Web Workbench

In addition to the Python CLI script, this repository includes a full-stack interactive web workbench with real-time visual analytics, verbatim evidence highlighting, and one-click PDF/Excel/CSV report exports.

### 1. Install Node.js Dependencies (`Node.js v18+ / v20+`)
```bash
npm install
```

### 2. Configure `.env`
Create a `.env` file in the root directory (see `.env.example`):
```env
GEMINI_API_KEY="your_gemini_api_key_here"
```

### 3. Start the Full-Stack Application
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Description of Expected Input & Output Formats

### Supported Input Files
1. **Term Sheet Document (`--termsheet` or Web Upload):**
   - **Formats:** `.pdf`, `.docx`, `.txt`
   - **Extracted Schema (19 Fields):** `ISIN`, `Issuer`, `Maturity`, `Notional`, `Coupon`, `Currency`, `SettlementDate`, `DayCountFraction`, `InterestPaymentDate`, `IssueDate`, `IssueAmount`, `IssuePrice`, `NominalAmountPerBond`, `InterestPaymentFrequency`, `BusinessDayConvention`, `BusinessDayLocation`, `AmortizationType`, `MinimumSubscription`, `Parent`.
2. **Booking System Extract (`--booking` or Web Upload):**
   - **Formats:** `.csv` (header row with `TradeID` + bond attribute columns), `.json` (`{"trades": [...]}` or array of trade objects), `.xml`.

### Output Format (`reconciliation_output.json`, `.pdf`, `.xlsx`, `.csv`)
Each field across every booked trade is categorized into one of four strict statuses:
- **`MATCH`**: Exact match between the Term Sheet and Booking Extract.
- **`FALSE_ALERT`**: Identical economic/legal meaning with a formatting, unit scaling, date notation, or phrasing difference (includes a detailed LLM explanation citing both conventions, e.g., `"9.25% p.a."` vs `"9.25"`, `"Rs.1,500 Crores"` vs `"15000000000"`, `"NO 0010894330"` vs `"NO0010894330"`).
- **`TRUE_MISMATCH`**: Genuine economic or operational booking error (e.g., wrong coupon `9.5` vs `9.25%`, wrong maturity date `10/15/2025` vs `14 October 2025`, wrong trade notional `3,100,000` vs `3,000,000`, or missing `ISIN` in draft term sheet).
- **`PARSING_ERROR`**: Strict schema type-validation failure (e.g., extracting string `"Perpetual"` where schema expects an ISO `DATE` on the `Maturity` field, or a non-numeric string where a `FLOAT` is expected).

---

## Technical Documentation Report
See **[DOCUMENTATION.md](./DOCUMENTATION.md)** for the concise 2-page technical report covering the two-pass workflow, LLM/API integration, Pydantic/JSON schema design, edge-case challenges & assumptions, and production DevOps deployment architecture.
