# Capital Markets Term Sheet Reconciliation Workbench & Python Package

An enterprise-grade, automated LLM-powered trade reconciliation platform and reproducible Python GitHub repository package designed for Capital Markets operations. It extracts structured data and verbatim source quotes from unstructured PDF and Word term sheets, validates them against strict schemas, ingests CSV/JSON/XML booking records, and performs a two-pass LLM semantic reconciliation to separate true economic mismatches from formatting false alerts.

### User Review & Critical Decisions

> [!IMPORTANT]
> The solution is engineered to satisfy **100% of the BNP Paribas 20-point evaluation rubric**, providing both a live interactive Web Workbench deployed here in AI Studio and a complete, ready-to-clone Python GitHub repository bundle (`zip` download + copyable source files, sample data, tests, `README.md`, and the 2-page technical report).

- **Confirmed Decision 1 (Deliverable Structure)**: Dual-mode delivery — an interactive full-stack Capital Markets Reconciliation Workbench running live on port 3000, paired with a self-contained **Python GitHub Repository Exporter** containing modular Python 3.11+ scripts (`google-genai`, `pydantic`, `pypdf`, `python-docx`), sample PDF/Word/CSV/JSON files, `README.md`, and the 2-page architecture & DevOps report.
- **Confirmed Decision 2 (Sample & Custom Data Handling)**: Pre-loaded with realistic Capital Markets multi-trade datasets (Fixed Rate Notes, Autocallable Equity Linked Notes, Floating Rate Notes, Callable Corporate Bonds, and an intentional malformed/corrupted term sheet to demonstrate `Parsing Error` vs `Mismatch` handling) + instant drag-and-drop upload for your local `C:\Users\Sunil\Downloads\Assignment` files (`.pdf`, `.docx`, `.csv`, `.json`, `.xml`, `.txt`).
- **Confirmed Decision 3 (Comprehensive Field Coverage)**: Full extraction and schema validation across all core and extended Capital Markets fields (`ISIN`, `Issuer`, `Trade Date`, `Settlement Date`, `Maturity Date`, `Currency`, `Notional Amount`, `Issue Price`, `Coupon Rate`, `Coupon Type`, `Day Count Fraction`, `Payment Frequency`, `Business Day Convention`, `Governing Law`, `Calculation Agent`, plus dynamic auto-detection of any additional fields present in uploaded booking files).

---

### 1. Overview & Core Concept

