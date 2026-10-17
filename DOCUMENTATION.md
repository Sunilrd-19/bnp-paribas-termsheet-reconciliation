# Technical Documentation Report: Automated Term Sheet & Trade Booking Reconciliation Engine

**Project:** BNP Paribas Middle-Office Operations — LLM-Powered Fixed Income Term Sheet Reconciliation  
**Architecture:** Two-Pass Programmatic LLM Pipeline (`google-genai` API + Strict `Pydantic` / JSON Schema Validation)

---

## 1. End-to-End Workflow Architecture

The solution automates fixed-income trade verification between unstructured legal **Term Sheets** (`.pdf`, `.docx`, `.txt`) and structured **Booking System Extracts** (`.csv`, `.json`, `.xml`) using a deterministic **Two-Pass Programmatic LLM Architecture**:

1. **Stage 1 — Automated Document & Booking Ingestion:**
   - **Term Sheet Parser:** Programmatically extracts raw text and embedded tables from PDF (`pypdf` / `unpdf`), Microsoft Word (`python-docx` / `mammoth`), or plain text documents without manual copy-pasting.
   - **Booking Extract Parser:** Ingests multi-trade booking records (`TradeID #1` … `TradeID #N`) from CSV (`csv.DictReader`), JSON (`{"trades": [...]}`), or XML formats.
2. **Stage 2 — LLM Pass 1 (Structured Extraction, Evidence Grounding & Schema Validation):**
   - Submits the parsed Term Sheet text to the Gemini API (`gemini-2.5-flash`) with `temperature=0.0` and `response_mime_type="application/json"`.
   - Extracts all **19 bond attributes** (`ISIN`, `Issuer`, `Maturity`, `Notional`, `Coupon`, `Currency`, `SettlementDate`, `DayCountFraction`, `InterestPaymentDate`, `IssueDate`, `IssueAmount`, `IssuePrice`, `NominalAmountPerBond`, `InterestPaymentFrequency`, `BusinessDayConvention`, `BusinessDayLocation`, `AmortizationType`, `MinimumSubscription`, `Parent`).
   - Requires the LLM to return three properties per attribute: `raw_value`, `normalized_value`, and the exact `verbatim_quote` from the source document.
   - Validates every extracted and booked value against a strict **Pydantic / Type Schema** (`ISIN` ISO 6166 regex, `CURRENCY` ISO 4217 code, `FLOAT`, `DATE` ISO 8601, `STRING`). Any field failing type validation is immediately isolated as a **`PARSING_ERROR`** rather than a mismatch.
