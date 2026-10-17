# BNP Paribas — LLM-Powered Term Sheet Reconciliation Workbench

An automated, two-pass LLM trade term sheet reconciliation platform built for Capital Markets Middle-Office Operations. It extracts 19 structured economic and legal attributes from unstructured Trade Term Sheets (`.pdf`, `.docx`, `.txt`), enforces strict schema type validation, reconciles multi-trade booking system extracts (`.csv`, `.json`, `.xml`), suppresses formatting/notation **False Alerts** with explicit explanations, isolates **True Economic Mismatches**, and exports audit-ready reports in **PDF (`.pdf`)**, **Excel (`.xlsx`)**, and **CSV (`.csv`)**.

---

## Live Deployment & Architecture

### Key Capabilities
1. **Multi-Format Ingestion (`/api/parse-document`)**:
   - **Unstructured Term Sheets**: Extracts text and tables from PDF (`.pdf`), Word (`.docx`), and Text (`.txt`) documents.
   - **Structured Booking Extracts**: Parses multi-trade CSV (`TradeID, ISIN, Issuer...`), nested JSON (`{"trades": [...]}`), and XML files.
2. **Pass 1 — Programmatic LLM Extraction & Strict Schema Validation**:
   - Extracts all 19 canonical trade attributes (`ISIN`, `Issuer`, `Maturity`, `Notional`, `Coupon`, `Currency`, `SettlementDate`, `DayCountFraction`, `InterestPaymentDate`, `IssueDate`, `IssueAmount`, `IssuePrice`, `NominalAmountPerBond`, `InterestPaymentFrequency`, `BusinessDayConvention`, `BusinessDayLocation`, `AmortizationType`, `MinimumSubscription`, `Parent`) alongside **verbatim quotes** from the source Term Sheet.
   - Enforces strict type rules (`ISIN` ISO 6166, `CURRENCY` ISO 4217, `FLOAT`, `DATE` ISO 8601, `STRING`) to separate **Parsing Errors** (e.g., `Maturity = "Perpetual"` on an AT1 Perpetual Bond) from booking mismatches.
3. **Pass 2 — Semantic False Alert Suppression & Executive AI Insights (`/api/reconcile`)**:
   - Distinguishes harmless formatting/notation differences (**False Alerts**, such as `NO 0010894330` vs `NO0010894330`, `Rs.1,500 Crores` vs `15000000000`, `5 Bonds` × `Rs.10,00,000` = `5000000`, `14 October 2025` vs `10/14/2025`, or `"repaid in full at Maturity Date"` vs `"Bullet"`) from genuine booking errors (**True Mismatches**).
4. **Interactive Visual Analytics Dashboard & Multi-Format Export**:
   - Interactive Donut Breakdown, Trade-by-Trade Stacked Comparison Bars, Attribute Discrepancy Hotspots, and Trade × Field Heatmap Matrix.
   - One-click export to **AI Insights Report (`.pdf`)**, **Excel Multi-Sheet Workbook (`.xlsx`)**, and **CSV Reconciliation Table (`.csv`)**.

---

## Local Setup & Execution

### Prerequisites
- **Node.js** v20+
- **Gemini API Key** (`GEMINI_API_KEY`)

### 1. Clone & Install Dependencies
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd <YOUR_REPO_FOLDER>
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
```

### 3. Run the Application
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.
