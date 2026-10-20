import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { TradeReconciliationReport } from '../types';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function generateCsvString(report: TradeReconciliationReport): string {
  const headers = [
    'TradeID',
    'BookingColumn',
    'FieldLabel',
    'ExpectedSchemaType',
    'TermSheetRawValue',
    'TermSheetNormalizedValue',
    'BookingSystemValue',
    'SchemaValid',
    'ReconciliationCategory',
    'LLMExplanationAndReason',
    'VerbatimQuoteFromTermSheet',
  ];

  const escapeCsv = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = report.tradeReconciliations.flatMap((trade) =>
    trade.fields.map((r) =>
      [
        r.tradeId,
        r.bookingHeader,
        r.label,
        r.expectedType,
        r.termSheetRaw,
        r.termSheetNormalized,
        r.bookingValue,
        r.schemaValid,
        r.status,
        r.reason,
        r.verbatimQuote,
      ]
        .map(escapeCsv)
        .join(',')
    )
  );

  return [headers.join(','), ...rows].join('\n');
}

export function downloadReportPdf(report: TradeReconciliationReport): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // BNP Paribas Top Header Banner
  doc.setFillColor(0, 128, 83); // #008053 BNP Paribas Emerald
  doc.rect(0, 0, pageWidth, 62, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('BNP PARIBAS — AI Insights & Term Sheet Reconciliation Report', 36, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `The bank for a changing world  |  Term Sheet: ${report.termSheetFileName}  |  Booking File: ${report.bookingFileName}  |  Executed: ${new Date(
      report.executedAt
    ).toLocaleString()}`,
    36,
    46
  );

  // Section 1: Quantitative Summary Table
  autoTable(doc, {
    startY: 78,
    margin: { left: 36, right: 36 },
    head: [
      [
        'Booked Trades Checked',
        'Total Comparisons',
        'Verified Matches',
        'False Alerts (With Reason)',
        'True Mismatches',
        'Parsing Errors',
      ],
    ],
    body: [
      [
        String(report.summary.totalTrades),
        String(report.summary.totalFieldComparisons),
        String(report.summary.matches),
        String(report.summary.falseAlerts),
        String(report.summary.trueMismatches),
        String(report.summary.parsingErrors),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [0, 92, 59],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 10,
      fontStyle: 'bold',
      textColor: [26, 26, 26],
    },
  });

  // Section 2: LLM Executive Insights & Commentary
  const afterSummaryY = (doc as any).lastAutoTable.finalY + 18;
  doc.setTextColor(0, 128, 83);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LLM Executive Insights & Reconciliation Commentary', 36, afterSummaryY);

  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const splitCommentary = doc.splitTextToSize(
    report.executiveAiCommentary || '',
    pageWidth - 72
  );
  doc.text(splitCommentary, 36, afterSummaryY + 15);

  let currentY = afterSummaryY + 15 + splitCommentary.length * 12 + 8;

  if (report.keyInsights.length > 0) {
    const insightRows = report.keyInsights.map((insight, index) => [
      `0${index + 1}`,
      insight,
    ]);
    autoTable(doc, {
      startY: currentY,
      margin: { left: 36, right: 36 },
      head: [['#', 'Key AI Insights & Operational Findings']],
      body: insightRows,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 128, 83],
        textColor: 255,
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 30, 30],
      },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: 'bold' },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 14;
  }

  // Trade-by-Trade AI Summary Table
  if (report.tradeReconciliations.length > 0) {
    const tradeSummaryRows = report.tradeReconciliations.map((t) => [
      `TradeID #${t.tradeId}`,
      `${t.counts.matches} Matches, ${t.counts.falseAlerts} False Alerts, ${t.counts.trueMismatches} True Mismatches`,
      t.tradeAiSummary,
    ]);
    autoTable(doc, {
      startY: currentY,
      margin: { left: 36, right: 36 },
      head: [['Booked Trade', 'Status Breakdown', 'LLM Trade-Level Insight']],
      body: tradeSummaryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 92, 59],
        textColor: 255,
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 30, 30],
      },
      columnStyles: {
        0: { cellWidth: 75, fontStyle: 'bold' },
        1: { cellWidth: 190 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 16;
  }

  // Section 3: Full Field-by-Field Reconciliation Table
  const tableRows = report.tradeReconciliations.flatMap((trade) =>
    trade.fields.map((r) => [
      `#${r.tradeId}`,
      r.bookingHeader,
      r.expectedType,
      String(r.termSheetRaw ?? '—'),
      String(r.bookingValue ?? '—'),
      r.status,
      r.reason,
    ])
  );

  autoTable(doc, {
    startY: currentY,
    margin: { left: 36, right: 36 },
    head: [
      [
        'Trade',
        'Field',
        'Type',
        'Term Sheet Extracted',
        'Booking Value',
        'Status',
        'LLM Explanation & Reason',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 92, 59],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [26, 26, 26],
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 95, fontStyle: 'bold' },
      2: { cellWidth: 48 },
      3: { cellWidth: 115 },
      4: { cellWidth: 95 },
      5: { cellWidth: 78, fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 5) {
        const val = String(hookData.cell.raw);
        if (val === 'TRUE_MISMATCH') {
          hookData.cell.styles.textColor = [185, 28, 28];
        } else if (val === 'FALSE_ALERT') {
          hookData.cell.styles.textColor = [180, 83, 9];
        } else if (val === 'PARSING_ERROR') {
          hookData.cell.styles.textColor = [67, 56, 202];
        } else if (val === 'MATCH') {
          hookData.cell.styles.textColor = [0, 128, 83];
        }
      }
    },
  });

  doc.save(
    `BNP_Paribas_AI_Insights_Report_${sanitizeFilename(report.termSheetFileName)}.pdf`
  );
}

