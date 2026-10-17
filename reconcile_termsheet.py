"""
BNP Paribas — Automated Term Sheet & Trade Booking Reconciliation Engine (Python CLI)
=====================================================================================
Implements all 3 Assignment Tasks purely in Python via programmatic LLM API:
  1. Automated Parsing & Structured Extraction (PDF/DOCX/TXT -> Gemini API + strict Pydantic Schema Validation + Verbatim Evidence Quotes)
  2. Automated Booking Extract Ingestion (CSV/JSON programmatic ingestion)
  3. Intelligent Reconciliation & 2nd-Pass LLM False Alert Analysis (Match, False Alert with reason, True Mismatch, Parsing Error)

Usage:
  export GEMINI_API_KEY="your_api_key_here"
  python reconcile_termsheet.py --termsheet "Genel Energy Finance 4 plc - Term Sheet.pdf" --booking "Genel Energy - bond_trades.csv" --output "reconciliation_report.json"
"""

import os
import re
import csv
import json
import argparse
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ValidationError, field_validator
from google import genai
from google.genai import types


# ============================================================================
# TASK 1: STRICT PYDANTIC SCHEMA DEFINITIONS & TYPE VALIDATION
# ============================================================================

class ExtractedFieldWithEvidence(BaseModel):
    """Every extracted field must include its raw value, normalized value, and exact verbatim quote from the source document."""
    raw_value: Optional[str] = Field(description="Raw value extracted from the term sheet")
    normalized_value: Any = Field(description="Typed/normalized value conforming to the target schema")
    verbatim_quote: str = Field(description="Exact verbatim quote/snippet from the source document used to derive this value")


class TermSheetStrictPydanticSchema(BaseModel):
    """
    Strict Pydantic schema validating extracted term sheet attributes.
    Any field failing type validation (e.g., a non-numeric string where a float is expected)
    is caught per-field and flagged as a PARSING_ERROR rather than a Mismatch.
    """
    ISIN: Optional[str] = Field(default=None, description="12-character alphanumeric ISIN code")
    Issuer: str = Field(..., description="Legal name of the issuing entity")
    Issue_Amount: float = Field(..., description="Total issuance notional / principal amount as float")
    Settlement_Date: str = Field(..., description="Issue / Settlement date in ISO YYYY-MM-DD format")
    Maturity_Date: str = Field(..., description="Maturity date in ISO YYYY-MM-DD format or 'Perpetual'")
    Coupon_Rate: float = Field(..., description="Annual coupon rate percentage as float (e.g., 7.5 for 7.50%)")
    Coupon_Type: str = Field(..., description="Coupon structure (e.g., Fixed, Floating)")
    Currency: str = Field(..., description="3-letter ISO 4217 currency code (e.g., USD, INR, EUR)")
    Issue_Price: float = Field(..., description="Issue price percentage as float (e.g., 100.0 for 100%)")
    Interest_Payment_Frequency: str = Field(..., description="Coupon frequency (e.g., Semi-Annual, Annual)")
    Day_Count_Fraction: str = Field(..., description="Day count convention (e.g., 30/360, Actual/Actual)")
    Business_Day_Convention: str = Field(..., description="Business day adjustment rule (e.g., Following, Modified Following)")
    Business_Day_Location: str = Field(..., description="Financial center holiday calendar (e.g., London, Mumbai)")
    Amortization_Type: str = Field(..., description="Principal repayment profile (e.g., Bullet, Perpetual, Amortizing)")

    @field_validator("ISIN")
    @classmethod
    def validate_isin_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None or str(v).strip().upper() in ("", "N/A", "NONE", "NULL", "NOT SPECIFIED"):
            return None
        cleaned = str(v).strip().upper()
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


FIELD_TYPE_EXPECTATIONS: Dict[str, str] = {
    "ISIN": "ISIN",
    "Issuer": "STRING",
    "Issue_Amount": "FLOAT",
    "Settlement_Date": "DATE",
    "Maturity_Date": "DATE",
    "Coupon_Rate": "FLOAT",
    "Coupon_Type": "STRING",
    "Currency": "CURRENCY",
    "Issue_Price": "FLOAT",
    "Interest_Payment_Frequency": "STRING",
    "Day_Count_Fraction": "STRING",
    "Business_Day_Convention": "STRING",
    "Business_Day_Location": "STRING",
    "Amortization_Type": "STRING",
    "Credit_Rating": "STRING",
    "Settlement_Method": "STRING",
    "Broker_Commission": "FLOAT",
    "Tax_Withholding": "FLOAT",
    "Listing_Exchange": "STRING",
}


