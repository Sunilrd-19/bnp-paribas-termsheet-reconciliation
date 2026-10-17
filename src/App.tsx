import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Database,
  Play,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Download,
  Search,
  RefreshCw,
  MessageSquareText,
  Layers,
  Check,
  FileCheck2,
  Trash2,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import {
  ReconciliationFieldResult,
  ReconciliationStatus,
  TradeReconciliationReport,
  TradeRowReconciliation,
} from './types';
import {
  downloadReportCsv,
  downloadReportExcel,
  downloadReportPdf,
} from './utils/exportRepoZip';
import { ReconciliationAnalyticsDashboard } from './components/ReconciliationAnalyticsDashboard';

type StatusFilter = 'ALL' | ReconciliationStatus;

const RUNNING_MESSAGES = [
  {
    headline: 'Reading & Structuring Your Trade Term Sheet...',
    subtext: 'Extracting key economic attributes, coupon schedules, and verbatim document quotes.',
  },
  {
    headline: 'Validating Extracted Fields Against Strict Schema Rules...',
    subtext: 'Checking ISO 6166 ISINs, currencies, numeric floats, and calendar dates.',
  },
  {
    headline: 'Cross-Checking Every Booked Trade Record...',
    subtext: 'Distinguishing harmless formatting differences (False Alerts) from True Economic Mismatches.',
  },
  {
    headline: 'Synthesizing Executive AI Insights & Audit Commentary...',
    subtext: 'Preparing your downloadable reconciliation report and trade-by-trade findings.',
  },
];