export function downloadReportExcel(report: TradeReconciliationReport): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary & AI Insights
  const summaryRows: Array<Array<string | number>> = [
    ['BNP PARIBAS — TERM SHEET RECONCILIATION & AI INSIGHTS REPORT'],
    ['The bank for a changing world'],
    [],
    ['Reconciliation Metadata', 'Value'],
    ['Deal / Run Title', report.tradeTitle],
    ['Term Sheet File', `${report.termSheetFileName} (${report.termSheetFormat})`],
    ['Booking System File', `${report.bookingFileName} (${report.bookingFormat})`],
    ['LLM Engine Used', report.modelUsed],
    ['Executed Timestamp', report.executedAt],
    [],
    ['Quantitative Metric', 'Count'],
    ['Total Booked Trades Analyzed', report.summary.totalTrades],
    ['Total Field Comparisons', report.summary.totalFieldComparisons],
    ['Verified Matches (MATCH)', report.summary.matches],
    ['False Alerts With Reason (FALSE_ALERT)', report.summary.falseAlerts],
    ['True Economic Mismatches (TRUE_MISMATCH)', report.summary.trueMismatches],
    ['Strict Schema Parsing Errors (PARSING_ERROR)', report.summary.parsingErrors],
    [],
    ['LLM Executive Commentary'],
    [report.executiveAiCommentary],
    [],
    ['Key Insights Across Trades'],
    ...report.keyInsights.map((insight, idx) => [`0${idx + 1}`, insight]),
    [],
    ['TradeID', 'Trade AI Summary'],
    ...report.tradeReconciliations.map((t) => [`TradeID #${t.tradeId}`, t.tradeAiSummary]),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive AI Insights');

  // Sheet 2: Full Reconciliation Matrix
  const allMatrixRows = report.tradeReconciliations.flatMap((trade) =>
    trade.fields.map((r) => ({
      TradeID: r.tradeId,
      BookingColumn: r.bookingHeader,
      FieldLabel: r.label,
      ExpectedType: r.expectedType,
      TermSheetRaw: r.termSheetRaw ?? '',
      TermSheetNormalized: r.termSheetNormalized ?? '',
      BookingSystemValue: r.bookingValue ?? '',
      SchemaValid: r.schemaValid ? 'YES' : 'NO',
      SchemaValidationMessage: r.schemaValidationMessage ?? '',
      ReconciliationStatus: r.status,
      LLMExplanationAndReason: r.reason,
      VerbatimTermSheetQuote: r.verbatimQuote,
    }))
  );

  const wsAll = XLSX.utils.json_to_sheet(allMatrixRows);
  wsAll['!cols'] = [
    { wch: 10 },
    { wch: 24 },
    { wch: 26 },
    { wch: 14 },
    { wch: 26 },
    { wch: 22 },
    { wch: 22 },
    { wch: 12 },
    { wch: 44 },
    { wch: 18 },
    { wch: 58 },
    { wch: 52 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAll, 'All Field Comparisons');

  // Sheet 3: Discrepancies & Alerts Only
  const discrepancyRows = allMatrixRows.filter(
    (r) => r.ReconciliationStatus !== 'MATCH'
  );
  const wsDiscrepancies = XLSX.utils.json_to_sheet(
    discrepancyRows.length > 0
      ? discrepancyRows
      : [
          {
            Note: 'All fields across all trades matched with zero discrepancies.',
          },
        ]
  );
  wsDiscrepancies['!cols'] = wsAll['!cols'];
  XLSX.utils.book_append_sheet(wb, wsDiscrepancies, 'Discrepancies & Alerts');

  XLSX.writeFile(
    wb,
    `BNP_Paribas_Reconciliation_Workbook_${sanitizeFilename(report.termSheetFileName)}.xlsx`
  );
}

export function downloadReportCsv(report: TradeReconciliationReport): void {
  const csv = generateCsvString(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BNP_Paribas_Reconciliation_Result_${sanitizeFilename(
    report.termSheetFileName
  )}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