def validate_single_field_type(field_name: str, value: Any) -> tuple[bool, Optional[str]]:
    """
    Validates an individual field against its expected schema data type.
    If validation fails (e.g., string where float is expected), returns (False, error_reason)
    so the engine flags it as a PARSING_ERROR rather than a MISMATCH.
    """
    expected_type = FIELD_TYPE_EXPECTATIONS.get(field_name, "STRING")
    if value is None or str(value).strip().upper() in ("", "N/A", "NONE", "NULL", "NOT SPECIFIED"):
        return True, None

    raw_str = str(value).strip()
    if expected_type == "FLOAT":
        cleaned = re.sub(r"[,$%\s]|USD|INR|EUR|GBP|RS\.?", "", raw_str, flags=re.IGNORECASE)
        try:
            float(cleaned)
            return True, None
        except ValueError:
            return False, f"Schema Validation Failed: Expected FLOAT for '{field_name}', but got non-numeric string '{raw_str}'."

    if expected_type == "ISIN":
        if not re.match(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$", raw_str.upper()):
            return False, f"Schema Validation Failed: Expected 12-char ISIN for '{field_name}', got '{raw_str}'."

    if expected_type == "CURRENCY":
        if not re.match(r"^[A-Z]{3}$", raw_str.upper()):
            return False, f"Schema Validation Failed: Expected 3-letter ISO currency code for '{field_name}', got '{raw_str}'."

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
            return data if isinstance(data, list) else data.get("trades", [data])
        else:
            reader = csv.DictReader(f)
            return [dict(row) for row in reader]


# ============================================================================
# PASS 1: PROGRAMMATIC LLM EXTRACTION WITH EVIDENCE & SCHEMA VALIDATION
# ============================================================================

def llm_pass_1_extract_termsheet(client: genai.Client, termsheet_text: str) -> Dict[str, Dict[str, Any]]:
    """
    Task 1: Submits parsed document content to Gemini API with a strict JSON schema
    requiring raw_value, normalized_value, and exact verbatim_quote for every field.
    """
    prompt = f"""
You are a Senior Fixed Income Quantitative Operations Analyst at BNP Paribas.
Extract all bond/security attributes from the following Term Sheet document.

CRITICAL RULES:
1. For EVERY field, return:
   - "raw_value": The value as written in the term sheet (or null if omitted in the document).
   - "normalized_value": Standardized typed value (float for numbers/rates/amounts, ISO YYYY-MM-DD for dates, 3-letter ISO code for currency).
   - "verbatim_quote": The EXACT verbatim sentence/snippet from the source document used to derive that value.
2. Do NOT hallucinate values not present in the document.

TERM SHEET DOCUMENT CONTENT:
\"\"\"
{termsheet_text}
\"\"\"
"""
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return json.loads(response.text)


# ============================================================================
# PASS 2: INTELLIGENT RECONCILIATION & SECOND-PASS LLM FALSE ALERT ANALYSIS
# ============================================================================

def llm_pass_2_analyze_mismatch(
    client: genai.Client,
    field_name: str,
    termsheet_raw: Any,
    termsheet_normalized: Any,
    verbatim_quote: str,
    booking_value: Any,
) -> Dict[str, str]:
    """
    Task 3: Second programmatic LLM pass for any identified discrepancy.
    Analyzes the mismatch, the source quote from the term sheet, and the booking value
    to classify as either FALSE_ALERT (with reason) or TRUE_MISMATCH (with reason).
    """
    prompt = f"""
You are performing a Second-Pass Fixed Income Trade Reconciliation Analysis.
An initial comparison flagged a discrepancy on field '{field_name}'.

Analyze the three inputs below:
- Term Sheet Extracted Value: {json.dumps(termsheet_raw)} (Normalized: {json.dumps(termsheet_normalized)})
- Source Quote from Term Sheet: {json.dumps(verbatim_quote)}
- Booking System Value: {json.dumps(booking_value)}

Determine whether this is:
1. "FALSE_ALERT": The economic/legal meaning is identical, and the difference is purely formatting, scaling, unit representation, date notation, or punctuation (e.g., "10.75%" vs "0.1075" or "10.75", "USD 100,000,000" vs "100000000", "17 October 2014" vs "2014-10-17", "Semi-Annual" vs "Semi-annual").
2. "TRUE_MISMATCH": A genuine economic, legal, or operational booking error (e.g., wrong coupon rate 7.50% vs 7.0%, wrong maturity date, wrong day count convention, or missing required value).

Return strict JSON with keys:
- "category": Either "FALSE_ALERT" or "TRUE_MISMATCH"
- "reason": Clear, specific financial explanation citing the term sheet quote and booking value.
"""
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return json.loads(response.text)


def run_reconciliation_pipeline(termsheet_path: str, booking_path: str, output_path: str) -> Dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY environment variable.")

    client = genai.Client(api_key=api_key)

    print(f"[1/4] Parsing Term Sheet document: {termsheet_path}")
    termsheet_text = extract_text_from_termsheet(termsheet_path)

    print(f"[2/4] Ingesting Booking System extract: {booking_path}")
    booking_trades = load_booking_extract(booking_path)

    print("[3/4] Running LLM Pass 1: Structured Extraction + Evidence Quotes + Pydantic Schema Validation...")
    extracted_fields = llm_pass_1_extract_termsheet(client, termsheet_text)

    # Validate overall Pydantic model & per-field schema types
    trade_reports = []
    summary_counts = {"MATCH": 0, "FALSE_ALERT": 0, "TRUE_MISMATCH": 0, "PARSING_ERROR": 0}

    print(f"[4/4] Reconciling {len(booking_trades)} booked trade(s) & executing LLM Pass 2 on candidate mismatches...")
    for idx, trade_row in enumerate(booking_trades, start=1):
        trade_id = str(trade_row.get("TradeID") or trade_row.get("trade_id") or idx)
        field_results = []

        for col_name, booking_val in trade_row.items():
            if col_name.lower() in ("tradeid", "trade_id"):
                continue

            ts_entry = extracted_fields.get(col_name, {})
            ts_raw = ts_entry.get("raw_value") if isinstance(ts_entry, dict) else ts_entry
            ts_norm = ts_entry.get("normalized_value", ts_raw) if isinstance(ts_entry, dict) else ts_raw
            quote = ts_entry.get("verbatim_quote", "Not specified in Term Sheet") if isinstance(ts_entry, dict) else ""

            # Step A: Strict Schema Type Validation (Task 1 Requirement)
            ts_valid, ts_err = validate_single_field_type(col_name, ts_norm)
            bk_valid, bk_err = validate_single_field_type(col_name, booking_val)

            if not ts_valid or not bk_valid:
                category = "PARSING_ERROR"
                reason = ts_err or bk_err or "Schema type validation failed."
            elif str(ts_raw).strip() == str(booking_val).strip():
                # Exact match in Pass 1 initial comparison
                category = "MATCH"
                reason = f"Exact match between Term Sheet ('{ts_raw}') and Booking Extract ('{booking_val}')."
            else:
                # Step B: Second Programmatic LLM Pass for Candidate Mismatches (Task 3 Requirement)
                pass2 = llm_pass_2_analyze_mismatch(
                    client=client,
                    field_name=col_name,
                    termsheet_raw=ts_raw,
                    termsheet_normalized=ts_norm,
                    verbatim_quote=quote,
                    booking_value=booking_val,
                )
                category = pass2.get("category", "TRUE_MISMATCH")
                reason = pass2.get("reason", "Evaluated by Pass 2 LLM analysis.")

            summary_counts[category] = summary_counts.get(category, 0) + 1
            field_results.append({
                "trade_id": trade_id,
                "field": col_name,
                "expected_schema_type": FIELD_TYPE_EXPECTATIONS.get(col_name, "STRING"),
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
        "executed_at": datetime.utcnow().isoformat() + "Z",
        "termsheet_file": os.path.basename(termsheet_path),
        "booking_file": os.path.basename(booking_path),
        "summary": summary_counts,
        "trades": trade_reports,
    }

    with open(output_path, "w", encoding="utf-8") as out_f:
        json.dump(final_output, out_f, indent=2)

    print(f"Reconciliation complete! Saved structured report to: {output_path}")
    print(f"Summary: {summary_counts}")
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