function BnpParibasLogo() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-10 h-10 rounded-md shadow-xs shrink-0"
      aria-label="BNP Paribas Logo"
    >
      <defs>
        <linearGradient id="bnpBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#009B65" />
          <stop offset="50%" stopColor="#008053" />
          <stop offset="100%" stopColor="#005C3B" />
        </linearGradient>
        <linearGradient id="bnpGloss" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.32" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Green rounded square base */}
      <rect x="2" y="2" width="96" height="96" rx="12" fill="url(#bnpBgGrad)" />
      {/* Subtle top gloss curve matching official emblem */}
      <path
        d="M 8 6 H 92 A 6 6 0 0 1 96 12 V 42 Q 50 54 4 42 V 12 A 6 6 0 0 1 8 6 Z"
        fill="url(#bnpGloss)"
      />
      {/* Star 1 (Bottom-Left) */}
      <path
        d="M 16 58 L 21 69 L 28 68 L 24 75 L 33 80 L 22 79 L 24 86 L 18 78 L 10 74 Z"
        fill="#FFFFFF"
      />
      {/* Star 2 (Bottom-Center) */}
      <path
        d="M 52 74 L 54 79 L 60 74 L 53 83 L 45 84 L 39 88 L 43 82 L 38 81 L 47 79 Z"
        fill="#FFFFFF"
      />
      {/* Star 3 (Middle-Left curving upward) */}
      <path
        d="M 18 36 Q 30 33 36 35 L 42 30 L 40 36 Q 50 38 56 41 Q 44 40 37 42 L 34 54 L 30 43 Q 23 48 17 54 Q 22 45 27 39 Z"
        fill="#FFFFFF"
      />
      {/* Star 4 (Top-Right bird/star soaring) */}
      <path
        d="M 57 11 Q 72 13 80 18 L 90 17 L 85 22 Q 86 32 81 44 Q 81 31 78 24 L 64 33 L 71 23 Q 59 24 50 26 Q 61 20 72 19 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export default function App() {
  // Day / Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Export Dropdown State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement | null>(null);

  // LLM Executive Insights Collapse State
  const [isInsightsCollapsed, setIsInsightsCollapsed] = useState<boolean>(false);

  // Uploaded Document States (Clean zero-state — no pre-uploaded documents)
  const [termSheetFileName, setTermSheetFileName] = useState<string>('');
  const [termSheetFormat, setTermSheetFormat] = useState<'PDF' | 'DOCX' | 'TXT'>('PDF');
  const [termSheetText, setTermSheetText] = useState<string>('');

  const [bookingFileName, setBookingFileName] = useState<string>('');
  const [bookingFormat, setBookingFormat] = useState<'CSV' | 'JSON' | 'XML'>('CSV');
  const [bookingRawContent, setBookingRawContent] = useState<string>('');
  const [bookingTradesCount, setBookingTradesCount] = useState<number>(0);

  // Active Reconciliation Report (null until user runs analysis)
  const [report, setReport] = useState<TradeReconciliationReport | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<number | 'ALL'>('ALL');
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>('coupon');
  const [selectedInspectorTradeId, setSelectedInspectorTradeId] = useState<number | string>(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Execution & Animation states
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runningStepIndex, setRunningStepIndex] = useState<number>(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [uploadingRole, setUploadingRole] = useState<'termsheet' | 'booking' | null>(null);

  // Subtle Toast Notification state
  const [toastNotification, setToastNotification] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const triggerToast = (title: string, subtitle: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastNotification({ title, subtitle });
    toastTimerRef.current = window.setTimeout(() => {
      setToastNotification(null);
    }, 6500);
  };

  const termSheetInputRef = useRef<HTMLInputElement | null>(null);
  const bookingInputRef = useRef<HTMLInputElement | null>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cycle catchy animation messages while analysis is running
  useEffect(() => {
    if (!isRunning) {
      setRunningStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setRunningStepIndex((prev) => (prev + 1) % RUNNING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    role: 'termsheet' | 'booking'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingRole(role);
    setErrorBanner(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      const response = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          base64Data,
          role,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to parse ${file.name}`);
      }

      if (role === 'termsheet') {
        setTermSheetFileName(data.fileName);
        setTermSheetFormat(data.format);
        setTermSheetText(data.extractedText);
      } else {
        setBookingFileName(data.fileName);
        setBookingFormat(data.format);
        setBookingRawContent(data.rawText);
        setBookingTradesCount(data.tradesCount || 1);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Error parsing uploaded document.');
    } finally {
      setUploadingRole(null);
      event.target.value = '';
    }
  };

  const handleClearDocuments = () => {
    setTermSheetFileName('');
    setTermSheetText('');
    setBookingFileName('');
    setBookingRawContent('');
    setBookingTradesCount(0);
    setReport(null);
    setErrorBanner(null);
  };

  const handleRunLiveReconciliation = async () => {
    if (!termSheetText.trim() || !bookingRawContent.trim()) {
      setErrorBanner(
        'Please upload both a Trade Term Sheet (PDF/DOCX) and a Booking System Extract (CSV/JSON/XML) before running analysis.'
      );
      return;
    }

    setIsRunning(true);
    setErrorBanner(null);

    try {
      const response = await fetch('/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeTitle: `${termSheetFileName} vs ${bookingFileName}`,
          termSheetFileName,
          termSheetFormat,
          termSheetText,
          bookingFileName,
          bookingRawContent,
        }),
      });

      const data: TradeReconciliationReport = await response.json();
      if (!response.ok) {
        throw new Error((data as any).error || 'Reconciliation request failed.');
      }

      setReport(data);
      setStatusFilter('ALL');
      setSelectedTradeId('ALL');
      triggerToast(
        'Reconciliation Report & AI Insights Ready',
        `Analyzed ${data.summary.totalTrades} trade(s) (${data.summary.totalFieldComparisons} comparisons). Click "Download Report & Insights" to export in PDF, Excel (.xlsx), or CSV.`
      );

      const firstTradeWithMismatch =
        data.tradeReconciliations.find((t) => t.counts.trueMismatches > 0) ||
        data.tradeReconciliations[0];
      if (firstTradeWithMismatch) {
        setSelectedInspectorTradeId(firstTradeWithMismatch.tradeId);
        const firstAnomaly =
          firstTradeWithMismatch.fields.find((r) => r.status === 'TRUE_MISMATCH') ||
          firstTradeWithMismatch.fields.find((r) => r.status !== 'MATCH') ||
          firstTradeWithMismatch.fields[0];
        if (firstAnomaly) {
          setSelectedFieldKey(firstAnomaly.fieldKey);
        }
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to execute LLM reconciliation.');
    } finally {
      setIsRunning(false);
    }
  };

  const activeTradeRow: TradeRowReconciliation | undefined = useMemo(() => {
    if (!report || selectedTradeId === 'ALL') return undefined;
    return (
      report.tradeReconciliations.find((t) => Number(t.tradeId) === Number(selectedTradeId)) ||
      report.tradeReconciliations[0]
    );
  }, [report, selectedTradeId]);

  const displayedFields: ReconciliationFieldResult[] = useMemo(() => {
    if (!report) return [];
    const baseList =
      selectedTradeId === 'ALL'
        ? report.tradeReconciliations.flatMap((t) => t.fields)
        : activeTradeRow?.fields || [];

    return baseList.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          row.label.toLowerCase().includes(q) ||
          row.bookingHeader.toLowerCase().includes(q) ||
          String(row.termSheetRaw || '').toLowerCase().includes(q) ||
          String(row.bookingValue || '').toLowerCase().includes(q) ||
          row.reason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [report, selectedTradeId, activeTradeRow, statusFilter, searchQuery]);

  const selectedRow = useMemo(() => {
    if (!report) return null;
    const allFields = report.tradeReconciliations.flatMap((t) => t.fields);
    return (
      allFields.find(
        (r) =>
          r.fieldKey === selectedFieldKey &&
          String(r.tradeId) === String(selectedInspectorTradeId)
      ) ||
      displayedFields[0] ||
      allFields[0] ||
      null
    );
  }, [report, selectedFieldKey, selectedInspectorTradeId, displayedFields]);

  const renderStatusIndicator = (status: ReconciliationStatus) => {
    switch (status) {
      case 'MATCH':
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
            }`}
          >
            <CheckCircle2
              className={`w-3.5 h-3.5 shrink-0 ${
                isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
              }`}
            />
            Match
          </span>
        );
      case 'FALSE_ALERT':
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              isDarkMode ? 'text-amber-400' : 'text-amber-700'
            }`}
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 shrink-0 ${
                isDarkMode ? 'text-amber-400' : 'text-amber-600'
              }`}
            />
            False Alert
          </span>
        );
      case 'TRUE_MISMATCH':
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              isDarkMode ? 'text-red-400' : 'text-red-700'
            }`}
          >
            <XCircle
              className={`w-3.5 h-3.5 shrink-0 ${
                isDarkMode ? 'text-red-400' : 'text-red-600'
              }`}
            />
            True Mismatch
          </span>
        );
      case 'PARSING_ERROR':
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              isDarkMode ? 'text-indigo-400' : 'text-indigo-700'
            }`}
          >
            <ShieldAlert
              className={`w-3.5 h-3.5 shrink-0 ${
                isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
              }`}
            />
            Parsing Error
          </span>
        );
    }
  };

  const canRunAnalysis = Boolean(termSheetText.trim() && bookingRawContent.trim());

  // Theme surface classes
  const pageBg = isDarkMode ? 'bg-[#0B111E] text-slate-100' : 'bg-[#F4F6F8] text-[#1A1A1A]';
  const cardBg = isDarkMode
    ? 'bg-[#111C2D] border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-[#1A1A1A]';
  const subCardBg = isDarkMode
    ? 'bg-[#0F172A] border-slate-800 text-slate-200'
    : 'bg-[#F4F6F8] border-slate-200 text-slate-800';
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const headingText = isDarkMode ? 'text-white' : 'text-[#1A1A1A]';

  const currentRunningMsg = RUNNING_MESSAGES[runningStepIndex];

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${pageBg}`}>
      {/* BNP Paribas Signature Top Accent Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#008053] via-[#00965E] to-[#005C3B]" />

      {/* BNP Paribas Corporate Header with Logo + Tagline Below on Left, Day/Dark Mode on Right */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between gap-8 px-8 py-3.5 border-b shadow-2xs transition-colors ${
          isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Top-Left Brand Lockup: BNP Logo + BNP PARIBAS + "The bank for a changing world" below */}
        <a
          href="/"
          onClick={(e) => e.preventDefault()}
          className="flex items-center gap-3.5 shrink-0"
        >
          <BnpParibasLogo />
          <div className="flex flex-col">
            <span
              className={`text-xl font-bold tracking-tight font-display leading-none ${
                isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
              }`}
            >
              BNP PARIBAS
            </span>
            <span className={`text-[11px] font-medium mt-1 leading-none ${mutedText}`}>
              The bank for a changing world
            </span>
          </div>
        </a>

        {/* Right Top Corner: Day / Night Sliding Toggle (Icons Only) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={isDarkMode}
            aria-label="Toggle theme"
            onClick={() => setIsDarkMode((prev) => !prev)}
            className={`relative inline-flex h-8 w-15 items-center rounded-full p-1 transition-colors duration-300 cursor-pointer border ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700'
                : 'bg-slate-200/80 border-slate-300'
            }`}
          >
            {/* Background Track Icons */}
            <span className="flex w-full items-center justify-between px-1">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <Moon className="w-3.5 h-3.5 text-slate-400" />
            </span>

            {/* Sliding Thumb with Active Symbol */}
            <span
              className={`absolute top-0.5 left-0.5 flex h-6.5 w-6.5 items-center justify-center rounded-full shadow-xs transition-transform duration-300 ${
                isDarkMode
                  ? 'translate-x-7 bg-[#008053] text-white'
                  : 'translate-x-0 bg-white text-amber-500'
              }`}
            >
              {isDarkMode ? (
                <Moon className="w-3.5 h-3.5" />
              ) : (
                <Sun className="w-3.5 h-3.5" />
              )}
            </span>
          </button>
        </div>
      </header>

      {/* BNP Paribas Corporate Hero Banner */}
      <section className="bg-gradient-to-r from-[#005C3B] via-[#008053] to-[#00965E] text-white border-b border-[#004D31]">
        <div className="max-w-[1440px] mx-auto px-8 py-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium tracking-wider uppercase text-emerald-100">
              Capital Markets · Global Markets Operations · APAC Solutions
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-white">
              LLM-Powered Term Sheet Reconciliation
            </h1>
          </div>

          {/* Single Unified Report Download Dropdown (Visible once analysis is complete) */}
          {report && (
            <div ref={exportDropdownRef} className="relative shrink-0">
              <button
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-[#005C3B] bg-white rounded-sm hover:bg-emerald-50 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download Report & Insights
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    isExportMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isExportMenuOpen && (
                <div
                  className={`absolute right-0 mt-2 w-72 rounded-sm border shadow-lg z-40 py-1 ${
                    isDarkMode
                      ? 'bg-[#111C2D] border-slate-700 text-slate-100'
                      : 'bg-white border-slate-200 text-[#1A1A1A]'
                  }`}
                >
                  <button
                    onClick={() => {
                      downloadReportPdf(report);
                      setIsExportMenuOpen(false);
                      triggerToast(
                        'AI Insights Report (.pdf) Downloaded',
                        'Exported Executive AI Insights, Trade Summaries & Reconciliation Table (.pdf).'
                      );
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-[#008053] shrink-0" />
                    <div>
                      <div className="font-semibold">AI Insights Report (.pdf)</div>
                      <div className={`text-[11px] ${mutedText}`}>
                        Executive LLM commentary, trade insights & audit table
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      downloadReportExcel(report);
                      setIsExportMenuOpen(false);
                      triggerToast(
                        'Excel Workbook (.xlsx) Downloaded',
                        'Exported 3-sheet Excel workbook with AI Insights & Discrepancies.'
                      );
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 transition-colors cursor-pointer border-t ${
                      isDarkMode
                        ? 'border-slate-800 hover:bg-slate-800'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#008053] shrink-0" />
                    <div>
                      <div className="font-semibold">Excel Multi-Sheet Workbook (.xlsx)</div>
                      <div className={`text-[11px] ${mutedText}`}>
                        3 sheets: AI Summary, All Fields & Discrepancies
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      downloadReportCsv(report);
                      setIsExportMenuOpen(false);
                      triggerToast(
                        'CSV Report (.csv) Downloaded',
                        'Exported flat reconciliation table (.csv).'
                      );
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 transition-colors cursor-pointer border-t ${
                      isDarkMode
                        ? 'border-slate-800 hover:bg-slate-800'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 text-[#008053] shrink-0" />
                    <div>
                      <div className="font-semibold">CSV Reconciliation Table (.csv)</div>
                      <div className={`text-[11px] ${mutedText}`}>
                        Spreadsheet with all fields, statuses & reasons
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-8 py-8 space-y-6">
        {/* Top Animated Banner While Analysis is Running */}
        {isRunning && (
          <div className="relative overflow-hidden rounded-sm bg-gradient-to-r from-[#004D31] via-[#008053] to-[#006642] text-white p-6 shadow-md border border-emerald-400/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-white/15 border border-white/25 shrink-0">
                  <RefreshCw className="w-6 h-6 text-white animate-spin" />
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-200">
                    AI Reconciliation Engine Active · Step 0{runningStepIndex + 1} of 04
                  </div>
                  <h3 className="text-lg font-bold text-white mt-0.5 transition-opacity duration-200">
                    {currentRunningMsg.headline}
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    {currentRunningMsg.subtext}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-center">
                {RUNNING_MESSAGES.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === runningStepIndex
                        ? 'w-8 bg-white'
                        : idx < runningStepIndex
                        ? 'w-2.5 bg-emerald-300'
                        : 'w-2.5 bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Centered Upload & Analysis Card */}
        <div className={`border rounded-sm p-6 shadow-2xs transition-colors ${cardBg}`}>
          <div
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 mb-5 border-b ${
              isDarkMode ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <div>
              <h2 className={`text-base font-bold ${headingText}`}>
                Document Upload & Reconciliation Analysis
              </h2>
              <p className={`text-xs mt-0.5 ${mutedText}`}>
                Upload the Trade Term Sheet and Booking System Extract below, then click{' '}
                <strong>Run Reconciliation Analysis</strong>.
              </p>
            </div>
            {(termSheetFileName || bookingFileName) && (
              <button
                onClick={handleClearDocuments}
                className={`inline-flex items-center gap-1.5 text-xs font-medium hover:text-red-500 transition-colors cursor-pointer self-start sm:self-auto ${mutedText}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Uploaded Files
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Step 1: Upload Trade Term Sheet */}
            <div
              onClick={() => termSheetInputRef.current?.click()}
              className={`p-5 rounded-sm border-2 border-dashed transition-colors cursor-pointer flex flex-col justify-between ${
                termSheetFileName
                  ? 'border-[#008053] bg-[#008053]/10'
                  : isDarkMode
                  ? 'border-slate-700 hover:border-[#008053] bg-[#0F172A]'
                  : 'border-slate-300 hover:border-[#008053] bg-slate-50/60'
              }`}
            >
              <input
                ref={termSheetInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'termsheet')}
              />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                    }`}
                  >
                    Step 01 · Trade Term Sheet
                  </span>
                  {termSheetFileName ? (
                    <FileCheck2
                      className={`w-5 h-5 ${
                        isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                      }`}
                    />
                  ) : (
                    <Upload className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className={`text-sm font-bold ${headingText}`}>
                  {uploadingRole === 'termsheet'
                    ? 'Parsing Term Sheet Document...'
                    : termSheetFileName
                    ? termSheetFileName
                    : 'Click to Upload Term Sheet'}
                </div>
                <p className={`text-xs mt-1 ${mutedText}`}>
                  Supported formats: <strong>PDF (.pdf)</strong>, <strong>Word (.docx)</strong>, or Text (.txt)
                </p>
              </div>

              <div
                className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200/80'
                }`}
              >
                {termSheetFileName ? (
                  <span
                    className={`font-medium flex items-center gap-1 ${
                      isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Parsed ({termSheetFormat})
                  </span>
                ) : (
                  <span className={mutedText}>Awaiting document upload</span>
                )}
                <span
                  className={`font-semibold underline ${
                    isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                  }`}
                >
                  Browse File
                </span>
              </div>
            </div>

            {/* Step 2: Upload Booking System Extract */}
            <div
              onClick={() => bookingInputRef.current?.click()}
              className={`p-5 rounded-sm border-2 border-dashed transition-colors cursor-pointer flex flex-col justify-between ${
                bookingFileName
                  ? 'border-[#008053] bg-[#008053]/10'
                  : isDarkMode
                  ? 'border-slate-700 hover:border-[#008053] bg-[#0F172A]'
                  : 'border-slate-300 hover:border-[#008053] bg-slate-50/60'
              }`}
            >
              <input
                ref={bookingInputRef}
                type="file"
                accept=".csv,.json,.xml,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'booking')}
              />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                    }`}
                  >
                    Step 02 · Booking System Extract
                  </span>
                  {bookingFileName ? (
                    <FileCheck2
                      className={`w-5 h-5 ${
                        isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                      }`}
                    />
                  ) : (
                    <Database className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className={`text-sm font-bold ${headingText}`}>
                  {uploadingRole === 'booking'
                    ? 'Ingesting Booking Records...'
                    : bookingFileName
                    ? bookingFileName
                    : 'Click to Upload Booking Extract'}
                </div>
                <p className={`text-xs mt-1 ${mutedText}`}>
                  Supported formats: <strong>CSV (.csv)</strong>, <strong>JSON (.json)</strong>, or XML (.xml)
                </p>
              </div>

              <div
                className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200/80'
                }`}
              >
                {bookingFileName ? (
                  <span
                    className={`font-medium flex items-center gap-1 ${
                      isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Ingested ({bookingFormat} · {bookingTradesCount} Trade
                    {bookingTradesCount === 1 ? '' : 's'})
                  </span>
                ) : (
                  <span className={mutedText}>Awaiting booking file upload</span>
                )}
                <span
                  className={`font-semibold underline ${
                    isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                  }`}
                >
                  Browse File
                </span>
              </div>
            </div>

            {/* Step 3: Run Reconciliation Analysis */}
            <div
              className={`p-5 rounded-sm border flex flex-col justify-between ${
                isDarkMode
                  ? 'bg-[#0F172A] border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <div
                  className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                    isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                  }`}
                >
                  Step 03 · Analysis & Report
                </div>
                <div className={`text-sm font-bold ${headingText}`}>
                  Start Reconciliation
                </div>
                <p className={`text-xs mt-1 ${mutedText}`}>
                  Compare the uploaded Term Sheet and Booking Extract to view matches, discrepancies, and AI insights.
                </p>
              </div>

              <button
                onClick={handleRunLiveReconciliation}
                disabled={isRunning || !canRunAnalysis}
                className="mt-4 w-full py-3 px-4 bg-[#008053] hover:bg-[#006642] disabled:bg-slate-400/40 text-white font-semibold text-xs rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-xs"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Running Analysis...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Run Reconciliation Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorBanner && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-sm flex items-center justify-between gap-4 text-xs text-red-500">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-xs font-semibold underline whitespace-nowrap cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Empty State Before Running Analysis */}
        {!report && !isRunning && (
          <div className={`border rounded-sm p-12 text-center space-y-2.5 ${cardBg}`}>
            <div className="w-12 h-12 rounded-full bg-[#008053]/15 text-[#008053] flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className={`text-base font-bold ${headingText}`}>
              Ready for Analysis
            </h3>
            <p className={`text-xs max-w-md mx-auto leading-relaxed ${mutedText}`}>
              Upload your Term Sheet document and Booking System file above, then click{' '}
              <strong>Run Reconciliation Analysis</strong> to generate the full comparison report and LLM commentary.
            </p>
          </div>
        )}

        {/* Unified Results View */}
        {report && (
          <div className="space-y-6">
            {/* 5-Column Quantitative Summary Strip */}
            <div className={`grid grid-cols-2 sm:grid-cols-5 gap-4 border rounded-sm p-5 shadow-2xs ${cardBg}`}>
              <div
                className={`pr-4 sm:border-r ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <div className={`text-xs font-medium ${mutedText}`}>Booked Trades Checked</div>
                <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${headingText}`}>
                  {report.summary.totalTrades}{' '}
                  {report.summary.totalTrades === 1 ? 'Trade' : 'Trades'}
                </div>
                <div className={`text-[11px] mt-0.5 font-mono tabular-nums ${mutedText}`}>
                  {report.summary.totalFieldComparisons} total field checks
                </div>
              </div>

              <div
                className={`pr-4 sm:border-r ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <div className={`text-xs font-medium ${mutedText}`}>Match</div>
                <div
                  className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                    isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                  }`}
                >
                  {report.summary.matches}
                </div>
                <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                  Verified exact alignment
                </div>
              </div>

              <div
                className={`pr-4 sm:border-r ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <div className={`text-xs font-medium ${mutedText}`}>False Alert (With Reason)</div>
                <div
                  className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                    isDarkMode ? 'text-amber-400' : 'text-amber-700'
                  }`}
                >
                  {report.summary.falseAlerts}
                </div>
                <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                  Formatting / unit difference
                </div>
              </div>

              <div
                className={`pr-4 sm:border-r ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <div className={`text-xs font-medium ${mutedText}`}>True Mismatch</div>
                <div
                  className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                    isDarkMode ? 'text-red-400' : 'text-red-700'
                  }`}
                >
                  {report.summary.trueMismatches}
                </div>
                <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                  Economic / booking break
                </div>
              </div>

              <div>
                <div className={`text-xs font-medium ${mutedText}`}>Parsing Error</div>
                <div
                  className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                    isDarkMode ? 'text-indigo-400' : 'text-indigo-700'
                  }`}
                >
                  {report.summary.parsingErrors}
                </div>
                <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                  Failed strict type validation
                </div>
              </div>
            </div>

            {/* Interactive Visual Reconciliation Analytics Dashboard */}
            <ReconciliationAnalyticsDashboard
              report={report}
              isDarkMode={isDarkMode}
              selectedTradeId={selectedTradeId}
              selectedFieldKey={selectedFieldKey}
              selectedInspectorTradeId={selectedInspectorTradeId}
              statusFilter={statusFilter}
              onSelectTradeId={(tradeId) => {
                setSelectedTradeId(tradeId);
                setIsInsightsCollapsed(false);
              }}
              onSelectFieldCell={(tradeId, fieldKey) => {
                setSelectedInspectorTradeId(tradeId);
                setSelectedFieldKey(fieldKey);
                setIsInsightsCollapsed(false);
              }}
              onSelectStatusFilter={(status) => {
                setStatusFilter(status);
                setIsInsightsCollapsed(false);
              }}
            />

            {/* LLM Executive Insights, Trade Selector & Detailed Reconciliation Tables Section */}
            <div className="space-y-6">
              <div className={`border rounded-sm shadow-2xs transition-colors ${cardBg}`}>
                <div
                  className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 ${
                    !isInsightsCollapsed
                      ? `border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-sm bg-[#008053]/15 text-[#008053] flex items-center justify-center shrink-0">
                      <MessageSquareText className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className={`text-base font-bold ${headingText}`}>
                        LLM Executive Insights & Reconciliation Commentary
                      </h2>
                      <p className={`text-xs ${mutedText}`}>
                        Automated LLM executive narrative, key operational findings, and detailed field-by-field reconciliation tables
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsInsightsCollapsed((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors cursor-pointer ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isInsightsCollapsed ? (
                      <>
                        Show Insights
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        Hide Insights
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {!isInsightsCollapsed && (
                  <div className="p-6 space-y-4">
                    <p
                      className={`text-xs leading-relaxed ${
                        isDarkMode ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      {report.executiveAiCommentary}
                    </p>

                    {report.keyInsights.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {report.keyInsights.map((insight, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 border rounded-sm text-xs flex items-start gap-2.5 ${subCardBg}`}
                          >
                            <span
                              className={`font-mono font-bold shrink-0 ${
                                isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                              }`}
                            >
                              0{idx + 1}.
                            </span>
                            <span className="leading-relaxed">{insight}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isInsightsCollapsed && (
                <>
                  {/* TradeID Selector Bar */}
                  {report.tradeReconciliations.length > 1 && (
                    <div className={`border rounded-sm p-5 space-y-3 shadow-2xs ${cardBg}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Layers
                            className={`w-4 h-4 ${
                              isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                            }`}
                          />
                          <span className={`text-xs font-bold ${headingText}`}>
                            Filter by Booked Trade Record (TradeID 1 – {report.tradeReconciliations.length})
                          </span>
                        </div>
                        <span className={`text-xs ${mutedText}`}>
                          Select any TradeID to inspect its specific mismatches and LLM explanation
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        <button
                          onClick={() => setSelectedTradeId('ALL')}
                          className={`p-3 rounded-sm border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                            selectedTradeId === 'ALL'
                              ? 'bg-[#008053] text-white border-[#008053]'
                              : isDarkMode
                              ? 'bg-[#0F172A] border-slate-800 hover:bg-slate-800 text-slate-100'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-[#1A1A1A]'
                          }`}
                        >
                          <div className="text-xs font-bold font-mono">
                            All {report.summary.totalTrades} Trades
                          </div>
                          <div
                            className={`text-[11px] font-mono tabular-nums mt-1 ${
                              selectedTradeId === 'ALL' ? 'text-emerald-100' : mutedText
                            }`}
                          >
                            {report.summary.totalFieldComparisons} comparisons
                          </div>
                        </button>

                        {report.tradeReconciliations.map((tRow) => {
                          const isSelected =
                            selectedTradeId !== 'ALL' &&
                            Number(selectedTradeId) === Number(tRow.tradeId);
                          const hasMismatch = tRow.counts.trueMismatches > 0;
                          return (
                            <button
                              key={tRow.tradeId}
                              onClick={() => {
                                setSelectedTradeId(Number(tRow.tradeId));
                                setSelectedInspectorTradeId(tRow.tradeId);
                                const firstBreak =
                                  tRow.fields.find((f) => f.status === 'TRUE_MISMATCH') ||
                                  tRow.fields.find((f) => f.status !== 'MATCH') ||
                                  tRow.fields[0];
                                if (firstBreak) setSelectedFieldKey(firstBreak.fieldKey);
                              }}
                              className={`p-3 rounded-sm border text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#008053] text-white border-[#008053]'
                                  : hasMismatch
                                  ? isDarkMode
                                    ? 'bg-red-950/30 border-red-800/60 hover:bg-red-950/50 text-slate-100'
                                    : 'bg-red-50/50 border-red-200 hover:bg-red-50 text-[#1A1A1A]'
                                  : isDarkMode
                                  ? 'bg-[#0F172A] border-slate-800 hover:bg-slate-800 text-slate-100'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-[#1A1A1A]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-bold font-mono">
                                  TradeID #{tRow.tradeId}
                                </span>
                                {hasMismatch ? (
                                  <XCircle
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      isSelected ? 'text-white' : 'text-red-500'
                                    }`}
                                  />
                                ) : (
                                  <CheckCircle2
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      isSelected
                                        ? 'text-white'
                                        : isDarkMode
                                        ? 'text-emerald-400'
                                        : 'text-[#008053]'
                                    }`}
                                  />
                                )}
                              </div>
                              <div
                                className={`text-[11px] font-mono tabular-nums ${
                                  isSelected ? 'text-emerald-50' : mutedText
                                }`}
                              >
                                {hasMismatch ? (
                                  <span
                                    className={
                                      isSelected
                                        ? 'text-white font-semibold'
                                        : isDarkMode
                                        ? 'text-red-400 font-semibold'
                                        : 'text-red-700 font-semibold'
                                    }
                                  >
                                    {tRow.counts.trueMismatches} True Mismatch
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      isSelected
                                        ? 'text-emerald-100'
                                        : isDarkMode
                                        ? 'text-emerald-400'
                                        : 'text-[#008053]'
                                    }
                                  >
                                    0 True Mismatches
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {activeTradeRow && (
                        <div className={`p-3 border rounded-sm text-xs flex items-start gap-2 ${subCardBg}`}>
                          <span
                            className={`font-bold whitespace-nowrap ${
                              isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                            }`}
                          >
                            TradeID #{activeTradeRow.tradeId} AI Comment:
                          </span>
                          <span>{activeTradeRow.tradeAiSummary}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Split Reconciliation Table & Field Evidence Inspector */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left 7 Columns: Reconciliation Table */}
                    <div className={`lg:col-span-7 border rounded-sm overflow-hidden shadow-2xs ${cardBg}`}>
                      <div
                        className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
                          isDarkMode
                            ? 'bg-[#0F172A] border-slate-800'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1 p-1 rounded-sm overflow-x-auto ${
                            isDarkMode ? 'bg-slate-800' : 'bg-slate-200/70'
                          }`}
                        >
                          {(
                            [
                              { id: 'ALL', label: 'All Fields' },
                              { id: 'TRUE_MISMATCH', label: 'True Mismatches' },
                              { id: 'FALSE_ALERT', label: 'False Alerts' },
                              { id: 'PARSING_ERROR', label: 'Parsing Errors' },
                              { id: 'MATCH', label: 'Matches' },
                            ] as Array<{ id: StatusFilter; label: string }>
                          ).map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setStatusFilter(tab.id)}
                              className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                statusFilter === tab.id
                                  ? 'bg-[#008053] text-white font-semibold'
                                  : isDarkMode
                                  ? 'text-slate-300 hover:text-white'
                                  : 'text-slate-600 hover:text-[#1A1A1A]'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <div className="relative flex-1 min-w-[180px] max-w-xs">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search attribute, value, or reason..."
                            className={`w-full pl-8 pr-3 py-1.5 text-xs border rounded-sm focus:outline-none focus:border-[#008053] ${
                              isDarkMode
                                ? 'bg-[#111C2D] border-slate-700 text-slate-100'
                                : 'bg-white border-slate-300 text-[#1A1A1A]'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr
                              className={`border-b text-[11px] font-semibold ${
                                isDarkMode
                                  ? 'bg-[#0F172A] border-slate-800 text-slate-400'
                                  : 'bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              <th className="py-2.5 px-3">Trade</th>
                              <th className="py-2.5 px-3">Field</th>
                              <th className="py-2.5 px-3">Term Sheet Value</th>
                              <th className="py-2.5 px-3">Booking Value</th>
                              <th className="py-2.5 px-3">Status & LLM Reason</th>
                            </tr>
                          </thead>
                          <tbody
                            className={`divide-y text-xs ${
                              isDarkMode ? 'divide-slate-800' : 'divide-slate-200'
                            }`}
                          >
                            {displayedFields.map((row) => {
                              const isSelected =
                                selectedRow?.fieldKey === row.fieldKey &&
                                String(selectedRow?.tradeId) === String(row.tradeId);
                              return (
                                <tr
                                  key={`${row.tradeId}-${row.fieldKey}`}
                                  onClick={() => {
                                    setSelectedFieldKey(row.fieldKey);
                                    setSelectedInspectorTradeId(row.tradeId);
                                  }}
                                  className={`cursor-pointer transition-colors ${
                                    isSelected
                                      ? isDarkMode
                                        ? 'bg-[#008053]/20'
                                        : 'bg-[#008053]/10'
                                      : row.status === 'TRUE_MISMATCH'
                                      ? isDarkMode
                                        ? 'bg-red-950/20 hover:bg-red-950/40'
                                        : 'bg-red-50/30 hover:bg-red-50/60'
                                      : isDarkMode
                                      ? 'hover:bg-slate-800/50'
                                      : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <td className={`py-2.5 px-3 align-top font-mono font-semibold whitespace-nowrap ${mutedText}`}>
                                    #{row.tradeId}
                                  </td>
                                  <td className="py-2.5 px-3 align-top">
                                    <div className={`font-semibold ${headingText}`}>
                                      {row.bookingHeader}
                                    </div>
                                    <div className={`text-[11px] font-mono ${mutedText}`}>
                                      {row.expectedType}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 align-top font-mono tabular-nums max-w-[180px]">
                                    <div className="break-words">{row.termSheetRaw ?? '—'}</div>
                                    {row.termSheetNormalized !== null &&
                                      String(row.termSheetNormalized) !==
                                        String(row.termSheetRaw) && (
                                        <div
                                          className={`text-[11px] mt-0.5 ${
                                            isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                                          }`}
                                        >
                                          Norm: {String(row.termSheetNormalized)}
                                        </div>
                                      )}
                                  </td>
                                  <td className={`py-2.5 px-3 align-top font-mono tabular-nums font-semibold ${headingText}`}>
                                    {String(row.bookingValue ?? '—')}
                                  </td>
                                  <td className="py-2.5 px-3 align-top">
                                    {renderStatusIndicator(row.status)}
                                    <div className={`text-[11px] mt-1 leading-snug ${mutedText}`}>
                                      {row.reason}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right 5 Columns: Selected Field Verbatim Quote & Explanation */}
                    <div className="lg:col-span-5">
                      {selectedRow && (
                        <div className={`border rounded-sm p-5 space-y-4 shadow-2xs ${cardBg}`}>
                          <div
                            className={`flex items-start justify-between gap-4 pb-3 border-b ${
                              isDarkMode ? 'border-slate-800' : 'border-slate-200'
                            }`}
                          >
                            <div>
                              <div className={`text-xs font-mono ${mutedText}`}>
                                TradeID #{selectedRow.tradeId} · {selectedRow.bookingHeader} (
                                {selectedRow.expectedType})
                              </div>
                              <h3 className={`text-lg font-bold mt-0.5 ${headingText}`}>
                                {selectedRow.label}
                              </h3>
                            </div>
                            {renderStatusIndicator(selectedRow.status)}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className={`p-3 border rounded-sm ${subCardBg}`}>
                              <div className={`text-[11px] ${mutedText}`}>Term Sheet Extracted</div>
                              <div className={`text-xs font-mono font-semibold mt-1 break-words ${headingText}`}>
                                {selectedRow.termSheetRaw ?? 'Not found'}
                              </div>
                              {selectedRow.termSheetNormalized !== null && (
                                <div
                                  className={`text-[11px] font-mono mt-1 ${
                                    isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                                  }`}
                                >
                                  Normalized: {String(selectedRow.termSheetNormalized)}
                                </div>
                              )}
                            </div>
                            <div className={`p-3 border rounded-sm ${subCardBg}`}>
                              <div className={`text-[11px] ${mutedText}`}>
                                Booking Value (TradeID #{selectedRow.tradeId})
                              </div>
                              <div className={`text-xs font-mono font-bold mt-1 break-words ${headingText}`}>
                                {String(selectedRow.bookingValue ?? '—')}
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className={`text-xs font-semibold mb-1.5 flex items-center justify-between ${headingText}`}>
                              <span>Exact Quote / Snippet from Source Term Sheet</span>
                              <span className={`text-[11px] font-normal ${mutedText}`}>
                                {report.termSheetFileName}
                              </span>
                            </div>
                            <div className="p-3.5 bg-[#004D31] text-emerald-100 font-mono text-xs rounded-sm overflow-x-auto leading-relaxed">
                              "{selectedRow.verbatimQuote || 'No verbatim quote extracted'}"
                            </div>
                          </div>

                          <div className={`p-3.5 border rounded-sm ${subCardBg}`}>
                            <div className={`text-xs font-semibold mb-1 ${headingText}`}>
                              LLM Reconciliation Explanation
                            </div>
                            <p className="text-xs leading-relaxed">
                              {selectedRow.reason}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Subtle Bottom-Right Toast Notification when Reconciliation Insights are Ready */}
      {toastNotification && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 max-w-md w-full border-l-4 border-l-[#008053] border rounded-sm shadow-lg p-4 transition-all duration-200 ${
            isDarkMode
              ? 'bg-[#111C2D] border-slate-700 text-slate-100'
              : 'bg-white border-slate-200 text-[#1A1A1A]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#008053]/15 text-[#008053] flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className={`text-xs font-bold ${headingText}`}>
                  {toastNotification.title}
                </div>
                <p className={`text-[11px] leading-relaxed ${mutedText}`}>
                  {toastNotification.subtitle}
                </p>
                {report && (
                  <div className="pt-1 flex items-center gap-3">
                    <button
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setIsExportMenuOpen(true);
                      }}
                      className={`text-[11px] font-semibold underline cursor-pointer ${
                        isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                      }`}
                    >
                      Choose Download Format
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setToastNotification(null)}
              aria-label="Close notification"
              className={`p-1 rounded-xs hover:bg-slate-500/10 transition-colors cursor-pointer ${mutedText}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Clean Corporate Footer */}
      <footer
        className={`border-t mt-12 transition-colors ${
          isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className={`max-w-[1440px] mx-auto px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${mutedText}`}>
          <div>
            BNP Paribas India Solutions Private Limited · Capital Markets Operations
          </div>
          <div>The bank for a changing world</div>
        </div>
      </footer>
    </div>
  );
}
