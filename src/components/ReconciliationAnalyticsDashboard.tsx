import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Grid,
  ChevronUp,
  ChevronDown,
  Filter,
} from 'lucide-react';
import {
  ReconciliationFieldResult,
  ReconciliationStatus,
  TradeReconciliationReport,
} from '../types';

interface ReconciliationAnalyticsDashboardProps {
  report: TradeReconciliationReport;
  isDarkMode: boolean;
  selectedTradeId: number | 'ALL';
  selectedFieldKey: string;
  selectedInspectorTradeId: number | string;
  statusFilter: 'ALL' | ReconciliationStatus;
  onSelectTradeId: (tradeId: number | 'ALL') => void;
  onSelectFieldCell: (tradeId: number | string, fieldKey: string) => void;
  onSelectStatusFilter: (status: 'ALL' | ReconciliationStatus) => void;
}

export function ReconciliationAnalyticsDashboard({
  report,
  isDarkMode,
  selectedTradeId,
  selectedFieldKey,
  selectedInspectorTradeId,
  statusFilter,
  onSelectTradeId,
  onSelectFieldCell,
  onSelectStatusFilter,
}: ReconciliationAnalyticsDashboardProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const totalComparisons = Math.max(1, report.summary.totalFieldComparisons);
  const { matches, falseAlerts, trueMismatches, parsingErrors, totalTrades } =
    report.summary;

  // Logical & Mathematical Metrics
  // 1. Economic Alignment Rate: Fields that are economically accurate (Matches + False Alerts) / Total Comparisons
  const economicallyAlignedCount = matches + falseAlerts;
  const economicAlignmentPct = (
    (economicallyAlignedCount / totalComparisons) *
    100
  ).toFixed(1);

  // 2. Exact String Match Rate: Matches / Total Comparisons
  const exactMatchPct = ((matches / totalComparisons) * 100).toFixed(1);

  // 3. False Alert Noise Suppression Rate: False Alerts / (False Alerts + True Mismatches + Parsing Errors)
  const totalNonExact = falseAlerts + trueMismatches + parsingErrors;
  const noiseSuppressionPct =
    totalNonExact > 0
      ? ((falseAlerts / totalNonExact) * 100).toFixed(1)
      : '100.0';

  // 4. Clean Trades Count: Trades with 0 True Mismatches and 0 Parsing Errors
  const cleanTradesCount = useMemo(
    () =>
      report.tradeReconciliations.filter(
        (t) => t.counts.trueMismatches === 0 && t.counts.parsingErrors === 0
      ).length,
    [report.tradeReconciliations]
  );

  // SVG Donut Chart Calculations (r = 54, circumference = 2 * PI * 54 ≈ 339.292)
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  const donutSegments = useMemo(() => {
    const items: Array<{
      status: ReconciliationStatus;
      label: string;
      count: number;
      pct: number;
      color: string;
    }> = [
      {
        status: 'MATCH',
        label: 'Verified Match',
        count: matches,
        pct: (matches / totalComparisons) * 100,
        color: '#008053',
      },
      {
        status: 'FALSE_ALERT',
        label: 'False Alert (With Reason)',
        count: falseAlerts,
        pct: (falseAlerts / totalComparisons) * 100,
        color: '#D97706',
      },
      {
        status: 'TRUE_MISMATCH',
        label: 'True Mismatch',
        count: trueMismatches,
        pct: (trueMismatches / totalComparisons) * 100,
        color: '#DC2626',
      },
      {
        status: 'PARSING_ERROR',
        label: 'Parsing Error',
        count: parsingErrors,
        pct: (parsingErrors / totalComparisons) * 100,
        color: '#4F46E5',
      },
    ];

    let cumulativeLength = 0;
    return items.map((item) => {
      const segmentLength = (item.count / totalComparisons) * circumference;
      const dashArray = `${segmentLength} ${circumference - segmentLength}`;
      const dashOffset = -cumulativeLength;
      cumulativeLength += segmentLength;
      return {
        ...item,
        dashArray,
        dashOffset,
      };
    });
  }, [matches, falseAlerts, trueMismatches, parsingErrors, totalComparisons, circumference]);

  // Attribute Hotspot Aggregation across all trades
  const attributeHotspots = useMemo(() => {
    const map = new Map<
      string,
      {
        fieldKey: string;
        bookingHeader: string;
        label: string;
        expectedType: string;
        matches: number;
        falseAlerts: number;
        trueMismatches: number;
        parsingErrors: number;
        firstAnomalyTradeId: number | string;
      }
    >();

    for (const trade of report.tradeReconciliations) {
      for (const field of trade.fields) {
        const existing = map.get(field.fieldKey) || {
          fieldKey: field.fieldKey,
          bookingHeader: field.bookingHeader,
          label: field.label,
          expectedType: field.expectedType,
          matches: 0,
          falseAlerts: 0,
          trueMismatches: 0,
          parsingErrors: 0,
          firstAnomalyTradeId: trade.tradeId,
        };

        if (field.status === 'MATCH') existing.matches += 1;
        if (field.status === 'FALSE_ALERT') existing.falseAlerts += 1;
        if (field.status === 'TRUE_MISMATCH') {
          existing.trueMismatches += 1;
          existing.firstAnomalyTradeId = trade.tradeId;
        }
        if (field.status === 'PARSING_ERROR') {
          existing.parsingErrors += 1;
          existing.firstAnomalyTradeId = trade.tradeId;
        }

        map.set(field.fieldKey, existing);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      // Sort by True Mismatches desc, then Parsing Errors desc, then False Alerts desc
      if (b.trueMismatches !== a.trueMismatches) {
        return b.trueMismatches - a.trueMismatches;
      }
      if (b.parsingErrors !== a.parsingErrors) {
        return b.parsingErrors - a.parsingErrors;
      }
      if (b.falseAlerts !== a.falseAlerts) {
        return b.falseAlerts - a.falseAlerts;
      }
      return a.bookingHeader.localeCompare(b.bookingHeader);
    });
  }, [report.tradeReconciliations]);

  // Canonical list of fields for the Trade x Field Heatmap Matrix
  const matrixColumns = useMemo(() => {
    const firstTrade = report.tradeReconciliations[0];
    if (!firstTrade) return [];
    return firstTrade.fields.map((f) => ({
      fieldKey: f.fieldKey,
      bookingHeader: f.bookingHeader,
      label: f.label,
    }));
  }, [report.tradeReconciliations]);

  const cardBg = isDarkMode
    ? 'bg-[#111C2D] border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-[#1A1A1A]';
  const subCardBg = isDarkMode
    ? 'bg-[#0F172A] border-slate-800 text-slate-200'
    : 'bg-[#F8FAFC] border-slate-200 text-slate-800';
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const headingText = isDarkMode ? 'text-white' : 'text-[#1A1A1A]';

  const getCellBadgeStyle = (status: ReconciliationStatus, isSelected: boolean) => {
    const ringClass = isSelected
      ? isDarkMode
        ? 'ring-2 ring-white scale-105 z-10'
        : 'ring-2 ring-[#1A1A1A] scale-105 z-10'
      : '';
    switch (status) {
      case 'MATCH':
        return `${ringClass} bg-[#008053] text-white hover:bg-[#006642]`;
      case 'FALSE_ALERT':
        return `${ringClass} bg-amber-500 text-white hover:bg-amber-600`;
      case 'TRUE_MISMATCH':
        return `${ringClass} bg-red-600 text-white hover:bg-red-700`;
      case 'PARSING_ERROR':
        return `${ringClass} bg-indigo-600 text-white hover:bg-indigo-700`;
    }
  };

  const getCellSymbol = (status: ReconciliationStatus) => {
    switch (status) {
      case 'MATCH':
        return '✓';
      case 'FALSE_ALERT':
        return '!';
      case 'TRUE_MISMATCH':
        return '✕';
      case 'PARSING_ERROR':
        return '?';
    }
  };

  return (
    <div className={`border rounded-sm shadow-2xs transition-colors ${cardBg}`}>
      {/* Dashboard Header Bar with Collapse/Expand Toggle */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b ${
          isDarkMode ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-[#008053]/15 text-[#008053] flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${headingText}`}>
              Visual Reconciliation Analytics Dashboard
            </h2>
            <p className={`text-xs ${mutedText}`}>
              Interactive distribution of Matches, False Alerts, True Mismatches, and Trade × Field Matrix (click any chart element to filter)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(statusFilter !== 'ALL' || selectedTradeId !== 'ALL') && (
            <button
              onClick={() => {
                onSelectStatusFilter('ALL');
                onSelectTradeId('ALL');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm bg-[#008053]/15 text-[#008053] hover:bg-[#008053]/25 transition-colors cursor-pointer"
            >
              <Filter className="w-3 h-3" />
              Reset Active Chart Filters
            </button>
          )}
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isCollapsed ? (
              <>
                Show Dashboard
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Hide Dashboard
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-6 space-y-6">
          {/* Top Row: 3 Visual Cards (Donut Breakdown, Trade-by-Trade Stacked Bars, Discrepancy Hotspots) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Panel 1: Overall Reconciliation Health Donut & Accuracy KPIs (4 cols) */}
            <div className={`lg:col-span-4 border rounded-sm p-5 flex flex-col justify-between ${subCardBg}`}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${headingText}`}>
                    1. Overall Classification Breakdown
                  </h3>
                  <span className={`text-[11px] font-mono ${mutedText}`}>
                    n = {report.summary.totalFieldComparisons}
                  </span>
                </div>
                <p className={`text-[11px] mb-4 ${mutedText}`}>
                  Click any category below to filter the reconciliation table.
                </p>

                {/* Donut Chart + Center KPI */}
                <div className="flex items-center justify-center my-2">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-36 h-36 -rotate-90" viewBox="0 0 140 140">
                      <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke={isDarkMode ? '#1E293B' : '#E2E8F0'}
                        strokeWidth="16"
                      />
                      {donutSegments.map((seg) =>
                        seg.count > 0 ? (
                          <circle
                            key={seg.status}
                            cx="70"
                            cy="70"
                            r={radius}
                            fill="transparent"
                            stroke={seg.color}
                            strokeWidth={statusFilter === seg.status ? '20' : '16'}
                            strokeDasharray={seg.dashArray}
                            strokeDashoffset={seg.dashOffset}
                            className="transition-all duration-300 cursor-pointer hover:opacity-90"
                            onClick={() =>
                              onSelectStatusFilter(
                                statusFilter === seg.status ? 'ALL' : seg.status
                              )
                            }
                          />
                        ) : null
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className={`text-xl font-bold font-mono tabular-nums ${headingText}`}>
                        {economicAlignmentPct}%
                      </span>
                      <span className={`text-[10px] font-medium leading-tight px-2 ${mutedText}`}>
                        Economic Alignment
                      </span>
                    </div>
                  </div>
                </div>

                {/* Interactive Legend Rows */}
                <div className="space-y-1.5 mt-3">
                  {donutSegments.map((seg) => {
                    const isSelected = statusFilter === seg.status;
                    return (
                      <button
                        key={seg.status}
                        onClick={() =>
                          onSelectStatusFilter(
                            statusFilter === seg.status ? 'ALL' : seg.status
                          )
                        }
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xs text-xs transition-colors cursor-pointer border ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-slate-800 border-emerald-500/60 font-semibold'
                              : 'bg-white border-[#008053] font-semibold shadow-2xs'
                            : 'border-transparent hover:bg-slate-500/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className={headingText}>{seg.label}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono tabular-nums">
                          <span className={`font-bold ${headingText}`}>{seg.count}</span>
                          <span className={`text-[11px] w-12 text-right ${mutedText}`}>
                            ({seg.pct.toFixed(1)}%)
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Logical KPI Callouts */}
              <div
                className={`grid grid-cols-2 gap-2 pt-3 mt-4 border-t text-xs ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <div className="p-2 rounded-xs bg-[#008053]/10">
                  <div className={`text-[10px] ${mutedText}`}>False Alert Suppression</div>
                  <div
                    className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                      isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                    }`}
                  >
                    {noiseSuppressionPct}%
                  </div>
                </div>
                <div className="p-2 rounded-xs bg-[#008053]/10">
                  <div className={`text-[10px] ${mutedText}`}>Exact String Match</div>
                  <div
                    className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                      isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                    }`}
                  >
                    {exactMatchPct}%
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 2: Trade-by-Trade Comparison Stacked Bar Chart (4 cols) */}
            <div className={`lg:col-span-4 border rounded-sm p-5 flex flex-col justify-between ${subCardBg}`}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${headingText}`}>
                    2. Trade-by-Trade Comparison
                  </h3>
                  <span className={`text-[11px] font-mono ${mutedText}`}>
                    {cleanTradesCount}/{totalTrades} Clean
                  </span>
                </div>
                <p className={`text-[11px] mb-4 ${mutedText}`}>
                  Stacked field status per booked trade. Click any trade bar to filter.
                </p>

                <div className="space-y-3">
                  {report.tradeReconciliations.map((tRow) => {
                    const totalFields = Math.max(1, tRow.fields.length);
                    const matchW = (tRow.counts.matches / totalFields) * 100;
                    const falseW = (tRow.counts.falseAlerts / totalFields) * 100;
                    const mismatchW = (tRow.counts.trueMismatches / totalFields) * 100;
                    const errorW = (tRow.counts.parsingErrors / totalFields) * 100;

                    const isSelected =
                      selectedTradeId !== 'ALL' &&
                      Number(selectedTradeId) === Number(tRow.tradeId);
                    const breaksCount =
                      tRow.counts.trueMismatches + tRow.counts.parsingErrors;

                    return (
                      <div
                        key={tRow.tradeId}
                        onClick={() => {
                          if (isSelected) {
                            onSelectTradeId('ALL');
                          } else {
                            onSelectTradeId(Number(tRow.tradeId));
                            const firstBreak =
                              tRow.fields.find((f) => f.status === 'TRUE_MISMATCH') ||
                              tRow.fields.find((f) => f.status !== 'MATCH') ||
                              tRow.fields[0];
                            if (firstBreak) {
                              onSelectFieldCell(tRow.tradeId, firstBreak.fieldKey);
                            }
                          }
                        }}
                        className={`p-2.5 rounded-sm border transition-all duration-200 ease-out transform-gpu hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-slate-800 border-emerald-400 shadow-sm'
                              : 'bg-white border-[#008053] shadow-sm'
                            : isDarkMode
                            ? 'border-slate-800 hover:border-slate-700 hover:shadow-black/40'
                            : 'border-slate-200/80 bg-white/60 hover:bg-white hover:shadow-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${headingText}`}>
                              TradeID #{tRow.tradeId}
                            </span>
                            {breaksCount > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                <XCircle className="w-3 h-3" />
                                {breaksCount} {breaksCount === 1 ? 'Break' : 'Breaks'}
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                  isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Aligned
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                            {tRow.counts.matches}M · {tRow.counts.falseAlerts}FA ·{' '}
                            {tRow.counts.trueMismatches}TM
                          </div>
                        </div>

                        {/* Horizontal Stacked Bar */}
                        <div className="w-full h-3 rounded-xs overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                          {matchW > 0 && (
                            <div
                              style={{ width: `${matchW}%` }}
                              className="bg-[#008053] h-full transition-all duration-300"
                              title={`Matches: ${tRow.counts.matches}`}
                            />
                          )}
                          {falseW > 0 && (
                            <div
                              style={{ width: `${falseW}%` }}
                              className="bg-amber-500 h-full transition-all duration-300"
                              title={`False Alerts: ${tRow.counts.falseAlerts}`}
                            />
                          )}
                          {mismatchW > 0 && (
                            <div
                              style={{ width: `${mismatchW}%` }}
                              className="bg-red-600 h-full transition-all duration-300"
                              title={`True Mismatches: ${tRow.counts.trueMismatches}`}
                            />
                          )}
                          {errorW > 0 && (
                            <div
                              style={{ width: `${errorW}%` }}
                              className="bg-indigo-600 h-full transition-all duration-300"
                              title={`Parsing Errors: ${tRow.counts.parsingErrors}`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className={`pt-3 mt-4 border-t flex items-center justify-between text-[11px] ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                } ${mutedText}`}
              >
                <span>M = Match · FA = False Alert · TM = True Mismatch</span>
                <span className="font-mono font-semibold">
                  {report.tradeReconciliations[0]?.fields.length || 0} fields/trade
                </span>
              </div>
            </div>

            {/* Panel 3: Discrepancy & False Alert Hotspots by Attribute (4 cols) */}
            <div className={`lg:col-span-4 border rounded-sm p-5 flex flex-col justify-between ${subCardBg}`}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${headingText}`}>
                    3. Attribute Discrepancy Hotspots
                  </h3>
                  <span className={`text-[11px] font-mono ${mutedText}`}>
                    Top Non-Exact Fields
                  </span>
                </div>
                <p className={`text-[11px] mb-4 ${mutedText}`}>
                  Attributes ranked by True Mismatches & False Alerts across trades.
                </p>

                <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                  {attributeHotspots
                    .filter(
                      (item) =>
                        item.trueMismatches > 0 ||
                        item.parsingErrors > 0 ||
                        item.falseAlerts > 0
                    )
                    .slice(0, 7)
                    .map((item) => {
                      const totalForAttr = Math.max(1, totalTrades);
                      const tmPct = (item.trueMismatches / totalForAttr) * 100;
                      const pePct = (item.parsingErrors / totalForAttr) * 100;
                      const faPct = (item.falseAlerts / totalForAttr) * 100;
                      const mPct = (item.matches / totalForAttr) * 100;

                      const isSelected = selectedFieldKey === item.fieldKey;

                      return (
                        <div
                          key={item.fieldKey}
                          onClick={() =>
                            onSelectFieldCell(item.firstAnomalyTradeId, item.fieldKey)
                          }
                          className={`p-2.5 rounded-sm border transition-all duration-200 ease-out transform-gpu hover:scale-[1.015] hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                            isSelected
                              ? isDarkMode
                                ? 'bg-slate-800 border-emerald-400 shadow-sm'
                                : 'bg-white border-[#008053] shadow-sm'
                              : isDarkMode
                              ? 'border-slate-800 hover:border-slate-700 hover:shadow-black/40'
                              : 'border-slate-200/80 bg-white/60 hover:bg-white hover:shadow-slate-200/90'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs mb-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`font-bold truncate ${headingText}`}>
                                {item.bookingHeader}
                              </span>
                              <span className={`text-[10px] font-mono ${mutedText}`}>
                                ({item.expectedType})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                              {item.trueMismatches > 0 && (
                                <span className="px-1.5 py-0.5 rounded-xs bg-red-500/15 text-red-600 dark:text-red-400 font-bold">
                                  {item.trueMismatches} Mismatch
                                </span>
                              )}
                              {item.parsingErrors > 0 && (
                                <span className="px-1.5 py-0.5 rounded-xs bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold">
                                  {item.parsingErrors} Parse Err
                                </span>
                              )}
                              {item.falseAlerts > 0 && (
                                <span className="px-1.5 py-0.5 rounded-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold">
                                  {item.falseAlerts} False Alert
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="w-full h-2 rounded-xs overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                            {tmPct > 0 && (
                              <div
                                style={{ width: `${tmPct}%` }}
                                className="bg-red-600 h-full"
                              />
                            )}
                            {pePct > 0 && (
                              <div
                                style={{ width: `${pePct}%` }}
                                className="bg-indigo-600 h-full"
                              />
                            )}
                            {faPct > 0 && (
                              <div
                                style={{ width: `${faPct}%` }}
                                className="bg-amber-500 h-full"
                              />
                            )}
                            {mPct > 0 && (
                              <div
                                style={{ width: `${mPct}%` }}
                                className="bg-[#008053] h-full"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {attributeHotspots.every(
                    (i) =>
                      i.trueMismatches === 0 &&
                      i.parsingErrors === 0 &&
                      i.falseAlerts === 0
                  ) && (
                    <div className={`p-6 text-center text-xs ${mutedText}`}>
                      100% of attributes matched with zero False Alerts or Mismatches.
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`pt-3 mt-4 border-t flex items-center justify-between text-[11px] ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                } ${mutedText}`}
              >
                <span>Click any attribute to inspect source evidence</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Interactive Trade × Field Status Heatmap Matrix */}
          <div className={`border rounded-sm p-5 ${subCardBg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Grid
                  className={`w-4 h-4 ${
                    isDarkMode ? 'text-emerald-400' : 'text-[#008053]'
                  }`}
                />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${headingText}`}>
                  4. Interactive Trade × Field Reconciliation Heatmap Matrix
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#008053] text-white inline-flex items-center justify-center text-[9px] font-bold">
                    ✓
                  </span>
                  <span className={mutedText}>Match</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-amber-500 text-white inline-flex items-center justify-center text-[9px] font-bold">
                    !
                  </span>
                  <span className={mutedText}>False Alert (With Reason)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-red-600 text-white inline-flex items-center justify-center text-[9px] font-bold">
                    ✕
                  </span>
                  <span className={mutedText}>True Mismatch</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-indigo-600 text-white inline-flex items-center justify-center text-[9px] font-bold">
                    ?
                  </span>
                  <span className={mutedText}>Parsing Error</span>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th
                      className={`py-2 px-2.5 text-[11px] font-mono font-bold border-b whitespace-nowrap ${
                        isDarkMode
                          ? 'border-slate-800 text-slate-300'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      TradeID
                    </th>
                    {matrixColumns.map((col) => (
                      <th
                        key={col.fieldKey}
                        className={`py-2 px-1.5 text-[10px] font-mono font-semibold border-b text-center whitespace-nowrap ${
                          isDarkMode
                            ? 'border-slate-800 text-slate-400'
                            : 'border-slate-200 text-slate-600'
                        }`}
                        title={col.label}
                      >
                        {col.bookingHeader.length > 10
                          ? `${col.bookingHeader.slice(0, 9)}…`
                          : col.bookingHeader}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    isDarkMode ? 'divide-slate-800/70' : 'divide-slate-200/70'
                  }`}
                >
                  {report.tradeReconciliations.map((tRow) => (
                    <tr
                      key={tRow.tradeId}
                      className={`transition-all duration-200 ease-out transform-gpu hover:scale-[1.005] hover:shadow-sm ${
                        isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-white'
                      }`}
                    >
                      <td
                        onClick={() => onSelectTradeId(Number(tRow.tradeId))}
                        className={`py-2 px-2.5 text-xs font-mono font-bold whitespace-nowrap cursor-pointer transition-transform duration-150 hover:scale-105 hover:underline ${headingText}`}
                      >
                        Trade #{tRow.tradeId}
                      </td>
                      {matrixColumns.map((col) => {
                        const cell: ReconciliationFieldResult | undefined =
                          tRow.fields.find((f) => f.fieldKey === col.fieldKey);
                        if (!cell) {
                          return (
                            <td key={col.fieldKey} className="p-1 text-center">
                              —
                            </td>
                          );
                        }
                        const isCellSelected =
                          selectedFieldKey === cell.fieldKey &&
                          String(selectedInspectorTradeId) === String(tRow.tradeId);

                        return (
                          <td key={col.fieldKey} className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                onSelectFieldCell(tRow.tradeId, cell.fieldKey)
                              }
                              title={`Trade #${tRow.tradeId} · ${cell.bookingHeader}\nStatus: ${cell.status}\nTerm Sheet: ${cell.termSheetRaw ?? '—'}\nBooked: ${cell.bookingValue ?? '—'}\nReason: ${cell.reason}`}
                              className={`w-full min-w-[28px] h-7 rounded-xs font-mono text-xs font-bold flex items-center justify-center transition-all duration-150 ease-out transform-gpu hover:scale-110 hover:shadow-md cursor-pointer ${getCellBadgeStyle(
                                cell.status,
                                isCellSelected
                              )}`}
                            >
                              {getCellSymbol(cell.status)}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
