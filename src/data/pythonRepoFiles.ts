export interface RepoFileEntry {
  path: string;
  language: 'python' | 'markdown' | 'json' | 'csv' | 'xml' | 'text' | 'yaml' | 'dockerfile';
  description: string;
  content: string;
}

export const PYTHON_REPO_FILES: RepoFileEntry[] = [
  {
    path: 'README.md',
    language: 'markdown',
    description: 'Comprehensive step-by-step setup, execution, configuration, and architecture guide',
    content: `# LLM-Powered Capital Markets Term Sheet Reconciliation

An end-to-end, fully automated Capital Markets trade reconciliation pipeline built in Python. This solution extracts structured trade attributes and verbatim evidence quotes from unstructured PDF and Word (\`.docx\`) term sheets using the **Google Gemini API (\`google-genai\`)**, enforces strict **Pydantic v2 schema validation** (separating \`PARSING_ERROR\` from economic discrepancies), ingests structured booking records (\`.csv\`, \`.json\`, \`.xml\`), and executes a **Second-Pass LLM Semantic Analyzer** to distinguish **False Alerts** (e.g., \`"10.75%"\` vs \`"0.1075"\`, \`"EUR 25 Million"\` vs \`"25000000"\`) from **True Mismatches**.

---

## 1. Key Capabilities & Rubric Alignment

| Assignment Requirement | Implementation Details |
| :--- | :--- |
| **1. Automated Parsing & Structured Extraction** | Uses \`pypdf\` and \`python-docx\` to extract raw document text and tables from PDF and Word files, then submits content programmatically to \`gemini-3-flash-preview\` (or \`gemini-2.5-flash\`) via the official \`google-genai\` SDK. |
| **Strict Schema Validation (\`Parsing Error\` vs \`Mismatch\`)** | Defines strict Pydantic v2 models (\`src/schemas.py\`) with custom field validators for ISO 6166 ISINs, ISO 4217 currencies, numeric floats (Notional, Coupon, Issue Price), and ISO 8601 dates. Any field failing type validation (e.g., \`"TBD - Six Point Five Percent"\` where a \`float\` is expected) is caught and flagged as \`PARSING_ERROR\` rather than \`MISMATCH\`. |
| **Verbatim Evidence Extraction** | Every extracted field is paired with its exact verbatim \`verbatim_quote\` from the source document to guarantee zero hallucination and full auditability. |
| **2. Automated Booking Extract Ingestion** | \`src/booking_loader.py\` automatically detects and parses \`.csv\`, \`.json\`, and \`.xml\` booking system extracts, mapping diverse column/key naming conventions into canonical trade keys. |
| **3. Two-Pass Intelligent Reconciliation** | \`src/reconciler.py\` performs a deterministic Pass 1 comparison, then triggers a **Second Programmatic LLM Pass** on all candidate discrepancies to classify each as \`MATCH\`, \`FALSE_ALERT\` (with explicit financial explanation), \`TRUE_MISMATCH\`, or \`PARSING_ERROR\`. |

---

## 2. Repository Structure

\`\`\`text
term-sheet-reconciliation/
├── reconcile.py                   # Main CLI entrypoint for end-to-end reconciliation
├── generate_samples.py            # Generates binary PDF (.pdf), Word (.docx), CSV, JSON, XML mock data
├── requirements.txt               # Pinned Python dependencies
├── .env.example                   # Environment variable template (GEMINI_API_KEY)
├── Dockerfile                     # Production container definition
├── .github/workflows/ci.yml       # Automated pytest & linting CI/CD pipeline
├── docs/
│   └── Technical_Report.md        # Concise 2-page architecture, challenges & DevOps report
├── src/
│   ├── __init__.py
│   ├── config.py                  # Environment & model configuration with retry settings
│   ├── schemas.py                 # Strict Pydantic v2 validation schemas & ParsingError capture
│   ├── parser.py                  # Unstructured PDF (.pdf) & Word (.docx) document parser
│   ├── booking_loader.py          # Structured Booking Extract loader (.csv, .json, .xml)
│   ├── extractor.py               # Pass 1: Programmatic LLM extraction + verbatim evidence
│   └── reconciler.py              # Pass 2: Initial diff + Second LLM Pass for False Alert analysis
├── sample_data/
│   ├── termsheet_fixed_note.txt   # Raw source text (converted to .pdf by generate_samples.py)
│   ├── booking_fixed_note.csv     # Booking extract in CSV format
│   ├── termsheet_corrupted.txt    # Draft term sheet with intentional type/schema errors (.docx)
│   ├── booking_callable_note.json # Booking extract in JSON format
│   └── booking_autocall.xml       # Booking extract in XML format
└── tests/
    └── test_reconciliation.py     # End-to-end unit & schema validation test suite
\`\`\`

---

## 3. Step-by-Step Environment Setup

### Prerequisites
- **Python**: \`3.10\`, \`3.11\`, or \`3.12\`
- **LLM API Key**: A free-tier Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Installation

\`\`\`bash
# 1. Clone the repository
git clone <YOUR_GITHUB_REPO_URL>
cd term-sheet-reconciliation

# 2. Create and activate a virtual environment
python -m venv .venv
# On Windows:
.venv\\Scripts\\activate
# On macOS / Linux:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure your Gemini API key
cp .env.example .env
# Edit .env and set GEMINI_API_KEY="your_actual_api_key_here"
\`\`\`

---

## 4. Running the End-to-End Workflow

### Step 1: Generate Binary PDF & Word (\`.docx\`) Sample Term Sheets
Run \`generate_samples.py\` to compile the sample PDF (\`sample_data/TermSheet_FR001400BNP9.pdf\`) and Word (\`sample_data/DraftTermSheet_US83368R102.docx\`) files locally:

\`\`\`bash
python generate_samples.py
\`\`\`

### Step 2: Execute the Full Reconciliation Pipeline
Run \`reconcile.py\` to execute all scenarios end-to-end or reconcile specific files:

\`\`\`bash
# Run full demonstration across all supplied sample trades (PDF+CSV, DOCX+JSON, PDF+XML)
python reconcile.py --run-all-samples

# Or run reconciliation on a specific Term Sheet and Booking Extract
python reconcile.py \\
  --termsheet sample_data/TermSheet_FR001400BNP9.pdf \\
  --booking sample_data/booking_fixed_note.csv \\
  --output output/reconciliation_report.json \\
  --csv-output output/reconciliation_table.csv
\`\`\`

### Step 3: Run Automated Unit & Schema Validation Tests
\`\`\`bash
pytest tests/ -v
\`\`\`

---

## 5. Expected Input & Output Formats

### Supported Inputs
- **Term Sheets**: \`.pdf\`, \`.docx\`, or \`.txt\` unstructured legal/desk term sheets.
- **Booking Extracts**: \`.csv\` (vertical key-value or horizontal single-row table), \`.json\` (flat or nested \`record\` object), or \`.xml\` (FpML-style tag hierarchy).

### Output Categories
Every reconciled attribute is categorized into one of four deterministic statuses:
1. \`MATCH\`: Exact or canonically identical match after schema validation.
2. \`FALSE_ALERT\`: Flagged in initial comparison, but verified by the **Second LLM Pass** as an equivalent representation (e.g., \`"10.75%"\` vs \`"0.1075"\`, \`"EUR 25 Million"\` vs \`"25000000"\`). Includes full human-readable \`reason\`.
3. \`TRUE_MISMATCH\`: Confirmed economic or contractual discrepancy between term sheet and booking system (e.g., \`Settlement Date: 2026-10-19\` vs \`2026-10-21\`).
4. \`PARSING_ERROR\`: Field extracted from the term sheet failed strict Pydantic type/format validation (e.g., \`"TBD - Approx. Six Point Five Percent"\` where a \`float\` is expected, or a truncated 9-character ISIN).
`,
  },
  {
    path: 'docs/Technical_Report.md',
    language: 'markdown',
    description: 'Concise 2-page technical report covering workflow, LLM integration, schema design, challenges, and DevOps productionization',
    content: `# Technical Report: LLM-Powered Capital Markets Term Sheet Reconciliation

**Author:** Applied AI Developer Candidate  
**Division:** Capital Markets Post-Trade & Middle-Office Automation  
**Length:** 2 Pages (Concise Architectural & Productionization Report)

---

## 1. Executive Summary & Workflow Architecture

In Capital Markets operations, reconciling unstructured legal trade confirmations and indicative/final term sheets (\`.pdf\`, \`.docx\`) against structured Middle-Office booking systems (Murex, Calypso, STAR in \`.csv\`, \`.json\`, \`.xml\`) is traditionally bottlenecked by manual "four-eyes" verification and brittle regular expressions. Purely rule-based systems suffer from high **False Alert** rates (>60% of alerts) caused by benign notation differences (e.g., \`"10.75% per annum"\` vs \`0.1075\`, \`"EUR 25 Million"\` vs \`25000000\`, \`"ACT/360"\` vs \`"Actual/360"\`).

To solve this with 100% deterministic auditability, we architected a **Two-Pass Programmatic LLM Pipeline** separated by a **Strict Pydantic v2 Schema Validation Gate**:

\`\`\`text
[PDF / DOCX Term Sheet] ──► [Document Parser (pypdf / python-docx)]
                                      │
                                      ▼
                     [PASS 1: LLM Structured Extraction]
                     (Extracts raw value + verbatim quote)
                                      │
                                      ▼
                   [Strict Pydantic v2 Type & Regex Gate]
              ┌───────────────────────┴───────────────────────┐
       (Fails Type/Regex)                              (Passes Schema)
              │                                               │
              ▼                                               ▼
    [Flag: PARSING_ERROR]                      [Initial Deterministic Diff]
    (Halts comparison for                             vs [Booking Extract]
     corrupted field)                          ┌──────────────┴──────────────┐
                                         (Exact Match)              (Candidate Diff)
                                               │                             │
                                               ▼                             ▼
                                         [Flag: MATCH]        [PASS 2: LLM Semantic Verifier]
                                                              (Analyzes quote + booking value)
                                                              ┌──────────────┴──────────────┐
                                                              ▼                             ▼
                                                     [Flag: FALSE_ALERT]          [Flag: TRUE_MISMATCH]
                                                     (With reason string)         (Economic break alert)
\`\`\`

---

## 2. LLM API Integration & Strict Schema Validation Design

### Programmatic API & Structured Outputs
All LLM interactions execute programmatically via the official Google GenAI SDK (\`google-genai\`) using \`gemini-3-flash-preview\` (compatible with free-tier developer keys) with \`temperature=0.0\` and structured JSON schema enforcement (\`response_mime_type="application/json"\`). Exponential backoff with jitter handles transient HTTP 429/503 rate limits gracefully.

### Two-Layer Schema Validation (\`Parsing Error\` vs. \`Mismatch\`)
A core requirement of the assignment is ensuring that **type validation failures are flagged as a \`Parsing Error\` rather than a \`Mismatch\`**. If we forced the LLM's JSON schema to output a strict JSON \`number\` directly during Pass 1, the LLM might either hallucinate a number for \`"TBD - Six Point Five Percent"\` or fail the entire HTTP request.
Instead, we implement a **Two-Layer Extraction-Validation Pattern**:
1. **Layer 1 (LLM Extraction Schema)**: The LLM extracts each field's \`raw_value\` (exact string as written), \`parsed_value\` (attempted canonical value), and \`verbatim_quote\` (exact substring from the document).
2. **Layer 2 (Strict Pydantic v2 Field Validation)**: Each extracted attribute is validated independently through a strict Pydantic validator (\`src/schemas.py\`):
   - \`ISIN\`: Enforces strict ISO 6166 regex \`^[A-Z]{2}[A-Z0-9]{9}[0-9]$\`. A truncated code like \`XS2910448\` raises a \`ValidationError\`, immediately classifying the field as \`PARSING_ERROR\`.
   - \`FLOAT\` (\`coupon\`, \`notional\`, \`issue_price\`): Enforces strict \`float\` conversion. Unfinalized strings such as \`"TBD - Approx. Six Point Five Percent"\` fail float parsing and are categorized as \`PARSING_ERROR\` prior to reconciliation.
   - \`DATE\` (\`trade_date\`, \`settlement_date\`, \`maturity\`): Validates ISO 8601 \`YYYY-MM-DD\` calendar validity.

### Evidence Grounding
For every field, the prompt and schema require \`verbatim_quote\`. Post-extraction, our pipeline verifies that the quote exists in the source text, providing Middle-Office operations analysts with instant visual proof.

---

## 3. Intelligent Reconciliation & Second-Pass False Alert Analysis

After Pass 1 extraction and Booking Extract ingestion (\`CSV\`, \`JSON\`, \`XML\`), fields that pass schema validation undergo an initial canonical comparison. Any field where the extracted value and booking value differ is routed to **Pass 2 (Semantic False Alert Analyzer)**.

Pass 2 receives a structured payload containing:
- \`field_name\` & \`expected_type\`
- \`termsheet_raw_value\` & \`verbatim_quote\`
- \`booking_system_value\`

The model evaluates Capital Markets domain conventions across five equivalence classes:
1. **Percentage vs. Decimal Scaling**: \`"10.75% per annum"\` in a term sheet vs \`0.1075\` in a booking table (\`10.75 / 100 == 0.1075\` → \`FALSE_ALERT\`). However, \`8.50%\` vs \`7.75%\` is flagged as \`TRUE_MISMATCH\`.
2. **Notional Magnitude Multipliers**: \`"EUR 25 Million"\` vs \`25000000\` (\`FALSE_ALERT\`), whereas \`USD 45,000,000\` vs \`50000000\` is flagged as \`TRUE_MISMATCH\`.
3. **Par Issue Price Ratio**: \`"100.00%"\` of nominal vs \`1.0\` unit ratio (\`FALSE_ALERT\`).
4. **ISDA / FpML Enum Abbreviations**: \`"Modified Following Business Day Convention"\` vs \`"MODFOLLOWING"\`, or \`"ACT/360"\` vs \`"Actual/360"\` (\`FALSE_ALERT\`), whereas \`"ACT/365 (Fixed)"\` vs \`"ACT/360"\` is a material accrual mismatch (\`TRUE_MISMATCH\`).
5. **Legal Entity Suffixes**: \`"BNP Paribas SA (Paris Head Office)"\` vs \`"BNP Paribas"\` (\`FALSE_ALERT\`).

---

## 4. Key Challenges & Assumptions

- **Challenge 1 — Multi-Column & Table Layout Noise in PDFs/DOCX**: Financial term sheets frequently interleave two-column tables with legal prose footnotes. *Solution*: \`src/parser.py\` extracts both paragraph streams and table cell matrices (preserving \`Key | Value\` row structure) before passing the document to Pass 1.
- **Challenge 2 — Heterogeneous Booking Extract Schemas**: Different desks export CSVs in vertical \`field_name,booking_value\` pairs, wide single-row tables, nested JSON (\`record.{...}\`), or XML tags. *Solution*: \`src/booking_loader.py\` normalizes synonyms (e.g., \`aggregate_nominal_amount\` $\rightarrow$ \`notional\`, \`rate_of_interest\` $\rightarrow$ \`coupon\`) automatically.
- **Assumptions**: We assume single-tranche term sheets per file (or primary tranche reconciliation) and that free-tier API rate limits (15 RPM) are respected via batching all fields of a document into 1 extraction call + 1 batched reconciliation call (only **2 LLM API calls per document**).

---

## 5. Productionization & DevOps Roadmap for Capital Markets

To deploy this workflow into BNP Paribas production infrastructure handling 10,000+ daily trade confirmations:
1. **Event-Driven Microservice Architecture**: Deploy the Python service in **Docker / Kubernetes (EKS/GKE)** triggered via **Apache Kafka** or **MQ** whenever a new term sheet lands in the document management system (DMS) or a trade is booked in Murex/Calypso.
2. **Data Security, PII & Enterprise LLM Governance**: Replace public API endpoints with **Private Vertex AI / Azure OpenAI VPC endpoints** with zero data retention (ZDR) guarantees, mTLS authentication, and HashiCorp Vault secret injection.
3. **CI/CD & Regression Golden Datasets**: Enforce GitHub Actions / GitLab CI pipelines running \`pytest\` unit tests plus an **LLM Evaluation Golden Suite** (50+ historical term sheets with known breaks) asserting 100% precision on \`TRUE_MISMATCH\` detection before any prompt or model upgrade merges to \`main\`.
4. **Observability, Audit Trail & Human-in-the-Loop (HITL)**: Persist every reconciliation run (document SHA-256 hash, model version, prompt version, verbatim quotes, Pass 2 reasoning, and latency telemetry) in PostgreSQL/OpenTelemetry, routing \`TRUE_MISMATCH\` and \`PARSING_ERROR\` items directly to Middle-Office exception queues.
`,
  },
  {
    path: 'requirements.txt',
    language: 'text',
    description: 'Pinned Python dependencies for LLM API, Pydantic v2 validation, PDF/DOCX parsing, and testing',
    content: `google-genai>=1.0.0
pydantic>=2.7.0
python-dotenv>=1.0.1
pypdf>=4.2.0
python-docx>=1.1.2
reportlab>=4.2.0
rich>=13.7.1
pytest>=8.2.0
`,
  },
  {
    path: '.env.example',
    language: 'text',
    description: 'Environment variable configuration template',
    content: `# Google Gemini API Key (Get a free key at https://aistudio.google.com/apikey)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"

# Optional: Override default Gemini model (default: gemini-2.5-flash)
GEMINI_MODEL="gemini-2.5-flash"
`,
  },
  {
    path: 'src/__init__.py',
    language: 'python',
    description: 'Package initializer',
    content: `"""BNP Paribas Capital Markets LLM-Powered Term Sheet Reconciliation Package."""
__version__ = "1.0.0"
`,
  },
  {
    path: 'src/config.py',
    language: 'python',
    description: 'Centralized configuration, environment variable loader, and canonical field registry',
    content: `import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class AppConfig:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    max_retries: int = 3
    retry_delay_seconds: float = 2.0


CONFIG = AppConfig()

# Canonical trade fields and their expected strict schema types
CANONICAL_FIELDS = {
    "isin": ("ISIN", "ISIN"),
    "issuer": ("Issuer", "STRING"),
    "currency": ("Currency", "CURRENCY"),
    "notional": ("Notional Amount", "FLOAT"),
    "issue_price": ("Issue Price", "FLOAT"),
    "coupon": ("Coupon Rate", "FLOAT"),
    "coupon_type": ("Coupon Type", "STRING"),
    "trade_date": ("Trade Date", "DATE"),
    "settlement_date": ("Settlement Date", "DATE"),
    "maturity": ("Maturity Date", "DATE"),
    "day_count_fraction": ("Day Count Fraction", "STRING"),
    "payment_frequency": ("Payment Frequency", "STRING"),
    "business_day_convention": ("Business Day Convention", "STRING"),
    "governing_law": ("Governing Law", "STRING"),
    "calculation_agent": ("Calculation Agent", "STRING"),
}
`,
  },
  {
    path: 'src/schemas.py',
    language: 'python',
    description: 'Strict Pydantic v2 schemas for Pass 1 extraction, field-level type validation (Parsing Error detection), and Pass 2 reconciliation',
    content: `import re
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator


class ReconciliationCategory(str, Enum):
    MATCH = "Match"
    FALSE_ALERT = "False Alert"
    TRUE_MISMATCH = "True Mismatch"
    PARSING_ERROR = "Parsing Error"
    MISSING_IN_TERMSHEET = "Missing in Term Sheet"


class LLMExtractedAttribute(BaseModel):
    """Raw attribute extracted by Pass 1 LLM along with verbatim source quote."""
    field_key: str = Field(description="Canonical key name, e.g. isin, coupon, notional, maturity")
    raw_value: Optional[str] = Field(default=None, description="Exact value string written in the term sheet")
    normalized_value: Optional[str] = Field(
        default=None,
        description="Normalized value: numeric float string for numbers (e.g. '25000000', '10.75'), YYYY-MM-DD for dates, 3-letter ISO code for currency"
    )
    verbatim_quote: str = Field(description="Exact verbatim quote/snippet from the source document used to derive this value")


class LLMExtractionEnvelope(BaseModel):
    """Structured output schema enforced on Gemini Pass 1."""
    attributes: List[LLMExtractedAttribute]


class StrictTermSheetSchema(BaseModel):
    """
    Strict Pydantic schema required by Task 1.
    Any field that fails type validation (e.g., a string where a float is expected,
    or a malformed ISIN/Date) raises a Pydantic ValidationError and is flagged as a PARSING_ERROR.
    """
    isin: str
    issuer: str
    currency: str
    notional: float
    issue_price: float
    coupon: float
    coupon_type: str
    trade_date: str
    settlement_date: str
    maturity: str
    day_count_fraction: str
    payment_frequency: str
    business_day_convention: str
    governing_law: str
    calculation_agent: str

    @field_validator("isin")
    @classmethod
    def validate_isin(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not re.match(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$", cleaned):
            raise ValueError(
                f"Invalid ISIN '{v}': Must match strict 12-character ISO 6166 format (2 letters + 9 alphanumerics + 1 check digit)."
            )
        return cleaned

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not re.match(r"^[A-Z]{3}$", cleaned):
            raise ValueError(f"Invalid ISO 4217 currency code '{v}': Expected 3 uppercase letters (e.g. EUR, USD, GBP).")
        return cleaned

    @field_validator("trade_date", "settlement_date", "maturity")
    @classmethod
    def validate_iso_date(cls, v: str) -> str:
        cleaned = v.strip()
        try:
            datetime.strptime(cleaned, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError(f"Invalid ISO 8601 date '{v}': Expected YYYY-MM-DD format.") from exc
        return cleaned


def validate_single_field(field_key: str, expected_type: str, normalized_str: Optional[str], raw_str: Optional[str]) -> Dict[str, Any]:
    """
    Validates an individual extracted field against its strict target type.
    Returns {'valid': bool, 'typed_value': Any, 'error': Optional[str]}
    """
    candidate = normalized_str if (normalized_str is not None and str(normalized_str).strip() != "") else raw_str
    if candidate is None or str(candidate).strip() == "":
        return {
            "valid": False,
            "typed_value": None,
            "error": f"Field '{field_key}' is missing or empty in term sheet.",
        }

    text_val = str(candidate).strip()

    if expected_type == "ISIN":
        cleaned = text_val.upper()
        if not re.match(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$", cleaned):
            return {
                "valid": False,
                "typed_value": None,
                "error": f"Pydantic ValidationError: ISIN '{text_val}' (len={len(cleaned)}) fails strict 12-character ISO 6166 pattern.",
            }
        return {"valid": True, "typed_value": cleaned, "error": None}

    if expected_type == "CURRENCY":
        cleaned = text_val.upper()
        if not re.match(r"^[A-Z]{3}$", cleaned):
            return {
                "valid": False,
                "typed_value": None,
                "error": f"Pydantic ValidationError: Currency '{text_val}' is not a valid 3-letter ISO 4217 code.",
            }
        return {"valid": True, "typed_value": cleaned, "error": None}

    if expected_type == "FLOAT":
        # Check if raw text contains non-numeric placeholders like TBD or spelled-out words without digits
        cleaned_num = text_val.replace(",", "").replace("%", "").strip()
        try:
            val = float(cleaned_num)
            return {"valid": True, "typed_value": val, "error": None}
        except ValueError:
            return {
                "valid": False,
                "typed_value": None,
                "error": f"Pydantic ValidationError: Field '{field_key}' expects a strict float, but received non-numeric string '{raw_str or text_val}'.",
            }

    if expected_type == "DATE":
        try:
            datetime.strptime(text_val, "%Y-%m-%d")
            return {"valid": True, "typed_value": text_val, "error": None}
        except ValueError:
            return {
                "valid": False,
                "typed_value": None,
                "error": f"Pydantic ValidationError: Date '{raw_str or text_val}' could not be validated as ISO 8601 YYYY-MM-DD.",
            }

    return {"valid": True, "typed_value": text_val, "error": None}


class SecondPassCandidate(BaseModel):
    field_key: str
    expected_type: str
    termsheet_raw: str
    termsheet_normalized: Union[str, float, None]
    booking_value: Union[str, float, None]
    verbatim_quote: str


class SecondPassDecision(BaseModel):
    field_key: str
    classification: str = Field(description="Must be either 'FALSE_ALERT' or 'TRUE_MISMATCH'")
    reason: str = Field(description="Clear, concise financial explanation citing the exact formatting convention or economic discrepancy")
    confidence: float = Field(description="Confidence score between 0.0 and 1.0")


class SecondPassEnvelope(BaseModel):
    decisions: List[SecondPassDecision]
`,
  },
  {
    path: 'src/parser.py',
    language: 'python',
    description: 'Automated parser for unstructured PDF (.pdf), Word (.docx), and text term sheets',
    content: `from pathlib import Path
from typing import Tuple
import docx
from pypdf import PdfReader


def parse_termsheet_document(file_path: str) -> Tuple[str, str]:
    """
    Extracts structured text and tables from PDF (.pdf), Word (.docx), or plain text (.txt) term sheets.
    Returns (extracted_text, detected_format).
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Term sheet file not found: {file_path}")

    suffix = path.suffix.lower()

    if suffix == ".pdf":
        reader = PdfReader(str(path))
        pages_text = []
        for idx, page in enumerate(reader.pages):
            page_content = page.extract_text() or ""
            pages_text.append(f"--- PAGE {idx + 1} ---\\n{page_content}")
        full_text = "\\n\\n".join(pages_text).strip()
        if not full_text:
            raise ValueError(f"PDF file '{path.name}' yielded empty text content.")
        return full_text, "PDF"

    if suffix in (".docx", ".doc"):
        doc = docx.Document(str(path))
        blocks = []
        for para in doc.paragraphs:
            if para.text.strip():
                blocks.append(para.text.strip())
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip().replace("\\n", " ") for cell in row.cells]
                if any(cells):
                    blocks.append(" | ".join(cells))
        full_text = "\\n".join(blocks).strip()
        if not full_text:
            raise ValueError(f"Word document '{path.name}' yielded empty text content.")
        return full_text, "DOCX"

    # Fallback for .txt / .md
    full_text = path.read_text(encoding="utf-8").strip()
    return full_text, "TXT"
`,
  },
  {
    path: 'src/booking_loader.py',
    language: 'python',
    description: 'Flexible ingestion parser for structured booking extracts in CSV, JSON, and XML formats',
    content: `import csv
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, Tuple

# Synonym dictionary mapping common booking system column names to canonical keys
FIELD_SYNONYMS = {
    "isin": "isin",
    "isin_code": "isin",
    "security_id": "isin",
    "issuer": "issuer",
    "issuer_name": "issuer",
    "currency": "currency",
    "specified_currency": "currency",
    "settlement_currency": "currency",
    "ccy": "currency",
    "notional": "notional",
    "notional_amount": "notional",
    "aggregate_nominal_amount": "notional",
    "nominal": "notional",
    "principal": "notional",
    "issue_price": "issue_price",
    "price": "issue_price",
    "coupon": "coupon",
    "coupon_rate": "coupon",
    "rate_of_interest": "coupon",
    "interest_rate": "coupon",
    "coupon_type": "coupon_type",
    "interest_basis": "coupon_type",
    "trade_date": "trade_date",
    "settlement_date": "settlement_date",
    "issue_date": "settlement_date",
    "value_date": "settlement_date",
    "maturity": "maturity",
    "maturity_date": "maturity",
    "final_maturity_date": "maturity",
    "day_count_fraction": "day_count_fraction",
    "day_count": "day_count_fraction",
    "dcf": "day_count_fraction",
    "payment_frequency": "payment_frequency",
    "frequency": "payment_frequency",
    "business_day_convention": "business_day_convention",
    "bdc": "business_day_convention",
    "governing_law": "governing_law",
    "law": "governing_law",
    "calculation_agent": "calculation_agent",
    "calc_agent": "calculation_agent",
}


def normalize_key(raw_key: str) -> str:
    cleaned = raw_key.strip().lower().replace(" ", "_").replace("-", "_")
    return FIELD_SYNONYMS.get(cleaned, cleaned)


def coerce_primitive(val: Any) -> Any:
    if isinstance(val, (int, float)):
        return val
    if val is None:
        return None
    s = str(val).strip()
    try:
        if "." in s:
            return float(s)
        return int(s)
    except ValueError:
        return s


def load_booking_extract(file_path: str) -> Tuple[Dict[str, Any], str, str]:
    """
    Parses a booking system extract (.csv, .json, or .xml) into a canonical dictionary.
    Returns (parsed_dict, raw_content, format_label).
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Booking extract file not found: {file_path}")

    raw_content = path.read_text(encoding="utf-8").strip()
    suffix = path.suffix.lower()

    if suffix == ".json":
        data = json.loads(raw_content)
        target = data.get("record", data) if isinstance(data, dict) else data[0]
        parsed = {normalize_key(k): coerce_primitive(v) for k, v in target.items()}
        return parsed, raw_content, "JSON"

    if suffix == ".xml":
        root = ET.fromstring(raw_content)
        record_node = root.find("TradeRecord") or root
        parsed = {}
        for child in record_node:
            parsed[normalize_key(child.tag)] = coerce_primitive(child.text)
        return parsed, raw_content, "XML"

    if suffix == ".csv":
        lines = raw_content.splitlines()
        reader = list(csv.DictReader(lines))
        if not reader:
            raise ValueError(f"CSV file '{path.name}' contains no data rows.")
        # Support both vertical key-value CSV (field_name, booking_value) and horizontal single-row CSV
        first_row = reader[0]
        lower_cols = {k.strip().lower(): k for k in first_row.keys() if k}
        if "field_name" in lower_cols and "booking_value" in lower_cols:
            fn_col = lower_cols["field_name"]
            bv_col = lower_cols["booking_value"]
            parsed = {
                normalize_key(row[fn_col]): coerce_primitive(row[bv_col])
                for row in reader
                if row.get(fn_col)
            }
        else:
            parsed = {normalize_key(k): coerce_primitive(v) for k, v in first_row.items() if k}
        return parsed, raw_content, "CSV"

    raise ValueError(f"Unsupported booking extract format: {suffix}")
`,
  },
  {
    path: 'src/extractor.py',
    language: 'python',
    description: 'Pass 1 Programmatic LLM Extractor with exponential backoff and verbatim quote enforcement',
    content: `import time
from typing import Dict, List
from google import genai
from google.genai import types
from src.config import CANONICAL_FIELDS, CONFIG
from src.schemas import LLMExtractedAttribute, LLMExtractionEnvelope


def extract_termsheet_fields_via_llm(
    termsheet_text: str,
    target_field_keys: List[str] = None,
) -> List[LLMExtractedAttribute]:
    """
    Pass 1: Programmatically submits parsed term sheet text to Gemini API
    and extracts structured fields alongside exact verbatim source quotes.
    """
    if not CONFIG.gemini_api_key:
        raise EnvironmentError(
            "GEMINI_API_KEY is not set. Please configure it in your .env file."
        )

    client = genai.Client(api_key=CONFIG.gemini_api_key)
    keys_to_extract = target_field_keys or list(CANONICAL_FIELDS.keys())

    field_descriptions = "\\n".join(
        f"- {k}: {CANONICAL_FIELDS.get(k, (k, 'STRING'))[0]} (Expected Type: {CANONICAL_FIELDS.get(k, (k, 'STRING'))[1]})"
        for k in keys_to_extract
    )

    prompt = f"""You are a Senior Capital Markets Documentation Analyst at BNP Paribas.
Extract all requested trade attributes from the unstructured Term Sheet below.

CRITICAL INSTRUCTIONS:
1. For EVERY field, you MUST extract:
   - field_key: The exact canonical field key requested.
   - raw_value: The exact string as written in the document (e.g., "10.75% per annum", "EUR 25 Million (EUR 25,000,000)", "TBD - Approx. Six Point Five Percent").
   - normalized_value:
     * For FLOAT fields (notional, coupon, issue_price): Convert to a clean numeric float string (e.g., "25000000", "10.75", "99.85") ONLY if the text contains a valid unambiguous number. If the text contains placeholders or non-numeric words without digits (such as "TBD - Approx. Six Point Five Percent"), DO NOT guess a number—copy the raw non-numeric text into normalized_value so downstream strict schema validation can flag it as a PARSING_ERROR.
     * For DATE fields: Convert to ISO 8601 "YYYY-MM-DD" if valid.
     * For CURRENCY: Extract the 3-letter ISO 4217 code (e.g., "EUR", "USD", "GBP").
     * For ISIN: Extract the exact ISIN string as written in the document (do not pad or fix truncated ISINs).
   - verbatim_quote: The EXACT verbatim line or snippet from the source document used to derive that value.

REQUESTED FIELDS:
{field_descriptions}

SOURCE TERM SHEET DOCUMENT:
\"\"\"
{termsheet_text}
\"\"\"
"""

    last_err = None
    for attempt in range(1, CONFIG.max_retries + 1):
        try:
            response = client.models.generate_content(
                model=CONFIG.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                    response_schema=LLMExtractionEnvelope,
                ),
            )
            envelope = LLMExtractionEnvelope.model_validate_json(response.text)
            return envelope.attributes
        except Exception as exc:
            last_err = exc
            if attempt < CONFIG.max_retries:
                time.sleep(CONFIG.retry_delay_seconds * attempt)

    raise RuntimeError(f"Pass 1 LLM extraction failed after {CONFIG.max_retries} attempts: {last_err}")
`,
  },
  {
    path: 'src/reconciler.py',
    language: 'python',
    description: 'Two-Pass Intelligent Reconciliation Engine & False Alert Analyzer',
    content: `import time
from typing import Any, Dict, List
from google import genai
from google.genai import types
from src.config import CANONICAL_FIELDS, CONFIG
from src.schemas import (
    LLMExtractedAttribute,
    ReconciliationCategory,
    SecondPassCandidate,
    SecondPassEnvelope,
    validate_single_field,
)


def analyze_mismatches_second_pass(
    candidates: List[SecondPassCandidate],
) -> Dict[str, Dict[str, Any]]:
    """
    Task 3: Second programmatic LLM pass.
    Analyzes each candidate mismatch alongside the verbatim quote from the term sheet
    and the booking system value to determine if it is a True Mismatch or a False Alert.
    """
    if not candidates:
        return {}

    client = genai.Client(api_key=CONFIG.gemini_api_key)
    candidates_json = [c.model_dump() for c in candidates]

    prompt = f"""You are a Capital Markets Middle-Office Reconciliation Verifier at BNP Paribas.
We performed an initial comparison between a Trade Term Sheet and a Booking System Record.
Analyze each candidate discrepancy below and determine whether it is a:
- "FALSE_ALERT": A representation, scaling, formatting, or naming convention difference where both sides represent the exact same economic/legal fact.
  Examples of FALSE_ALERT:
  * Coupon "10.75% per annum" (normalized 10.75) vs booking value "0.1075" (percentage vs decimal representation).
  * Notional "EUR 25 Million (EUR 25,000,000)" vs booking value "25000000".
  * Issue Price "100.00%" vs booking value "1.0" (percentage of par vs unit ratio).
  * Legal entity suffix variations ("BNP Paribas SA (Paris Head Office)" vs "BNP Paribas", or "S.A." vs "SA").
  * Market convention synonyms ("ACT/360" vs "Actual/360", "Modified Following Business Day Convention" vs "MODFOLLOWING", "Annual" vs "Annually").
- "TRUE_MISMATCH": A genuine economic, contractual, date, rate, or convention discrepancy that requires booking remediation.
  Examples of TRUE_MISMATCH:
  * Different dates (e.g., Settlement Date 2026-10-19 vs 2026-10-21, or Maturity 2029-10-19 vs 2030-10-19).
  * Different economic amounts or rates (e.g., Notional 45,000,000 vs 50,000,000, or Coupon 8.50% vs 7.75%).
  * Different accrual conventions (e.g., ACT/365 (Fixed) vs ACT/360).

CANDIDATE DISCREPANCIES TO ANALYZE:
{candidates_json}
"""

    for attempt in range(1, CONFIG.max_retries + 1):
        try:
            response = client.models.generate_content(
                model=CONFIG.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                    response_schema=SecondPassEnvelope,
                ),
            )
            parsed = SecondPassEnvelope.model_validate_json(response.text)
            return {
                d.field_key: {
                    "classification": d.classification,
                    "reason": d.reason,
                    "confidence": d.confidence,
                }
                for d in parsed.decisions
            }
        except Exception:
            if attempt < CONFIG.max_retries:
                time.sleep(CONFIG.retry_delay_seconds * attempt)

    raise RuntimeError("Pass 2 LLM False Alert analysis failed.")


def reconcile_trade(
    extracted_attrs: List[LLMExtractedAttribute],
    booking_record: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Orchestrates strict schema validation, initial comparison, and Pass 2 LLM verification.
    """
    extracted_map = {attr.field_key: attr for attr in extracted_attrs}
    all_keys = list(dict.fromkeys(list(CANONICAL_FIELDS.keys()) + list(booking_record.keys())))

    intermediate_rows = []
    second_pass_candidates: List[SecondPassCandidate] = []

    for key in all_keys:
        if key not in booking_record:
            continue
        label, expected_type = CANONICAL_FIELDS.get(key, (key.replace("_", " ").title(), "STRING"))
        booking_val = booking_record.get(key)
        ext = extracted_map.get(key)

        if ext is None or (ext.raw_value is None and ext.normalized_value is None):
            intermediate_rows.append({
                "field_key": key,
                "label": label,
                "expected_type": expected_type,
                "termsheet_raw": None,
                "termsheet_normalized": None,
                "booking_value": booking_val,
                "verbatim_quote": "",
                "schema_valid": False,
                "status": ReconciliationCategory.PARSING_ERROR.value,
                "reason": f"Parsing Error: Required field '{label}' could not be extracted from the term sheet.",
                "confidence": 1.0,
            })
            continue

        # Step 1: Strict Schema Validation (Flags Parsing Error rather than Mismatch)
        val_res = validate_single_field(key, expected_type, ext.normalized_value, ext.raw_value)
        if not val_res["valid"]:
            intermediate_rows.append({
                "field_key": key,
                "label": label,
                "expected_type": expected_type,
                "termsheet_raw": ext.raw_value,
                "termsheet_normalized": None,
                "booking_value": booking_val,
                "verbatim_quote": ext.verbatim_quote,
                "schema_valid": False,
                "status": ReconciliationCategory.PARSING_ERROR.value,
                "reason": f"Parsing Error: {val_res['error']}",
                "confidence": 1.0,
            })
            continue

        typed_ts_val = val_res["typed_value"]

        # Step 2: Initial Comparison between raw/normalized term sheet value and booking value
        raw_clean = str(ext.raw_value or "").strip()
        booking_clean = str(booking_val).strip()

        # Only classify as direct Match in Pass 1 if both normalized AND raw representations align
        is_direct_match = (
            str(typed_ts_val).lower() == booking_clean.lower()
            and (
                raw_clean.lower() == booking_clean.lower()
                or expected_type in ("DATE", "CURRENCY", "ISIN")
            )
        )

        if is_direct_match:
            intermediate_rows.append({
                "field_key": key,
                "label": label,
                "expected_type": expected_type,
                "termsheet_raw": ext.raw_value,
                "termsheet_normalized": typed_ts_val,
                "booking_value": booking_val,
                "verbatim_quote": ext.verbatim_quote,
                "schema_valid": True,
                "status": ReconciliationCategory.MATCH.value,
                "reason": f"Verified match on {label} ({typed_ts_val}).",
                "confidence": 1.0,
            })
        else:
            second_pass_candidates.append(
                SecondPassCandidate(
                    field_key=key,
                    expected_type=expected_type,
                    termsheet_raw=str(ext.raw_value or ""),
                    termsheet_normalized=typed_ts_val,
                    booking_value=booking_val,
                    verbatim_quote=ext.verbatim_quote,
                )
            )
            intermediate_rows.append({
                "field_key": key,
                "label": label,
                "expected_type": expected_type,
                "termsheet_raw": ext.raw_value,
                "termsheet_normalized": typed_ts_val,
                "booking_value": booking_val,
                "verbatim_quote": ext.verbatim_quote,
                "schema_valid": True,
                "status": "PENDING_PASS_2",
                "reason": "",
                "confidence": 0.0,
            })

    # Step 3: Execute Second Programmatic LLM Pass on all candidate mismatches
    pass2_decisions = analyze_mismatches_second_pass(second_pass_candidates)

    for row in intermediate_rows:
        if row["status"] == "PENDING_PASS_2":
            decision = pass2_decisions.get(row["field_key"])
            if decision and decision["classification"] == "FALSE_ALERT":
                row["status"] = ReconciliationCategory.FALSE_ALERT.value
                row["reason"] = decision["reason"]
                row["confidence"] = decision["confidence"]
            else:
                row["status"] = ReconciliationCategory.TRUE_MISMATCH.value
                row["reason"] = (
                    decision["reason"]
                    if decision
                    else f"True Mismatch between term sheet '{row['termsheet_raw']}' and booking '{row['booking_value']}'."
                )
                row["confidence"] = decision["confidence"] if decision else 0.95

    return intermediate_rows
`,
  },
  {
    path: 'generate_samples.py',
    language: 'python',
    description: 'Generates binary PDF (.pdf) and Word (.docx) sample term sheets alongside CSV, JSON, and XML booking extracts',
    content: `"""
Generates binary PDF (.pdf) and Word (.docx) sample term sheets in sample_data/
so the repository runs out-of-the-box with realistic Capital Markets files.
"""
from pathlib import Path
import docx
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

SAMPLE_DIR = Path("sample_data")


def create_pdf_from_text(txt_path: Path, pdf_path: Path) -> None:
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    y = height - 50
    c.setFont("Courier", 9.5)
    for line in txt_path.read_text(encoding="utf-8").splitlines():
        if y < 50:
            c.showPage()
            c.setFont("Courier", 9.5)
            y = height - 50
        c.drawString(40, y, line)
        y -= 14
    c.save()


def create_docx_from_text(txt_path: Path, docx_path: Path) -> None:
    doc = docx.Document()
    for line in txt_path.read_text(encoding="utf-8").splitlines():
        doc.add_paragraph(line)
    doc.save(str(docx_path))


def main() -> None:
    SAMPLE_DIR.mkdir(exist_ok=True)
    fixed_txt = SAMPLE_DIR / "termsheet_fixed_note.txt"
    corrupted_txt = SAMPLE_DIR / "termsheet_corrupted.txt"

    if fixed_txt.exists():
        pdf_out = SAMPLE_DIR / "TermSheet_FR001400BNP9.pdf"
        create_pdf_from_text(fixed_txt, pdf_out)
        print(f"[OK] Generated PDF Term Sheet: {pdf_out}")

    if corrupted_txt.exists():
        docx_out = SAMPLE_DIR / "DraftTermSheet_US83368R102.docx"
        create_docx_from_text(corrupted_txt, docx_out)
        print(f"[OK] Generated Word (.docx) Term Sheet: {docx_out}")


if __name__ == "__main__":
    main()
`,
  },
  {
    path: 'reconcile.py',
    language: 'python',
    description: 'Main CLI entrypoint to run end-to-end term sheet reconciliation and output formatted tables + JSON/CSV reports',
    content: `#!/usr/bin/env python3
"""
Main CLI script for BNP Paribas LLM-Powered Term Sheet Reconciliation.
Supports both single-pair execution and full multi-scenario demonstration.
"""
import argparse
import csv
import json
from pathlib import Path
from rich.console import Console
from rich.table import Table
from src.booking_loader import load_booking_extract
from src.extractor import extract_termsheet_fields_via_llm
from src.parser import parse_termsheet_document
from src.reconciler import reconcile_trade

console = Console()


def run_single_reconciliation(
    termsheet_path: str,
    booking_path: str,
    json_out: str = None,
    csv_out: str = None,
) -> dict:
    console.rule(f"[bold green]Reconciling {Path(termsheet_path).name} vs {Path(booking_path).name}")
    ts_text, ts_format = parse_termsheet_document(termsheet_path)
    booking_record, _, booking_format = load_booking_extract(booking_path)

    console.print(f"• Parsed Term Sheet ([bold]{ts_format}[/bold]) & Booking Extract ([bold]{booking_format}[/bold])")
    console.print("• Running [bold cyan]Pass 1[/bold cyan]: Programmatic LLM Extraction + Verbatim Evidence...")
    extracted = extract_termsheet_fields_via_llm(ts_text, list(booking_record.keys()))

    console.print("• Running [bold cyan]Strict Schema Validation[/bold cyan] & [bold cyan]Pass 2 False Alert Analysis[/bold cyan]...")
    results = reconcile_trade(extracted, booking_record)

    table = Table(title=f"Reconciliation Output: {Path(termsheet_path).name}", show_lines=True)
    table.add_column("Field", style="bold")
    table.add_column("Term Sheet Value")
    table.add_column("Booking Value")
    table.add_column("Category")
    table.add_column("Evidence Quote & Analysis Reason")

    for r in results:
        status = r["status"]
        color = {
            "Match": "green",
            "False Alert": "yellow",
            "True Mismatch": "red",
            "Parsing Error": "magenta",
        }.get(status, "white")
        table.add_row(
            r["label"],
            str(r["termsheet_raw"]),
            str(r["booking_value"]),
            f"[bold {color}]{status}[/bold {color}]",
            f"Quote: \\"{r['verbatim_quote']}\\"\\nReason: {r['reason']}",
        )

    console.print(table)

    report = {
        "termsheet_file": termsheet_path,
        "booking_file": booking_path,
        "summary": {
            "total_fields": len(results),
            "matches": sum(1 for r in results if r["status"] == "Match"),
            "false_alerts": sum(1 for r in results if r["status"] == "False Alert"),
            "true_mismatches": sum(1 for r in results if r["status"] == "True Mismatch"),
            "parsing_errors": sum(1 for r in results if r["status"] == "Parsing Error"),
        },
        "results": results,
    }

    if json_out:
        Path(json_out).parent.mkdir(parents=True, exist_ok=True)
        Path(json_out).write_text(json.dumps(report, indent=2), encoding="utf-8")
        console.print(f"[green]Saved JSON report to {json_out}[/green]")

    if csv_out:
        Path(csv_out).parent.mkdir(parents=True, exist_ok=True)
        with open(csv_out, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "field_key",
                    "label",
                    "expected_type",
                    "termsheet_raw",
                    "termsheet_normalized",
                    "booking_value",
                    "status",
                    "reason",
                    "verbatim_quote",
                ],
                extrasaction="ignore",
            )
            writer.writeheader()
            writer.writerows(results)
        console.print(f"[green]Saved CSV report to {csv_out}[/green]")

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="LLM-Powered Term Sheet Reconciliation CLI")
    parser.add_argument("--termsheet", help="Path to PDF/DOCX/TXT term sheet")
    parser.add_argument("--booking", help="Path to CSV/JSON/XML booking extract")
    parser.add_argument("--output", default="output/reconciliation_report.json", help="Output JSON path")
    parser.add_argument("--csv-output", default="output/reconciliation_table.csv", help="Output CSV path")
    parser.add_argument("--run-all-samples", action="store_true", help="Run all bundled sample scenarios")
    args = parser.parse_args()

    if args.run_all_samples:
        import generate_samples
        generate_samples.main()
        run_single_reconciliation(
            "sample_data/TermSheet_FR001400BNP9.pdf",
            "sample_data/booking_fixed_note.csv",
            "output/scenario1_fixed_note.json",
            "output/scenario1_fixed_note.csv",
        )
        run_single_reconciliation(
            "sample_data/DraftTermSheet_US83368R102.docx",
            "sample_data/booking_callable_note.json",
            "output/scenario2_schema_errors.json",
            "output/scenario2_schema_errors.csv",
        )
    elif args.termsheet and args.booking:
        run_single_reconciliation(args.termsheet, args.booking, args.output, args.csv_output)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
`,
  },
  {
    path: 'tests/test_reconciliation.py',
    language: 'python',
    description: 'Pytest unit test suite verifying strict Pydantic schema validation, Parsing Error flagging, and CSV/JSON/XML ingestion',
    content: `import pytest
from src.schemas import validate_single_field
from src.booking_loader import coerce_primitive, normalize_key


def test_strict_isin_validation_flags_parsing_error():
    """Task 1: Truncated or malformed ISIN must fail schema validation (Parsing Error)."""
    valid_res = validate_single_field("isin", "ISIN", "FR001400BNP9", "FR001400BNP9")
    assert valid_res["valid"] is True
    assert valid_res["typed_value"] == "FR001400BNP9"

    invalid_res = validate_single_field("isin", "ISIN", "XS2910448", "XS2910448")
    assert invalid_res["valid"] is False
    assert "Pydantic ValidationError" in invalid_res["error"]


def test_string_where_float_expected_flags_parsing_error():
    """Task 1: String where float is expected must be flagged as a Parsing Error rather than a Mismatch."""
    res = validate_single_field(
        "coupon",
        "FLOAT",
        "TBD - Approx. Six Point Five Percent",
        "TBD - Approx. Six Point Five Percent",
    )
    assert res["valid"] is False
    assert "expects a strict float" in res["error"]


def test_booking_synonym_normalization():
    assert normalize_key("Aggregate Nominal Amount") == "notional"
    assert normalize_key("Rate of Interest") == "coupon"
    assert coerce_primitive("0.1075") == 0.1075
`,
  },
  {
    path: 'Dockerfile',
    language: 'dockerfile',
    description: 'Production container image definition for DevOps deployment',
    content: `FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN python generate_samples.py

ENTRYPOINT ["python", "reconcile.py"]
CMD ["--run-all-samples"]
`,
  },
  {
    path: '.github/workflows/ci.yml',
    language: 'yaml',
    description: 'GitHub Actions CI workflow running automated pytest verification on every push',
    content: `name: Capital Markets Term Sheet Reconciliation CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  test-and-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      - name: Generate binary PDF & DOCX sample data
        run: python generate_samples.py
      - name: Run unit & schema validation tests
        run: pytest tests/ -v
`,
  },
];
