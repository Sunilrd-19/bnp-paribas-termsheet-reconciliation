export type ReconciliationStatus =
  | 'MATCH'
  | 'FALSE_ALERT'
  | 'TRUE_MISMATCH'
  | 'PARSING_ERROR';

export type ExpectedDataType = 'ISIN' | 'CURRENCY' | 'FLOAT' | 'DATE' | 'STRING';

export interface FieldSchemaSpec {
  key: string;
  bookingHeader: string;
  label: string;
  expectedType: ExpectedDataType;
  description: string;
  unitHint?: string;
}

export interface ExtractedTermSheetAttribute {
  fieldKey: string;
  label: string;
  expectedType: ExpectedDataType;
  rawValue: string | null;
  normalizedValue: string | number | null;
  verbatimQuote: string;
  schemaValid: boolean;
  schemaValidationMessage: string;
}

export interface ReconciliationFieldResult {
  tradeId: number | string;
  fieldKey: string;
  bookingHeader: string;
  label: string;
  expectedType: ExpectedDataType;
  termSheetRaw: string | null;
  termSheetNormalized: string | number | null;
  bookingValue: string | number | null;
  verbatimQuote: string;
  schemaValid: boolean;
  schemaValidationMessage: string;
  initialComparisonMatch: boolean;
  status: ReconciliationStatus;
  reason: string;
  confidence: number;
}

export interface TradeRowReconciliation {
  tradeId: number | string;
  overallStatus: 'CLEAN' | 'HAS_FALSE_ALERTS' | 'HAS_TRUE_MISMATCHES' | 'HAS_PARSING_ERRORS';
  tradeAiSummary: string;
  counts: {
    totalFields: number;
    matches: number;
    falseAlerts: number;
    trueMismatches: number;
    parsingErrors: number;
  };
  fields: ReconciliationFieldResult[];
}

export interface TradeReconciliationReport {
  id: string;
  tradeTitle: string;
  termSheetFileName: string;
  termSheetFormat: 'PDF' | 'DOCX' | 'TXT';
  bookingFileName: string;
  bookingFormat: 'CSV' | 'JSON' | 'XML';
  executedAt: string;
  executionMode: 'LIVE_GEMINI_API' | 'PRECOMPUTED_BASELINE';
  modelUsed: string;
  pass1LatencyMs: number;
  pass2LatencyMs: number;
  termSheetFullText: string;
  bookingRawContent: string;
  executiveAiCommentary: string;
  keyInsights: string[];
  extractedTermSheetFields: ExtractedTermSheetAttribute[];
  summary: {
    totalTrades: number;
    totalFieldComparisons: number;
    matches: number;
    falseAlerts: number;
    trueMismatches: number;
    parsingErrors: number;
    accuracyScore: number;
  };
  tradeReconciliations: TradeRowReconciliation[];
}

export interface SampleScenario {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  termSheetFileName: string;
  termSheetFormat: 'PDF' | 'DOCX' | 'TXT';
  bookingFileName: string;
  bookingFormat: 'CSV' | 'JSON' | 'XML';
  description: string;
  termSheetText: string;
  bookingRaw: string;
  baselineReport: TradeReconciliationReport;
}