- **What It Does**: Automates the end-to-end post-trade reconciliation workflow between legal/desk trade term sheets (PDF/DOCX) and structured Middle-Office booking system extracts (CSV/JSON/XML).
- **Target Audience / Persona**: Capital Markets Middle-Office Operations Analysts, Quantitative Developers, and Applied AI Evaluators reviewing the candidate submission.
- **Key Value**: Eliminates manual "four-eyes" document checking and reduces alert fatigue by combining deterministic schema validation (catching `Parsing Error` anomalies early) with a Two-Pass LLM Semantic Verifier that distinguishes harmless representation differences (`"10.75%"` vs `"0.1075"`, `"EUR 10M"` vs `"10,000,000"`, `"15-May-2029"` vs `"2029-05-15"`) from material economic discrepancies (`True Mismatch`).

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Dataset Selection & Custom File Upload**: Users can immediately run reconciliation on pre-loaded Capital Markets test suites or drag-and-drop their own PDF/DOCX term sheets and CSV/JSON/XML booking extracts from `C:\Users\Sunil\Downloads\Assignment`.
  2. **Pass 1 — Automated Extraction & Strict Schema Validation**: Displays real-time progress as the backend parses binary PDF/Word documents, calls Gemini (`gemini-3.8-flash`) with a strict structured schema, extracts each field alongside its **exact verbatim quote/snippet** from the term sheet, and runs type/format validation (flagging type failures as `Parsing Error`).
  3. **Pass 2 — Intelligent Reconciliation & False Alert Analysis**: Compares extracted fields against the ingested booking record. Any non-identical field triggers a second programmatic LLM pass analyzing the source quote, extracted value, and booking value to classify the field as `Match`, `False Alert (with reason)`, `True Mismatch`, or `Parsing Error`.
  4. **Side-by-Side Evidence Inspector & Export**: Clicking any row in the reconciliation grid highlights the exact verbatim quote in the source term sheet alongside the booking system record, LLM reasoning, and confidence rationale. Users can export results as CSV, JSON, or Markdown report.
  5. **GitHub Submission Center & 2-Page Report**: Dedicated views allowing the user to inspect, copy, or one-click download the complete **Python GitHub Repository (.zip)** (including `src/`, `sample_data/`, `tests/`, `README.md`, `REPORT.md`, `requirements.txt`, `Dockerfile`, and `.github/workflows/ci.yml`) ready to push directly to GitHub.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Institutional Capital Markets Desk Workspace — high-density, crisp, authoritative, and built for scannability and auditability.
  - *Color Palette & Mood*:
    - **Dominant Canvas (60%)**: Crisp Alabaster/White (`#F8FAFC` / `#FFFFFF`) with deep slate ink (`#0F172A`) for effortless daytime readability.
    - **Structural Surfaces (30%)**: Cool slate hairlines (`#E2E8F0`), subtle table header fills (`#F1F5F9`), and muted secondary prose (`#475569`).
    - **Semantic & Accent Budget (10%)**: Institutional Emerald (`#007A53`) for primary actions and verified `Match` states; Amber (`#D97706`) with explicit icon + text label for `False Alert`; Crimson (`#DC2626`) with explicit icon + text label for `True Mismatch`; Indigo/Violet (`#4F46E5`) for `Parsing Error`.
  - *Typography & Hierarchy*:
    - **Display / Navigation**: `Plus Jakarta Sans` (SemiBold/Bold, tight tracking) for institutional clarity.
    - **Body Prose & Reasoning**: `Public Sans` (Regular/Medium) for dense analytical explanations and documentation.
    - **Financial Figures, ISINs, Dates & Code**: `IBM Plex Mono` with `font-variant-numeric: tabular-nums` so all notional amounts, coupons, and dates align vertically down to the decimal.
  - *Component Styling & Layout*: Full 1440px desktop presence featuring a clean 3-zone top bar (`Brand Wordmark` — `Reconciliation Desk · Schema & Evidence · Technical Report · GitHub Package` — `Export Submission ZIP`), single-elevation bordered panels (`1px solid #E2E8F0`), and compact 40px high-density table rows. Zero decorative pills on static metadata; interactive filter tabs use clean segmented button states.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Two-Pass Programmatic LLM Architecture with Strict Schema Validation**
  - *Chosen Approach*: Pass 1 extracts structured fields as raw strings + typed values + verbatim quotes, followed by deterministic schema validation (Zod on the Node server / Pydantic v2 in the Python package). Fields that fail type conversion (e.g., `"TBD"` or `"Six Percent"` where a numeric float is required, or an invalid 12-character ISIN checksum/format) are flagged immediately as `Parsing Error` rather than `Mismatch`. Pass 2 batches all candidate mismatches into a dedicated semantic analysis call to classify `False Alert` vs `True Mismatch` with a concrete financial explanation.
  - *Why*: Directly fulfills Task 1 ("any field that fails type-validation should be flagged as a Parsing Error rather than a Mismatch") and Task 3 ("implement a second programmatic LLM pass... to determine if it is a True Mismatch or a False Alert").
  - *Alternatives Considered*: Single-pass prompt doing extraction and comparison at once — rejected because the assignment brief explicitly requires a two-pass architecture and strict intermediate schema validation.

- **Decision 2: True Binary PDF/DOCX/CSV/JSON/XML Ingestion + Complete Python Repository Generator**
  - *Chosen Approach*: The Node/Express backend natively parses uploaded `.pdf`, `.docx`, `.csv`, `.json`, and `.xml` files and executes the two-pass `@google/genai` (`gemini-3.8-flash`) workflow. Simultaneously, the application bundles a complete, PEP-8 modular Python codebase (`reconcile.py`, `src/parser.py`, `src/extractor.py`, `src/booking_loader.py`, `src/reconciler.py`, `src/schemas.py`, `generate_samples.py`, `tests/test_reconciliation.py`) that can be downloaded as a ready-to-push GitHub ZIP archive.
  - *Why*: Gives you an instant, interactive web app to test your local assignment files and share as a live deployment URL, while also giving you the exact Python repository structure required by the BNP Paribas evaluation rubric.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     TOP NAVIGATION BAR (3-Zone Contract)                     │
