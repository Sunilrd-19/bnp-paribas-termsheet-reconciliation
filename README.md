# BNP Paribas — Automated Term Sheet & Trade Booking Reconciliation Engine (TermRecon AI)

An end-to-end, two-pass LLM fixed-income trade term sheet reconciliation solution built for **BNP Paribas Capital Markets Middle-Office Operations**. It extracts **19 canonical economic and legal attributes** (plus any dynamic custom booking columns) from unstructured Trade Term Sheets (`.pdf`, `.docx`, `.txt`) via the **Google Gemini API (`@google/genai` / `google-genai`)**, enforces a **Strict 20-Column Pydantic v2 / JSON Schema Validation Gate** (isolating `PARSING_ERROR` from economic mismatches), grounds every extracted attribute with **verbatim source quotes**, ingests multi-trade booking system extracts (`.csv`, `.json`, `.xml`), and executes a **Two-Pass Neuro-Symbolic Reconciliation Pipeline** to classify every attribute across every booked trade (`TradeID #1 … #N`) into **`MATCH`**, **`FALSE_ALERT` (with reason)**, **`TRUE_MISMATCH` (with reason)**, and **`PARSING_ERROR`**.

---

## Repository Structure

```text
├── reconcile_termsheet.py                                         # Standalone Python CLI script (Pydantic v2 + google-genai 2-Pass Pipeline)
├── requirements.txt                                               # Python dependencies (google-genai, pydantic, pypdf, python-docx)
├── DOCUMENTATION.md                                               # Concise 2-page technical report (Architecture, Schema, Case Studies, DevOps)
├── BNP_Paribas_Technical_Workflow_Presentation.pptx               # 12-Slide L2 Technical Architecture & Case Study PowerPoint Deck
├── BNP_Paribas_L2_Interview_Preparation_Guide.docx                # Comprehensive L2 Interview Master Guide & 25 Q&As (.docx)
├── BNP_Paribas_Architecture_Flowchart_and_API_Code_Guide.docx     # Visual System Flowcharts, REST API Contracts & Code Walkthrough (.docx)
├── sample_data/                                                   # Supplied sample Term Sheets (PDF/TXT) & Booking Extracts (CSV/JSON)
│   ├── 4.Term Sheet - Genel Energy.pdf                            # Sample 1 (PDF): Genel Energy USD 300M 9.25% Senior Unsecured Bond Term Sheet
│   ├── Genel_Energy.csv                                           # Sample 1 (CSV): 5-Trade Booking Extract (20 Columns)
│   ├── Genel_Energy.json                                          # Sample 1 (JSON): 5-Trade Booking Extract
│   ├── 3.Term Sheet - IDBI.pdf                                    # Sample 2 (PDF): IDBI Bank Rs.1,500 Cr 10.75% Perpetual AT1 Bond Term Sheet
│   ├── IDBI_Omni.csv                                              # Sample 2 (CSV): 5-Trade Booking Extract (20 Columns)
│   ├── IDBI_Omni.json                                             # Sample 2 (JSON): 5-Trade Booking Extract
│   ├── Genel_Energy_Finance_4_Term_Sheet.txt                      # Text mirror of Sample 1 Term Sheet
│   └── IDBI_Bank_Omni_AT1_Term_Sheet.txt                          # Text mirror of Sample 2 Term Sheet
├── api/
│   └── index.ts                                                   # Vercel Serverless Function entrypoint exporting Express app
├── vercel.json                                                    # Vercel production deployment & /api/* rewrite configuration
├── server.ts                                                      # Express API backend (/api/parse-document, /api/reconcile, /api/schema)
├── scripts/                                                       # Document & presentation generators (PPTX & DOCX)
│   ├── generate-pptx.ts                                           # Generates 12-slide PowerPoint presentation
│   ├── generate-interview-docx.ts                                 # Generates L2 Interview Master Guide (.docx)
│   └── generate-flowchart-api-docx.ts                             # Generates Architecture Flowchart & API Guide (.docx)
├── src/                                                           # Full-Stack Interactive Web Workbench (React 19 + TypeScript + Tailwind)
│   ├── App.tsx                                                    # Main Reconciliation Workbench, 20-Col Schema Modal & Evidence Inspector
│   ├── components/
│   │   └── ReconciliationAnalyticsDashboard.tsx                   # Visual Analytics Dashboard (Donut, Stacked Bars, Hotspots, Heatmap)
│   ├── data/
│   │   └── sampleScenarios.ts                                     # Strict 20-Column Schema Registry & baseline evaluation datasets
│   └── utils/
│       ├── reconcileEngine.ts                                     # Core deterministic normalizer, strict schema validator & 1-to-N comparator
│       └── exportRepoZip.ts                                       # Multi-format audit report exporter (PDF, Excel .xlsx, CSV)
└── README.md                                                      # Setup, configuration, architecture & end-to-end execution guide
```

