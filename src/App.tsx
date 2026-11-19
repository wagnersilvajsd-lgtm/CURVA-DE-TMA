import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  Moon,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { CallsAuditTable } from './components/CallsAuditTable';
import { FileUploadZone } from './components/FileUploadZone';
import { FilterBar } from './components/FilterBar';
import { HourlyPeakChart } from './components/HourlyPeakChart';
import { KpiCards } from './components/KpiCards';
import { OperatorTable } from './components/OperatorTable';
import { OperatorTmaChart } from './components/OperatorTmaChart';
import type { CallRecord, FilterState, ImportMetadata } from './types/callCenter';
import {
  calculateDashboardSummary,
  calculatePeriodComparison,
  filterCallRecords,
  getFilterBounds,
} from './utils/metricsCalculator';
import {
  downloadSampleWorkbook,
  exportConsolidatedCSV,
  exportConsolidatedXLSX,
  generateSampleRecords,
  parseCallCenterFile,
} from './utils/spreadsheetParser';

type ActiveTab = 'dashboard' | 'records';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('pulseops_theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return false;
  });

  const [records, setRecords] = useState<CallRecord[]>([]);
  const [metadata, setMetadata] = useState<ImportMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReplaceUpload, setShowReplaceUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [compareEnabled, setCompareEnabled] = useState(true);

  const [filters, setFilters] = useState<FilterState>({
    selectedOperators: [],
    startDate: '',
    endDate: '',
    selectedQueue: 'ALL',
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    window.localStorage.setItem('pulseops_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const bounds = useMemo(() => getFilterBounds(records), [records]);

  const filteredRecords = useMemo(
    () => filterCallRecords(records, filters),
    [records, filters]
  );

  const summary = useMemo(
    () => calculateDashboardSummary(filteredRecords),
    [filteredRecords]
  );

  const periodComparison = useMemo(
    () => calculatePeriodComparison(records, filters, summary, bounds.minDate),
    [records, filters, summary, bounds.minDate]
  );

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.entryDateKey) set.add(r.entryDateKey);
    }
    return Array.from(set).sort();
  }, [records]);

  const canQuickCompareHalf = availableDates.length >= 2;

  const handleQuickCompareHalf = () => {
    if (availableDates.length < 2) return;
    const midIndex = Math.ceil(availableDates.length / 2);
    const secondHalfStart = availableDates[midIndex];
    const secondHalfEnd = availableDates[availableDates.length - 1];
    if (secondHalfStart && secondHalfEnd) {
      setFilters((prev) => ({
        ...prev,
        startDate: secondHalfStart,
        endDate: secondHalfEnd,
      }));
    }
  };

  const applyImportedData = (nextRecords: CallRecord[], nextMeta: ImportMetadata) => {
    const nextBounds = getFilterBounds(nextRecords);
    setRecords(nextRecords);
    setMetadata(nextMeta);
    setFilters({
      selectedOperators: [],
      startDate: nextBounds.minDate,
      endDate: nextBounds.maxDate,
      selectedQueue: 'ALL',
    });
    setShowReplaceUpload(false);
    setActiveTab('dashboard');
    setError(null);
  };

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      // Allow React to paint loading indicator before heavy SheetJS parsing
      await new Promise((resolve) => setTimeout(resolve, 60));
      const { records: parsed, metadata: meta } = await parseCallCenterFile(file);
      if (parsed.length === 0) {
        throw new Error('Nenhum registro de chamada válido foi encontrado na planilha.');
      }
      applyImportedData(parsed, meta);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro inesperado ao processar o arquivo. Verifique o formato da planilha.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const { records: sampleRecords, metadata: sampleMeta } = generateSampleRecords();
      applyImportedData(sampleRecords, sampleMeta);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      selectedOperators: [],
      startDate: bounds.minDate,
      endDate: bounds.maxDate,
      selectedQueue: 'ALL',
    });
  };

  const hasData = records.length > 0 && metadata !== null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {/* Top Bar Contract: 3 zones */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0"
          >
            PulseOps
          </a>

          {/* Zone 2: Clean single-line navigation */}
          {hasData ? (
            <nav
              aria-label="Navegação principal"
              className="hidden items-center gap-6 text-sm font-medium md:flex"
            >
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`border-b-2 py-5 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'dashboard'
                    ? 'border-emerald-600 text-slate-900 dark:border-emerald-400 dark:text-slate-50'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Painel Operacional
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('records')}
                className={`border-b-2 py-5 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'records'
                    ? 'border-emerald-600 text-slate-900 dark:border-emerald-400 dark:text-slate-50'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Base de Chamadas
              </button>
            </nav>
          ) : (
            <div className="hidden md:block" />
          )}

          {/* Zone 3: Theme Switch & Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {hasData && (
              <button
                type="button"
                onClick={() => setShowReplaceUpload((prev) => !prev)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap shrink-0"
              >
                <Upload className="h-3.5 w-3.5" />
                {showReplaceUpload ? 'Fechar Importação' : 'Nova Planilha'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {!hasData ? (
          <FileUploadZone
            onFileSelect={handleFileSelect}
            onLoadSample={handleLoadSample}
            onDownloadTemplate={downloadSampleWorkbook}
            isLoading={isLoading}
            error={error}
          />
        ) : (
          <div className="space-y-6">
            {/* Compact Workspace File Context Bar + Mobile Tab Switcher */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {metadata.fileName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {metadata.totalRows.toLocaleString('pt-BR')} chamadas lidas
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Aba: {metadata.sheetName}
                </span>
                {bounds.minDate && bounds.maxDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {bounds.minDate.split('-').reverse().join('/')} a{' '}
                      {bounds.maxDate.split('-').reverse().join('/')}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800 md:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'dashboard'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Painel Operacional
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('records')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'records'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Base de Chamadas
                </button>
              </div>
            </div>

            {/* Collapsible Upload Drawer to switch spreadsheet */}
            {showReplaceUpload && (
              <div className="relative rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Importar Nova Planilha (.xlsx ou .csv)
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowReplaceUpload(false)}
                    aria-label="Fechar painel de importação"
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <FileUploadZone
                  compact
                  onFileSelect={handleFileSelect}
                  onLoadSample={handleLoadSample}
                  onDownloadTemplate={downloadSampleWorkbook}
                  isLoading={isLoading}
                  error={error}
                />
              </div>
            )}

            {/* Loading Overlay Feedback when replacing file */}
            {isLoading && !showReplaceUpload && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Processando nova planilha no navegador...</span>
              </div>
            )}

            {/* Parser Warnings */}
            {metadata.warnings.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold">Observações na leitura das colunas</p>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5">
                    {metadata.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Interactive Filters */}
            <FilterBar
              operators={bounds.operators}
              queues={bounds.queues}
              minDate={bounds.minDate}
              maxDate={bounds.maxDate}
              filters={filters}
              onChange={setFilters}
              onReset={handleResetFilters}
              totalRecords={records.length}
              filteredRecords={filteredRecords.length}
            />

            {activeTab === 'dashboard' ? (
              <>
                {/* 4 Main KPI Cards with Period Comparison */}
                <KpiCards
                  summary={summary}
                  comparison={periodComparison}
                  compareEnabled={compareEnabled}
                  onToggleCompare={() => setCompareEnabled((prev) => !prev)}
                  canQuickCompareHalf={canQuickCompareHalf}
                  onQuickCompareHalf={handleQuickCompareHalf}
                />

                {/* Charts Grid */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <div className="xl:col-span-7">
                    <HourlyPeakChart
                      buckets={summary.hourlyBuckets}
                      peakAnalysis={summary.peakAnalysis}
                      isDark={isDark}
                    />
                  </div>
                  <div className="xl:col-span-5">
                    <OperatorTmaChart
                      operators={summary.operatorMetrics}
                      teamAvgTmaMinutes={summary.avgTmaMinutes}
                      isDark={isDark}
                    />
                  </div>
                </div>

                {/* Operator Detail Table with Export */}
                <OperatorTable
                  operators={summary.operatorMetrics}
                  teamAvgTmaMinutes={summary.avgTmaMinutes}
                  onExportXLSX={() => exportConsolidatedXLSX(summary, filters)}
                  onExportCSV={() => exportConsolidatedCSV(summary)}
                />
              </>
            ) : (
              <CallsAuditTable records={filteredRecords} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