3. **Stage 3 — Initial Comparison & Consensus Trade Notional Derivation:**
   - Compares normalized Term Sheet attributes against each booked trade row.
   - For multi-trade extracts where individual trade sizes (`Notional`) are tranche allocations of a larger facility (`IssueAmount`), derives the consensus tranche notional across the booking batch to detect fat-finger notional booking errors (e.g., `3,100,000` vs `3,000,000` in Trade #3).
4. **Stage 4 — LLM Pass 2 (Intelligent False Alert Suppression vs. True Mismatch Classification):**
   - Any candidate discrepancy identified during initial comparison is passed to a **second programmatic LLM call** along with the Term Sheet raw value, the verbatim source quote, and the booking value.
   - Pass 2 classifies each discrepancy into **`FALSE_ALERT` (with financial explanation)** when the economic meaning is identical (formatting, unit scaling, date notation, or phrasing) or **`TRUE_MISMATCH` (with risk impact)** when an actual operational booking error exists.

---

## 2. LLM / API Integration & Field Extraction Design

- **Programmatic SDK:** Uses the official Google GenAI SDK (`google-genai` in Python and `@google/genai` in TypeScript/Node.js) via the free-tier developer API (`GEMINI_API_KEY`).
- **Deterministic Structured Outputs:** Enforces strict JSON schema responses at `temperature=0.0` so outputs are reproducible across runs.
- **Multi-Model Quota Resilience:** Automatically rotates across `gemini-2.5-flash`, `gemini-2.5-flash-lite`, and `gemini-3-flash-preview` with exponential backoff to prevent free-tier `429 RESOURCE_EXHAUSTED` interruptions during batch evaluation.
- **Anti-Hallucination Evidence Requirement:** By forcing the model to extract the `verbatim_quote` alongside every field (e.g., *"Day-count fraction for coupon is '30/360', business day convention is 'unadjusted' and business day is 'Oslo' and 'New York'"*), the system guarantees auditability and prevents hallucinated values when a field is omitted from a draft Term Sheet.

---

## 3. Key Challenges & Domain Assumptions

1. **Distinguishing Schema `PARSING_ERROR` from `TRUE_MISMATCH` (Perpetual AT1 Bonds):**
   - *Challenge:* In the **IDBI Bank Omni AT1 Bond** Term Sheet, Clause 10 defines `Tenor: Perpetual` (no fixed maturity date). However, the booking extract records a date (`17-10-2025` / `2025-10-17`, confusing the 10-year callable date with a final maturity date).
   - *Solution:* Because our schema strictly defines `Maturity` as type `DATE`, extracting the string `"Perpetual"` from the Term Sheet triggers a **Schema Type Validation Failure** (`PARSING_ERROR`), explicitly alerting operations that a perpetual instrument cannot be validated against a fixed maturity date schema.
2. **Missing Identifier in Draft Term Sheets (IDBI Bank `ISIN`):**
   - *Challenge:* The IDBI Bank summary term sheet was drafted prior to NSDL/CDSL allotment and omits the `ISIN` code, whereas the booking system contains `INE008A08U84`.
   - *Solution:* Pass 1 extracts `ISIN = null` with evidence *"No ISIN code is stated anywhere in the IDBI Omni AT1 Summary Term Sheet"*, and Pass 2 flags `ISIN` as a **`TRUE_MISMATCH`** requiring verification against the official allotment letter.
3. **Complex Financial Notation & Indian Numbering Conventions (`FALSE_ALERT` Suppression):**
   - *Genel Energy:* ISIN whitespace (`"NO 0010894330"` vs `"NO0010894330"`), percentage notation (`"9.25% p.a."` vs `9.25`), currency prefixes (`"USD 300,000,000"` vs `300000000`), and semantic prose (`"repaid in full at the Maturity Date"` vs `"Bullet"`) are accurately classified as **`FALSE_ALERT`**.
   - *IDBI Bank:* Indian numbering units (`"Rs.1,500 Crores"` = `15,000,000,000` INR and `"Rs.10,00,000/- (Rupees Ten Lakh)"` = `1,000,000` INR) and composite minimum subscription rules (`"5 Bonds"` × `Rs.10,00,000` face value = `5,000,000` INR) are mathematically resolved in Pass 2 as **`FALSE_ALERT`** rather than false-positive breaks.

---

## 4. Production DevOps Deployment & Automation Recommendations

1. **Event-Driven Straight-Through Processing (STP) Pipeline:**
   - Deploy the reconciliation engine as a containerized microservice (**Docker + Kubernetes / Google Cloud Run**) consuming trade booking events from **Apache Kafka / RabbitMQ** (linked to Murex, Calypso, or Bloomberg TOMS) and document ingestion webhooks from **SharePoint / S3**.
2. **Tiered Human-in-the-Loop (HITL) Routing:**
   - **Auto-Approve (STP):** Trades with `0 TRUE_MISMATCH` and `0 PARSING_ERROR` (e.g., Genel Energy `TradeID #1` and `TradeID #5`) are automatically cleared.
   - **Exception Queue:** Trades with `TRUE_MISMATCH` (e.g., `TradeID #2` Maturity break, `TradeID #3` Notional break, `TradeID #4` Coupon/IssueDate break) automatically open high-priority Jira/ServiceNow tickets pre-populated with the Term Sheet verbatim quote.
3. **CI/CD & Regression Governance:**
   - Integrate a **GitHub Actions CI pipeline** running golden-dataset regression tests (`pytest`) on historical Term Sheets whenever prompt templates, Pydantic schemas, or LLM model versions are updated.
   - Store all LLM Pass 1/Pass 2 prompts, latencies, token usage, and verbatim evidence payloads in an immutable PostgreSQL audit ledger for regulatory compliance (MiFID II / RBI / SEC).