---

## Core Architectural Highlights

### 1. Strict 20-Column Schema Validation (`TradeID` + 19 Bond Attributes)
Every reconciliation run enforces a strict schema across all 20 booking columns (plus dynamic custom columns if a user uploads a bespoke CSV/JSON):

| # | Booking Column | Canonical Key | Strict Schema Type | Validation & Normalization Rule |
| :- | :--- | :--- | :--- | :--- |
| 1 | `TradeID` | `trade_id` | `INTEGER` | Unique booked trade row identifier (`ge=1`) |
| 2 | `ISIN` | `isin` | `ISIN` | Strict 12-character ISO 6166 regex `^[A-Z]{2}[A-Z0-9]{9}[0-9]$` (strips internal spaces) |
| 3 | `Issuer` | `issuer` | `STRING` | Legal entity name of the bond issuer (clause-anchored extraction) |
| 4 | `Maturity` | `maturity` | `DATE` | Strict ISO 8601 calendar date `YYYY-MM-DD` (flags `"Perpetual"` as `PARSING_ERROR`) |
| 5 | `Notional` | `notional` | `FLOAT` | Individual trade allocation notional (`computeConsensusNotional()` modal check) |
| 6 | `Coupon` | `coupon` | `FLOAT` | Annual interest rate percentage as numeric float (`"9.25% p.a."` $\rightarrow$ `9.25`) |
| 7 | `Currency` | `currency` | `CURRENCY` | 3-letter ISO 4217 currency code (`USD`, `INR`, `EUR`, `GBP`; maps `"Rs."` $\rightarrow$ `INR`) |
| 8 | `SettlementDate` | `settlement_date` | `DATE` | ISO 8601 date `YYYY-MM-DD` (strips qualifiers like `"Expected to be 14 October 2020"`) |
| 9 | `DayCountFraction` | `day_count_fraction` | `STRING` | Accrual day-count basis (`30/360`, `Actual/Actual`, `ACT/365`) |
| 10 | `InterestPaymentDate` | `interest_payment_date` | `DATE` | First or recurring coupon payment date in ISO `YYYY-MM-DD` format |
| 11 | `IssueDate` | `issue_date` | `DATE` | Issue / Deemed Date of Allotment in ISO `YYYY-MM-DD` format |
| 12 | `IssueAmount` | `issue_amount` | `FLOAT` | Total issuance facility size (`"Rs.1,500 Crores"` $\rightarrow$ `15000000000`, `"USD 300M"` $\rightarrow$ `300000000`) |
| 13 | `IssuePrice` | `issue_price` | `FLOAT` | Issue price percentage of par (`"97% of the Nominal Amount"` $\rightarrow$ `97`, `"At Par"` $\rightarrow$ `100`) |
| 14 | `NominalAmountPerBond` | `nominal_amount_per_bond` | `FLOAT` | Face value per single bond (`"Rs.10,00,000/- (Rupees Ten Lakh)"` $\rightarrow$ `1000000`) |
| 15 | `InterestPaymentFrequency` | `interest_payment_frequency` | `STRING` | Coupon schedule (`Semi-Annual`, `Annual`, `Quarterly`) |
| 16 | `BusinessDayConvention` | `business_day_convention` | `STRING` | Business day adjustment rule (`Unadjusted`, `Following`, `Modified Following`) |
| 17 | `BusinessDayLocation` | `business_day_location` | `STRING` | Financial center holiday calendars (`"Oslo and New York"` $\rightarrow$ `"Oslo\|New York"`) |
| 18 | `AmortizationType` | `amortization_type` | `STRING` | Principal redemption structure (`"repaid in full at the Maturity Date"` $\rightarrow$ `"Bullet"`) |
| 19 | `MinimumSubscription` | `minimum_subscription` | `FLOAT` | Minimum application amount (`"5 Bonds"` $\times$ `Rs.10,00,000` $\rightarrow$ `5000000`) |
| 20 | `Parent` | `parent` | `STRING` | Parent company / ultimate guarantor entity (`Genel Energy plc`, `IDBI Bank Limited`) |