│  [TermRecon AI]   [Reconciliation Desk · Evidence · Report · GitHub Repo]    │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌──────────────────────┐
│  RECONCILIATION DESK  │   │  2-PAGE TECH REPORT   │   │ GITHUB REPO PACKAGE  │
│  • File Upload Drop   │   │  • Architecture Flow  │   │ • Python Source Code │
│  • Preloaded Suites   │   │  • Schema & Prompts   │   │ • Sample PDF/DOCX    │
│  • Summary KPI Strip  │   │  • Challenges & Edge  │   │ • README.md & Tests  │
│  • Filterable Grid    │   │  • DevOps & CI/CD     │   │ • One-Click .ZIP     │
│  • Evidence Drawer    │   │    Productionization  │   │   Download           │
└───────────┬───────────┘   └───────────────────────┘   └──────────────────────┘
            │
            ▼  POST /api/reconcile (Multipart or JSON)
┌──────────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS SERVER & RECONCILIATION ENGINE                │
│                                                                              │
│  1. Document Parser        2. Pass 1: Gemini 3.8 Flash   3. Schema Validator │
│     (PDF / DOCX / TXT) ──►    Structured Extraction  ──►    (Strict Type &   │
│                               + Verbatim Quotes             ISIN/Float Check)│
│                                                                    │         │
│  4. Booking Ingestor       5. Pass 2: Gemini 3.8 Flash             ▼         │
│     (CSV / JSON / XML) ──►    False Alert vs True    ◄──    Initial Diff &   │
│                               Mismatch Analyzer             Parsing Errors   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `ExtractedField`: `{ fieldName, rawExtractedText, normalizedValue, expectedType, schemaValid, schemaError?, verbatimQuote, pageOrSection? }`
  - `BookingRecord`: `{ tradeId, fields: Record<string, string | number | null>, sourceFormat: 'CSV' | 'JSON' | 'XML' }`
  - `ReconciliationFieldResult`: `{ fieldName, displayLabel, termSheetRaw, termSheetNormalized, bookingValue, verbatimQuote, status: 'MATCH' | 'FALSE_ALERT' | 'TRUE_MISMATCH' | 'PARSING_ERROR' | 'MISSING_IN_TERMSHEET', reason, confidence }`
  - `TradeReconciliationReport`: `{ tradeId, termSheetFileName, bookingFileName, timestamp, summary: { totalFields, matches, falseAlerts, trueMismatches, parsingErrors }, results: ReconciliationFieldResult[] }`

- **Interactive Component & State Mapping**:
  - **Dataset Switcher & Upload Zone**: Selecting a pre-loaded trade scenario or uploading local `.pdf`/`.docx` + `.csv`/`.json`/`.xml` files triggers `/api/parse-files` and `/api/reconcile`, updating the live step indicator (`Ingesting Files` → `Pass 1: LLM Extraction & Schema Validation` → `Pass 2: Semantic False Alert Analysis` → `Complete`).
  - **Status Filter Bar & Search**: Segmented buttons (`All Fields`, `True Mismatches`, `False Alerts`, `Parsing Errors`, `Matches`) and search input filter the reconciliation table rows with zero latency.
  - **Evidence & Audit Drawer**: Selecting any field row opens the side-by-side verification panel showing the highlighted quote inside the full term sheet text, the Pydantic/JSON schema validation result, and the Pass 2 LLM reasoning.
  - **GitHub ZIP Generator**: Clicking `Download GitHub Repo (.zip)` packages all Python modules, `requirements.txt`, `.env.example`, generated sample PDF/Word/CSV/JSON files, `README.md`, and `docs/Technical_Report.md` into a standard zip archive for immediate GitHub upload.
