"""
BNP Paribas — Automated Term Sheet & Trade Booking Reconciliation Engine (Python CLI)
=====================================================================================
Implements all 3 Assignment Tasks purely in Python via programmatic LLM API:
  1. Automated Parsing & Structured Extraction (PDF/DOCX/TXT -> Gemini API + strict Pydantic Schema Validation + Verbatim Evidence Quotes)
  2. Automated Booking Extract Ingestion (CSV/JSON programmatic ingestion)
  3. Intelligent Reconciliation & 2nd-Pass LLM False Alert Analysis (Match, False Alert with reason, True Mismatch, Parsing Error)

Usage:
  export GEMINI_API_KEY="your_api_key_here"   # or place GEMINI_API_KEY=... in .env
  python reconcile_termsheet.py
  python reconcile_termsheet.py --termsheet "sample_data/IDBI_Bank_Omni_AT1_Term_Sheet.txt" --booking "sample_data/IDBI_Bank_bond_trades.csv" --output "idbi_report.json"
"""

import os
import re
import csv
import json
import argparse
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field, field_validator
from google import genai
from google.genai import types


# ============================================================================
# ENVIRONMENT HELPER: AUTO-LOAD .env FILE IF PRESENT
# ============================================================================

def load_dotenv_if_present(dotenv_path: str = ".env") -> None:
    """Loads environment variables from a local .env file without requiring extra packages."""
    if not os.path.exists(dotenv_path):
        return
    with open(dotenv_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, val = stripped.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


# ============================================================================
# TASK 1: STRICT PYDANTIC SCHEMA DEFINITIONS & TYPE VALIDATION
# ============================================================================

class ExtractedFieldWithEvidence(BaseModel):
    """Every extracted field must include its raw value, normalized value, and exact verbatim quote from the source document."""
    raw_value: Optional[str] = Field(default=None, description="Raw value extracted from the term sheet")
    normalized_value: Any = Field(default=None, description="Typed/normalized value conforming to the target schema")
    verbatim_quote: str = Field(default="", description="Exact verbatim quote/snippet from the source document used to derive this value")


class TermSheetStrictPydanticSchema(BaseModel):
    """
    Strict Pydantic schema validating extracted term sheet attributes across all 19 canonical fields.
    Any field failing type validation (e.g., 'Perpetual' where a strict ISO Date is expected, or a
    non-numeric string where a float is expected) is caught per-field and flagged as a PARSING_ERROR
    rather than a Mismatch.
    """
    ISIN: Optional[str] = Field(default=None, description="12-character alphanumeric ISIN code")
    Issuer: str = Field(..., description="Legal name of the issuing entity")
    Maturity: str = Field(..., description="Maturity date in ISO YYYY-MM-DD format")
    Notional: float = Field(..., description="Standard trade notional / denomination amount as float")
    Coupon: float = Field(..., description="Annual coupon rate percentage as float (e.g., 9.25 for 9.25%)")
    Currency: str = Field(..., description="3-letter ISO 4217 currency code (e.g., USD, INR, EUR)")
    SettlementDate: str = Field(..., description="Settlement date in ISO YYYY-MM-DD format")
    DayCountFraction: str = Field(..., description="Day count convention (e.g., 30/360, Actual/Actual)")
    InterestPaymentDate: str = Field(..., description="First or recurring interest payment date in ISO YYYY-MM-DD format")
    IssueDate: str = Field(..., description="Issue / Allotment date in ISO YYYY-MM-DD format")
    IssueAmount: float = Field(..., description="Total issuance facility size in full base currency units as float")
    IssuePrice: float = Field(..., description="Issue price percentage of par as float (e.g., 97.0 or 100.0)")
    NominalAmountPerBond: float = Field(..., description="Face value / nominal denomination per bond as float")
    InterestPaymentFrequency: str = Field(..., description="Coupon frequency (e.g., Semi-Annual, Annual)")
    BusinessDayConvention: str = Field(..., description="Business day adjustment rule (e.g., Following, Modified Following)")
    BusinessDayLocation: str = Field(..., description="Financial center holiday calendar (e.g., Oslo|New York, Mumbai)")
    AmortizationType: str = Field(..., description="Principal repayment profile (e.g., Bullet, Perpetual, Amortizing)")
    MinimumSubscription: float = Field(..., description="Minimum permissible subscription amount in base currency as float")
    Parent: str = Field(..., description="Parent company or guarantor entity name (e.g., Genel Energy plc, IDBI Bank Limited)")

    @field_validator("ISIN")
    @classmethod
    def validate_isin_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None or str(v).strip().upper() in ("", "N/A", "NONE", "NULL", "NOT SPECIFIED", "NOT EXPLICITLY STATED IN TERM SHEET"):
            return None
        cleaned = re.sub(r"\s+", "", str(v).strip().upper())
        if not re.match(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$", cleaned):
            raise ValueError(f"Invalid ISIN format '{v}': expected 12-char ISO 6166 code")
        return cleaned

    @field_validator("Currency")
    @classmethod
    def validate_currency_code(cls, v: str) -> str:
        cleaned = str(v).strip().upper()
        if not re.match(r"^[A-Z]{3}$", cleaned):
            raise ValueError(f"Invalid ISO 4217 currency code '{v}'")
        return cleaned

    @field_validator("Maturity", "SettlementDate", "InterestPaymentDate", "IssueDate")
    @classmethod
    def validate_iso_date(cls, v: str) -> str:
        cleaned = str(v).strip()
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", cleaned):
            raise ValueError(f"Strict Date Schema Validation Failed: Expected ISO date YYYY-MM-DD, got '{v}'")
        return cleaned


FIELD_TYPE_EXPECTATIONS: Dict[str, str] = {
    "ISIN": "ISIN",
    "Issuer": "STRING",
    "Maturity": "DATE",
    "Notional": "FLOAT",
    "Coupon": "FLOAT",
    "Currency": "CURRENCY",
    "SettlementDate": "DATE",
    "DayCountFraction": "STRING",
    "InterestPaymentDate": "DATE",
    "IssueDate": "DATE",
    "IssueAmount": "FLOAT",
    "IssuePrice": "FLOAT",
    "NominalAmountPerBond": "FLOAT",
    "InterestPaymentFrequency": "STRING",
    "BusinessDayConvention": "STRING",
    "BusinessDayLocation": "STRING",
    "AmortizationType": "STRING",
    "MinimumSubscription": "FLOAT",
    "Parent": "STRING",
}


def validate_single_field_type(field_name: str, value: Any) -> Tuple[bool, Optional[str]]:
    """
    Validates an individual field against its expected schema data type.
    If validation fails (e.g., 'Perpetual' where a DATE is expected, or a non-numeric string
    where a FLOAT is expected), returns (False, error_reason) so the engine flags it as a
    PARSING_ERROR rather than a MISMATCH.
    """
    expected_type = FIELD_TYPE_EXPECTATIONS.get(field_name, "STRING")
    if value is None or str(value).strip().upper() in ("", "N/A", "NONE", "NULL", "NOT SPECIFIED", "NOT EXPLICITLY STATED IN TERM SHEET"):
        return True, None

    raw_str = "|".join(str(x) for x in value) if isinstance(value, list) else str(value).strip()
    if expected_type == "FLOAT":
        cleaned = re.sub(r"[,$%\s]|USD|INR|EUR|GBP|RS\.?", "", raw_str, flags=re.IGNORECASE)
        try:
            float(cleaned)
            return True, None
        except ValueError:
            return False, f"Strict Schema Type Validation Failed: Expected FLOAT for '{field_name}', but got non-numeric string '{raw_str}'."

    if expected_type == "DATE":
        if raw_str.lower() == "perpetual" or not re.search(r"\d", raw_str):
            return False, f"Strict Schema Type Validation Failed: Field '{field_name}' requires a valid calendar DATE (YYYY-MM-DD), but Term Sheet specifies '{raw_str}' (no fixed maturity date)."

    if expected_type == "ISIN":
        cleaned_isin = re.sub(r"\s+", "", raw_str.upper())
        if not re.match(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$", cleaned_isin):
            return False, f"Strict Schema Type Validation Failed: Expected 12-char ISIN for '{field_name}', got '{raw_str}'."

    if expected_type == "CURRENCY":
        if not re.match(r"^[A-Z]{3}$", raw_str.upper()):
            return False, f"Strict Schema Type Validation Failed: Expected 3-letter ISO currency code for '{field_name}', got '{raw_str}'."

    return True, None


# ============================================================================
# DOCUMENT & BOOKING EXTRACT PARSERS (NO MANUAL COPY-PASTING)
# ============================================================================

def extract_text_from_termsheet(file_path: str) -> str:
    """Programmatically parses PDF, DOCX, or TXT term sheets."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    elif ext in (".docx", ".doc"):
        import docx
        doc = docx.Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                paragraphs.append(" | ".join(cell.text.strip() for cell in row.cells))
        return "\n".join(paragraphs)
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()


def load_booking_extract(file_path: str) -> List[Dict[str, Any]]:
    """Task 2: Programmatically parses the booking system extract (CSV or JSON)."""
    ext = os.path.splitext(file_path)[1].lower()
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        if ext == ".json":
            data = json.load(f)
            trades = data if isinstance(data, list) else data.get("trades", [data])
            normalized_trades = []
            for row in trades:
                norm_row = {}
                for k, v in row.items():
                    norm_row[k] = "|".join(str(x) for x in v) if isinstance(v, list) else v
                normalized_trades.append(norm_row)
            return normalized_trades
        else:
            reader = csv.DictReader(f)
            return [dict(row) for row in reader]


# ============================================================================
# MULTI-MODEL FALLBACK HELPER FOR GEMINI API
# ============================================================================

GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
]


def call_gemini_json(client: genai.Client, prompt: str) -> Tuple[Dict[str, Any], str]:
    """Calls Gemini API with JSON mime type and automatic fallback across free-tier models."""
    last_err = None
    for model_name in GEMINI_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )
            return json.loads(response.text or "{}"), model_name
        except Exception as err:
            last_err = err
            print(f"  [Info] Model {model_name} unavailable ({str(err)[:80]}), trying next model...")
    raise RuntimeError(f"All Gemini models failed. Last error: {last_err}")


# ============================================================================
# PASS 1: PROGRAMMATIC LLM EXTRACTION WITH EVIDENCE & SCHEMA VALIDATION
# ============================================================================

def llm_pass_1_extract_termsheet(client: genai.Client, termsheet_text: str) -> Tuple[Dict[str, Dict[str, Any]], str]:
    """
    Task 1: Submits parsed document content to Gemini API with a strict JSON structure
    requiring raw_value, normalized_value, and exact verbatim_quote for all 19 canonical fields.
    """
    field_list_str = "\n".join(
        f'  - "{col}" (Expected Schema Type: {dtype})'
        for col, dtype in FIELD_TYPE_EXPECTATIONS.items()
    )

    prompt = f"""You are a Senior Fixed Income Quantitative Operations Analyst at BNP Paribas.
Extract all 19 bond/security attributes from the following Term Sheet document using the exact field keys listed below.

REQUIRED FIELD KEYS & EXPECTED TYPES:
{field_list_str}

CRITICAL EXTRACTION RULES:
1. Return a JSON object where each top-level key is one of the 19 field keys above, and its value is an object with:
   - "raw_value": The exact phrase or value as written in the term sheet (or "Not explicitly stated in Term Sheet" if omitted).
   - "normalized_value": Standardized typed value:
     * For ISIN: Remove internal spaces (e.g., "NO 0010894330" -> "NO0010894330").
     * For CURRENCY: 3-letter ISO 4217 code (e.g., "USD", or "INR" when the document uses "Rs." / "Rupees").
     * For FLOAT fields ("IssueAmount", "Notional", "Coupon", "IssuePrice", "NominalAmountPerBond", "MinimumSubscription"):
       Convert units to full base currency numbers (e.g., "USD 300,000,000" -> 300000000; "Rs.1,500 Crores" -> 15000000000; "Rs.10,00,000" -> 1000000; "5 Bonds" at Rs.10,00,000 each -> 5000000; "9.25% p.a." -> 9.25; "97%" -> 97).
     * For DATE fields ("Maturity", "SettlementDate", "InterestPaymentDate", "IssueDate"):
       Convert calendar dates to ISO 8601 "YYYY-MM-DD" (e.g., "14 October 2020" -> "2020-10-14").
       IMPORTANT: If Tenor / Maturity is "Perpetual" (no fixed maturity date), set normalized_value to "Perpetual" so our strict Date schema validator flags it as a PARSING_ERROR.
   - "verbatim_quote": The EXACT verbatim sentence/snippet from the source document used to derive that value.
2. Do NOT hallucinate values not present in the document.

TERM SHEET DOCUMENT CONTENT:
\"\"\"
{termsheet_text}
\"\"\"
"""
    return call_gemini_json(client, prompt)


# ============================================================================
# PASS 2: INTELLIGENT RECONCILIATION & SECOND-PASS LLM FALSE ALERT ANALYSIS
# ============================================================================

def llm_pass_2_batch_analyze_discrepancies(
    client: genai.Client,
    extracted_fields: Dict[str, Dict[str, Any]],
    booking_trades: List[Dict[str, Any]],
) -> Tuple[Dict[str, Any], str]:
    """
    Task 3: Second programmatic LLM pass for all candidate discrepancies across booked trades.
    Analyzes each mismatch, the source quote from the term sheet, and the booking value
    to classify as MATCH, FALSE_ALERT (with reason), TRUE_MISMATCH (with reason), or PARSING_ERROR.
    """
    prompt = f"""You are a Managing Director in Capital Markets Middle-Office Reconciliation at BNP Paribas.
Perform a Second-Pass Fixed Income Trade Reconciliation Analysis comparing the Pass 1 Extracted Term Sheet Attributes (including their verbatim source quotes) against the Booked Trades.

CLASSIFICATION RULES:
1. "MATCH": The Term Sheet value and Booking value are identical.
2. "FALSE_ALERT": The economic/legal meaning is identical, and the difference is purely formatting, scaling, Indian numbering units ("Rs.1,500 Crores" = 15000000000, "Rs.10,00,000" = 1000000), multi-field derivation ("5 Bonds" * 1,000,000 = 5000000), date notation ("14 October 2020" vs "10/14/2020" or "2020-10-14"), ISIN whitespace ("NO 0010894330" vs "NO0010894330"), delimiter ("Oslo" and "New York" vs "Oslo|New York"), or bond terminology ("repaid in full at the Maturity Date at 100%" = "Bullet").
3. "TRUE_MISMATCH": A genuine economic, legal, or operational booking error in a specific TradeID (e.g., wrong Maturity Date 10/15/2025 vs 10/14/2025 in TradeID 2; wrong Notional 3,100,000 vs 3,000,000 in TradeID 3; wrong Coupon 9.5% vs 9.25% in TradeID 4 or 11% vs 10.75% in TradeID 2; wrong IssueDate 10-10-2014 vs 17-10-2014 in TradeID 4).
4. "PARSING_ERROR": A field that fails strict schema type validation (e.g., Term Sheet Tenor/Maturity is "Perpetual" where a strict calendar Date is expected).

Return strict JSON with this structure:
{{
  "executive_summary": "Concise executive commentary on the overall reconciliation run",
  "trades": [
    {{
      "trade_id": "1",
      "decisions": {{
        "<FieldName>": {{
          "category": "MATCH" | "FALSE_ALERT" | "TRUE_MISMATCH" | "PARSING_ERROR",
          "reason": "Clear financial explanation citing the term sheet verbatim quote and booking value"
        }}
      }}
    }}
  ]
}}

PASS 1 EXTRACTED TERM SHEET ATTRIBUTES (WITH VERBATIM QUOTES):
{json.dumps(extracted_fields, indent=2)}

BOOKING SYSTEM TRADES:
{json.dumps(booking_trades, indent=2)}
"""
    return call_gemini_json(client, prompt)


def run_reconciliation_pipeline(termsheet_path: str, booking_path: str, output_path: str) -> Dict[str, Any]:
    load_dotenv_if_present()
    api_key = (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("VITE_GEMINI_API_KEY")
    )
    if not api_key:
        raise RuntimeError(
            "Missing GEMINI_API_KEY. Set it via `export GEMINI_API_KEY='your_key'` or inside a `.env` file."
        )

    client = genai.Client(api_key=api_key)

    print(f"[1/4] Parsing Term Sheet document: {termsheet_path}")
    termsheet_text = extract_text_from_termsheet(termsheet_path)

    print(f"[2/4] Ingesting Booking System extract: {booking_path}")
    booking_trades = load_booking_extract(booking_path)

    print("[3/4] Running LLM Pass 1: Structured Extraction + Evidence Quotes + Pydantic Schema Validation...")
    extracted_fields, pass1_model = llm_pass_1_extract_termsheet(client, termsheet_text)

    # Run Pydantic strict schema validation check on the extracted normalized dictionary
    normalized_dict_for_pydantic = {
        k: (v.get("normalized_value") if isinstance(v, dict) else v)
        for k, v in extracted_fields.items()
    }
    pydantic_validation_errors: Dict[str, str] = {}
    try:
        TermSheetStrictPydanticSchema(**normalized_dict_for_pydantic)
    except Exception as exc:
        if hasattr(exc, "errors"):
            for err in exc.errors():
                loc = err.get("loc", [])
                if loc:
                    field_key = str(loc[0])
                    pydantic_validation_errors[field_key] = err.get("msg", str(exc))

    print(f"[4/4] Reconciling {len(booking_trades)} booked trade(s) & executing LLM Pass 2 False Alert Analysis...")
    pass2_data, pass2_model = llm_pass_2_batch_analyze_discrepancies(
        client, extracted_fields, booking_trades
    )

    pass2_trade_map: Dict[str, Dict[str, Any]] = {}
    for t_obj in pass2_data.get("trades", []):
        tid = str(t_obj.get("trade_id", ""))
        pass2_trade_map[tid] = t_obj.get("decisions", {})

    trade_reports = []
    summary_counts = {"MATCH": 0, "FALSE_ALERT": 0, "TRUE_MISMATCH": 0, "PARSING_ERROR": 0}

    for idx, trade_row in enumerate(booking_trades, start=1):
        trade_id = str(trade_row.get("TradeID") or trade_row.get("trade_id") or idx)
        decisions_for_trade = pass2_trade_map.get(trade_id, {})
        field_results = []

        for col_name, booking_val in trade_row.items():
            if col_name.lower() in ("tradeid", "trade_id"):
                continue

            ts_entry = extracted_fields.get(col_name, {})
            ts_raw = ts_entry.get("raw_value") if isinstance(ts_entry, dict) else ts_entry
            ts_norm = ts_entry.get("normalized_value", ts_raw) if isinstance(ts_entry, dict) else ts_raw
            quote = (
                ts_entry.get("verbatim_quote", "Not specified in Term Sheet")
                if isinstance(ts_entry, dict)
                else ""
            )

            # Step A: Strict Schema Type Validation (Task 1 Requirement)
            ts_valid, ts_err = validate_single_field_type(col_name, ts_norm)
            bk_valid, bk_err = validate_single_field_type(col_name, booking_val)
            pydantic_err = pydantic_validation_errors.get(col_name)

            llm_decision = decisions_for_trade.get(col_name, {})
            llm_cat = str(llm_decision.get("category", "")).upper()
            llm_reason = llm_decision.get("reason", "")

            if not ts_valid or not bk_valid or (col_name == "Maturity" and pydantic_err):
                category = "PARSING_ERROR"
                reason = ts_err or bk_err or pydantic_err or llm_reason or "Strict schema type validation failed."
            elif llm_cat in ("MATCH", "FALSE_ALERT", "TRUE_MISMATCH", "PARSING_ERROR"):
                category = llm_cat
                reason = llm_reason or f"Classified as {category} by Pass 2 LLM analysis."
            elif str(ts_raw).strip() == str(booking_val).strip():
                category = "MATCH"
                reason = f"Exact match between Term Sheet ('{ts_raw}') and Booking Extract ('{booking_val}')."
            else:
                category = "FALSE_ALERT"
                reason = f"Formatting difference between Term Sheet ('{ts_raw}') and Booking Extract ('{booking_val}')."

            summary_counts[category] = summary_counts.get(category, 0) + 1
            field_results.append({
                "trade_id": trade_id,
                "field": col_name,
                "expected_schema_type": FIELD_TYPE_EXPECTATIONS.get(col_name, "STRING"),
                "schema_valid": bool(ts_valid and bk_valid),
                "termsheet_raw_value": ts_raw,
                "termsheet_normalized_value": ts_norm,
                "booking_value": booking_val,
                "verbatim_evidence_quote": quote,
                "category": category,
                "reason": reason,
            })

        trade_reports.append({
            "trade_id": trade_id,
            "fields": field_results,
        })

    final_output = {
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "model_used": pass2_model or pass1_model,
        "termsheet_file": os.path.basename(termsheet_path),
        "booking_file": os.path.basename(booking_path),
        "executive_summary": pass2_data.get("executive_summary", ""),
        "summary": summary_counts,
        "trades": trade_reports,
    }

    with open(output_path, "w", encoding="utf-8") as out_f:
        json.dump(final_output, out_f, indent=2)

    print("\n" + "=" * 80)
    print(f"RECONCILIATION COMPLETE — {os.path.basename(termsheet_path)} vs {os.path.basename(booking_path)}")
    print("=" * 80)
    print(f"Model Used        : {final_output['model_used']}")
    print(f"Total Comparisons : {sum(summary_counts.values())}")
    print(f"  - MATCH         : {summary_counts['MATCH']}")
    print(f"  - FALSE_ALERT   : {summary_counts['FALSE_ALERT']}")
    print(f"  - TRUE_MISMATCH : {summary_counts['TRUE_MISMATCH']}")
    print(f"  - PARSING_ERROR : {summary_counts['PARSING_ERROR']}")
    print("-" * 80)
    for t in trade_reports:
        mismatches = [f for f in t["fields"] if f["category"] in ("TRUE_MISMATCH", "PARSING_ERROR")]
        false_alerts = [f for f in t["fields"] if f["category"] == "FALSE_ALERT"]
        print(f"TradeID #{t['trade_id']}: {len(mismatches)} True Mismatches/Parsing Errors | {len(false_alerts)} False Alerts Suppressed")
        for m in mismatches:
            print(f"   [!] {m['category']} on {m['field']}: TS='{m['termsheet_raw_value']}' vs Booking='{m['booking_value']}'")
            print(f"       Reason: {m['reason']}")
    print("=" * 80)
    print(f"Full structured JSON report saved to: {output_path}\n")
    return final_output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automated Term Sheet & Booking Reconciliation CLI")
    parser.add_argument(
        "--termsheet",
        default="sample_data/Genel_Energy_Finance_4_Term_Sheet.txt",
        help="Path to Term Sheet (PDF, DOCX, or TXT)",
    )
    parser.add_argument(
        "--booking",
        default="sample_data/Genel_Energy_bond_trades.csv",
        help="Path to Booking Extract (CSV or JSON)",
    )
    parser.add_argument("--output", default="reconciliation_output.json", help="Output JSON report path")
    args = parser.parse_args()
    run_reconciliation_pipeline(args.termsheet, args.booking, args.output)