### 2. How the Engine Extracts Fields from Messy PDFs (Without `TradeID` or Matching Headers)
1. **1-to-N Master Contract vs. Trade Allocations:** A Term Sheet PDF defines the **Master Bond Issuance (1 document = 1 bond contract)** and never contains `TradeID 1, 2, 3…`. The engine extracts the 19 master bond attributes **once** in Pass 1 and broadcasts them against every `TradeID` row in the CSV/JSON/XML booking extract, while using `computeConsensusNotional()` to validate individual trade tranche sizes (`Notional`).
2. **3-Layer Semantic & Clause-Anchored Extraction:**
   - **Layer 1 (LLM Semantic Extraction at `temperature=0`):** Maps legal terminology (`"Deemed Date of Allotment"` $\rightarrow$ `IssueDate`, `"Face Value"` $\rightarrow$ `NominalAmountPerBond`, `"Tenor"` $\rightarrow$ `Maturity`) and extracts `{ rawValue, normalizedValue, verbatimQuote }`.
   - **Layer 2 (Clause-Numbered Line-Start Anchoring):** Deterministic regex anchors strictly to numbered table rows (`1. Issuer`, `7. Issue Size`, `10. Tenor`, `12. Coupon Rate`) so mid-sentence occurrences (such as `"The Issuer has a call on the outstanding Bonds"` inside Clause 26) never overwrite `1. Issuer: IDBI Bank Limited`.
   - **Layer 3 (Cross-Clause Financial Synthesis):** Automatically resolves composite expressions like `"5 Bonds and in multiples of 1 Bond thereafter"` by multiplying `5 × NominalAmountPerBond (1,000,000) = 5,000,000`.

### 3. Multi-Model Gemini Resilience Pool
Both the Node.js backend (`server.ts`) and Python CLI (`reconcile_termsheet.py`) automatically rotate across production Gemini models on HTTP 429/503/404:
- `gemini-3-flash-preview` $\rightarrow$ `gemini-2.5-flash` $\rightarrow$ `gemini-3.1-pro-preview` $\rightarrow$ `gemini-2.5-pro` $\rightarrow$ `gemini-2.5-flash-lite` $\rightarrow$ Deterministic Clause-Anchored Fallback Engine.

---

## Option A: Running the Python CLI Script (`reconcile_termsheet.py`)

### 1. Environment Setup
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your Gemini API Key (or place GEMINI_API_KEY="..." in .env)
export GEMINI_API_KEY="your_gemini_api_key_here"
```

### 2. Execute on Supplied Sample Datasets
```bash
# Run on Genel Energy PDF Term Sheet vs. 5-Trade CSV Booking Extract
python reconcile_termsheet.py \
  --termsheet "sample_data/4.Term Sheet - Genel Energy.pdf" \
  --booking "sample_data/Genel_Energy.csv" \
  --output "genel_reconciliation_report.json"

# Run on IDBI Bank Omni AT1 PDF Term Sheet vs. 5-Trade CSV Booking Extract
python reconcile_termsheet.py \
  --termsheet "sample_data/3.Term Sheet - IDBI.pdf" \
  --booking "sample_data/IDBI_Omni.csv" \
  --output "idbi_reconciliation_report.json"
```

---

## Option B: Running the Full-Stack Interactive Web Workbench & Deploying to Vercel

### 1. Local Development
```bash
npm install
# Add GEMINI_API_KEY="your_key" to .env
npm run dev
```
Open `http://localhost:3000` in your browser.

### 2. Deploying to Vercel (Production)
The repository is pre-configured for zero-config Vercel deployment via `vercel.json` and `api/index.ts`:
1. Push repository to GitHub and import into **Vercel**.
2. In **Vercel Project Settings $\rightarrow$ Environment Variables**, add `GEMINI_API_KEY`.
3. Click **Deploy** — Vercel builds the Vite frontend into `dist/` and mounts `server.ts` via `api/index.ts` for `/api/parse-document`, `/api/reconcile`, and `/api/schema`.

---

## Regenerating Presentation & Technical Word Guides
```bash
npx tsx scripts/generate-pptx.ts                 # Rebuilds BNP_Paribas_Technical_Workflow_Presentation.pptx
npx tsx scripts/generate-interview-docx.ts       # Rebuilds BNP_Paribas_L2_Interview_Preparation_Guide.docx
npx tsx scripts/generate-flowchart-api-docx.ts   # Rebuilds BNP_Paribas_Architecture_Flowchart_and_API_Code_Guide.docx
```
