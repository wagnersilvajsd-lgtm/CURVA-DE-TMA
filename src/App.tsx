import React, {useMemo, useRef, useState} from 'react';
import {
  BarChart3,
  Clock,
  Download,
  FileSpreadsheet,
  Layers,
  Menu,
  RotateCcw,
  Table2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {AgentAverageChart} from './components/AgentAverageChart';
import {ChannelQueueBreakdown} from './components/ChannelQueueBreakdown';
import {OperatorTmaView} from './components/OperatorTmaView';
import {RecordsTable} from './components/RecordsTable';
import {TmaPeakChart} from './components/TmaPeakChart';
import {UploadEmptyState} from './components/UploadEmptyState';
import type {ActiveView, ParsedWorkbookResult, SegmentFilter} from './types/operations';
import {
  computeAgentMetrics,
  computeCategoryBreakdown,
  computeDailyCurve,
  computeHourlyCurve,
  computeHourlyImpactAndLoginPlan,
  computeOperationalSummary,
  formatTma,
} from './utils/analytics';
import {exportAnalyticalReportWorkbook} from './utils/reportExport';
import {
  downloadTemplateWorkbook,
  generateSampleWorkbookResult,
  parseSpreadsheetFile,
} from './utils/spreadsheet';

const NAV_ITEMS: {id: ActiveView; label: string; icon: React.ComponentType<{className?: string}>}[] = [
  {id: 'overview', label: 'Picos e Curva TMA', icon: BarChart3},
  {id: 'agents', label: 'Visão por Atendente', icon: Users},
  {id: 'operator-tma', label: 'TMA por Operador', icon: Clock},
  {id: 'channels', label: 'Filas e Canais', icon: Layers},
  {id: 'records', label: 'Registros da Planilha', icon: Table2},
];

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [workbook, setWorkbook] = useState<ParsedWorkbookResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Operational Filters
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [selectedQueue, setSelectedQueue] = useState<string>('all');
  const [selectedChatbot, setSelectedChatbot] = useState<string>('all');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedOperatorTma, setSelectedOperatorTma] = useState<string>('all');

  const resetFilters = () => {
    setSegmentFilter('all');
    setSelectedDate('all');
    setDateStart('');
    setDateEnd('');
    setSelectedQueue('all');
    setSelectedChatbot('all');
    setSelectedHour(null);
    setSelectedAgent(null);
    setSelectedOperatorTma('all');
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const parsed = await parseSpreadsheetFile(file);
      setWorkbook(parsed);
      resetFilters();
      setActiveView('overview');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível ler a planilha. Verifique o formato (.xlsx / .xls).',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = () => {
    setErrorMessage(null);
    const sample = generateSampleWorkbookResult();
    setWorkbook(sample);
    resetFilters();
    setActiveView('overview');
  };

  const handleClearWorkbook = () => {
    setWorkbook(null);
    setErrorMessage(null);
    resetFilters();
  };

  // Available filter options from loaded workbook
  const filterOptions = useMemo(() => {
    if (!workbook) return {dates: [], queues: [], chatbots: [], agents: []};

    const dateMap = new Map<string, string>();
    const queuesSet = new Set<string>();
    const chatbotsSet = new Set<string>();
    const agentsSet = new Set<string>();

    for (const r of workbook.records) {
      if (r.attendanceDate && r.attendanceDate !== 'Sem data') {
        dateMap.set(r.attendanceDate, r.attendanceDateDisplay);
      }
      if (r.queue) queuesSet.add(r.queue);
      if (r.segment === 'chat' && r.chatbotSource) chatbotsSet.add(r.chatbotSource);
      if (r.agent) agentsSet.add(r.agent);
    }

    const dates = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, display]) => ({iso, display}));

    return {
      dates,
      queues: Array.from(queuesSet).sort((a, b) => a.localeCompare(b)),
      chatbots: Array.from(chatbotsSet).sort((a, b) => a.localeCompare(b)),
      agents: Array.from(agentsSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    };
  }, [workbook]);

  // Base filtered records (before hour slice, so hourly chart still displays all 24h context)
  const baseFilteredRecords = useMemo(() => {
    if (!workbook) return [];
    return workbook.records.filter((r) => {
      if (segmentFilter !== 'all' && r.segment !== segmentFilter) return false;
      if (selectedDate !== 'all') {
        if (r.attendanceDate !== selectedDate) return false;
      } else if (dateStart || dateEnd) {
        if (!r.attendanceDate || r.attendanceDate === 'Sem data') return false;
        if (dateStart && r.attendanceDate < dateStart) return false;
        if (dateEnd && r.attendanceDate > dateEnd) return false;
      }
      if (selectedQueue !== 'all' && r.queue !== selectedQueue) return false;
      if (selectedChatbot !== 'all' && (r.segment !== 'chat' || r.chatbotSource !== selectedChatbot)) {
        return false;
      }
      return true;
    });
  }, [workbook, segmentFilter, selectedDate, dateStart, dateEnd, selectedQueue, selectedChatbot]);

  // Records further filtered by clicked chart hour
  const scopedRecords = useMemo(() => {
    if (selectedHour === null) return baseFilteredRecords;
    return baseFilteredRecords.filter((r) => r.entryHour === selectedHour);
  }, [baseFilteredRecords, selectedHour]);

  const hourlyBuckets = useMemo(() => computeHourlyCurve(baseFilteredRecords), [baseFilteredRecords]);
  const dailyBuckets = useMemo(() => computeDailyCurve(baseFilteredRecords), [baseFilteredRecords]);
  const agentMetrics = useMemo(() => computeAgentMetrics(scopedRecords), [scopedRecords]);
  const queueMetrics = useMemo(
    () => computeCategoryBreakdown(scopedRecords, (r) => r.queue),
    [scopedRecords],
  );
  const chatbotMetrics = useMemo(
    () =>
      computeCategoryBreakdown(
        scopedRecords.filter((r) => r.segment === 'chat'),
        (r) => r.chatbotSource ?? 'Não informado',
      ),
    [scopedRecords],
  );
  const disconnectMetrics = useMemo(
    () => computeCategoryBreakdown(scopedRecords, (r) => r.disconnectReason),
    [scopedRecords],
  );
  const surveyMetrics = useMemo(
    () =>
      computeCategoryBreakdown(
        scopedRecords.filter((r) => r.segment === 'voice'),
        (r) => r.surveyTransfer ?? 'Não informado',
      ),
    [scopedRecords],
  );

  const summary = useMemo(
    () => computeOperationalSummary(scopedRecords, hourlyBuckets, agentMetrics),
    [scopedRecords, hourlyBuckets, agentMetrics],
  );

  const impactAnalysis = useMemo(
    () => computeHourlyImpactAndLoginPlan(baseFilteredRecords, hourlyBuckets),
    [baseFilteredRecords, hourlyBuckets],
  );

  const impactByHour = useMemo(() => {
    const map = new Map<number, (typeof impactAnalysis.hourlyImpact)[number]>();
    for (const row of impactAnalysis.hourlyImpact) {
      map.set(row.hour, row);
    }
    return map;
  }, [impactAnalysis]);

  const handleExportFullReport = () => {
    if (!workbook) return;
    const filterParts: string[] = [];
    if (selectedDate !== 'all') {
      const dLabel = filterOptions.dates.find((d) => d.iso === selectedDate)?.display ?? selectedDate;
      filterParts.push(`Dia: ${dLabel}`);
    } else if (dateStart || dateEnd) {
      filterParts.push(`Período: ${dateStart || 'início'} até ${dateEnd || 'fim'}`);
    } else {
      filterParts.push('Todas as datas');
    }
    if (selectedQueue !== 'all') filterParts.push(`Fila: ${selectedQueue}`);
    if (selectedChatbot !== 'all') filterParts.push(`Chatbot: ${selectedChatbot}`);
    if (selectedHour !== null) {
      filterParts.push(`Hora selecionada: ${String(selectedHour).padStart(2, '0')}h`);
    }

    // Use full baseFilteredRecords for hourly/daily curves & login plan, and scopedRecords for summary/agents/channels
    const fullSummary =
      selectedHour === null
        ? summary
        : computeOperationalSummary(
            baseFilteredRecords,
            hourlyBuckets,
            computeAgentMetrics(baseFilteredRecords),
          );

    exportAnalyticalReportWorkbook({
      sourceFileName: workbook.fileName,
      segmentFilter,
      filterDescription: filterParts.join(' | '),
      records: scopedRecords,
      summary: selectedHour === null ? summary : fullSummary,
      hourlyImpact: impactAnalysis.hourlyImpact,
      criticalWindows: impactAnalysis.criticalWindows,
      safeWindows: impactAnalysis.safeWindows,
      dailyBuckets,
      agentMetrics,
      queueMetrics,
      chatbotMetrics,
      disconnectMetrics,
      surveyMetrics,
    });
  };

  const hasActiveFilters =
    segmentFilter !== 'all' ||
    selectedDate !== 'all' ||
    dateStart !== '' ||
    dateEnd !== '' ||
    selectedQueue !== 'all' ||
    selectedChatbot !== 'all' ||
    selectedHour !== null ||
    selectedOperatorTma !== 'all';

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeView)?.label ?? 'Painel';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      {/* Hidden global file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = '';
        }}
      />

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation (240px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform duration-150 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-15 items-center justify-between border-b border-slate-200 px-5">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Monitor de TMA
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const isDisabled = !workbook;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  setActiveView(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                  isActive && workbook
                    ? 'bg-slate-100 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Loaded Spreadsheet Summary in Sidebar Footer */}
        <div className="border-t border-slate-200 p-4 text-xs">
          {workbook ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-slate-700">
                <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900" title={workbook.fileName}>
                    {workbook.fileName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                    {workbook.voiceCount} Voice · {workbook.chatCount} Chat
                  </p>
                  {workbook.isSample && (
                    <p className="mt-0.5 text-[11px] font-medium text-amber-700">
                      Planilha de exemplo
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearWorkbook}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Trocar Planilha</span>
              </button>
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Aguardando upload da planilha com abas VOICE e CHAT.
            </p>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract */}
        <header className="flex h-15 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
              <span className="hidden text-slate-500 sm:inline whitespace-nowrap">
                Central de Operações
              </span>
              <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
                /
              </span>
              <span className="truncate font-display font-semibold text-slate-900">
                {workbook ? activeNavLabel : 'Importação de Planilha'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {workbook ? (
              <button
                type="button"
                onClick={handleExportFullReport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-blue-700" />
                <span>Relatório Completo (.xlsx)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={downloadTemplateWorkbook}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Baixar Modelo</span>
              </button>
            )}

            <button
              type="button"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{workbook ? 'Nova Planilha' : 'Carregar Planilha'}</span>
            </button>
          </div>
        </header>

        {/* Viewport Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {!workbook ? (
              <UploadEmptyState
                onFileSelected={handleFileUpload}
                onDownloadTemplate={downloadTemplateWorkbook}
                onLoadSample={handleLoadSample}
                isLoading={isLoading}
                errorMessage={errorMessage}
              />
            ) : (
              <div className="space-y-6">
                {/* Warnings from parser if any column header was unusual */}
                {workbook.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    <p className="font-semibold">Observações na leitura da planilha:</p>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {workbook.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Workspace Toolbar: Segment Switcher + Operational Filters */}
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Segment Switcher */}
                    <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSegmentFilter('all');
                          setSelectedChatbot('all');
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          segmentFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Todos ({workbook.records.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSegmentFilter('voice');
                          setSelectedChatbot('all');
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          segmentFilter === 'voice'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Voice ({workbook.voiceCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSegmentFilter('chat')}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          segmentFilter === 'chat'
                            ? 'bg-white text-teal-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Chat ({workbook.chatCount})
                      </button>
                    </div>

                    {/* Date Filter (Single Day) */}
                    <select
                      aria-label="Filtrar por dia do atendimento"
                      value={selectedDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedDate(val);
                        if (val !== 'all') {
                          setDateStart('');
                          setDateEnd('');
                        }
                      }}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:bg-white focus:outline-none"
                    >
                      <option value="all">Todas as datas ({filterOptions.dates.length})</option>
                      {filterOptions.dates.map((d) => (
                        <option key={d.iso} value={d.iso}>
                          {d.display}
                        </option>
                      ))}
                    </select>

                    {/* Date Range Filter (Período de Data - Full Year Unlocked) */}
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-500 whitespace-nowrap">Período</span>
                      <input
                        type="date"
                        aria-label="Data inicial do período"
                        value={dateStart}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDateStart(val);
                          if (val) {
                            setSelectedDate('all');
                            if (dateEnd && val > dateEnd) setDateEnd('');
                          }
                        }}
                        className="bg-transparent font-mono text-[11px] font-medium text-slate-700 tabular-nums focus:outline-none cursor-pointer"
                      />
                      <span className="text-slate-400" aria-hidden="true">
                        até
                      </span>
                      <input
                        type="date"
                        aria-label="Data final do período"
                        value={dateEnd}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDateEnd(val);
                          if (val) {
                            setSelectedDate('all');
                            if (dateStart && val < dateStart) setDateStart('');
                          }
                        }}
                        className="bg-transparent font-mono text-[11px] font-medium text-slate-700 tabular-nums focus:outline-none cursor-pointer"
                      />
                    </div>

                    {/* Queue Filter */}
                    <select
                      aria-label="Filtrar por fila de atendimento"
                      value={selectedQueue}
                      onChange={(e) => setSelectedQueue(e.target.value)}
                      className="max-w-[200px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:bg-white focus:outline-none"
                    >
                      <option value="all">Todas as filas</option>
                      {filterOptions.queues.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>

                    {/* Chatbot Origin Filter (when Chat is visible) */}
                    {segmentFilter !== 'voice' && filterOptions.chatbots.length > 0 && (
                      <select
                        aria-label="Filtrar por origem Chatbot"
                        value={selectedChatbot}
                        onChange={(e) => setSelectedChatbot(e.target.value)}
                        className="max-w-[200px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:bg-white focus:outline-none"
                      >
                        <option value="all">Chatbot: Todos</option>
                        {filterOptions.chatbots.map((c) => (
                          <option key={c} value={c}>
                            Chatbot: {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500 tabular-nums lg:justify-end">
                    <span>
                      Abas: {workbook.detectedSheets.voice ?? '-'} / {workbook.detectedSheets.chat ?? '-'}
                    </span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                </div>

                {/* 4-Column KPI Strip */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-medium text-slate-500">TMA Geral</p>
                    <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                      {formatTma(summary.overallTmaSeconds)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      Voice {formatTma(summary.voiceTmaSeconds)} · Chat {formatTma(summary.chatTmaSeconds)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-medium text-slate-500">Maior Pico de Fluxo</p>
                    <p className="mt-1.5 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
                      {summary.peakHours[0] ? summary.peakHours[0].rangeLabel : '--:--'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {summary.peakHours[0]
                        ? `${summary.peakHours[0].totalCount} atend. (${summary.peakHours[0].sharePercent.toFixed(1)}% do fluxo)`
                        : 'Sem registros'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-medium text-slate-500">Média por Atendente / Dia</p>
                    <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                      {summary.teamAvgCallsPerAgentPerDay.toFixed(1)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {summary.activeAgentsCount} atendente(s) · {summary.totalRecords} atend. no recorte
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-medium text-slate-500">
                      {segmentFilter === 'chat'
                        ? 'Principal Origem Chatbot'
                        : segmentFilter === 'voice'
                          ? 'Transferência para Pesquisa'
                          : 'Pesquisa Voice · Origem Chat'}
                    </p>
                    <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                      {segmentFilter === 'chat'
                        ? chatbotMetrics[0]
                          ? `${chatbotMetrics[0].sharePercent.toFixed(0)}%`
                          : 'N/A'
                        : summary.surveyTransferRatePercent !== null
                          ? `${summary.surveyTransferRatePercent.toFixed(1)}%`
                          : 'N/A'}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500 tabular-nums">
                      {segmentFilter === 'chat'
                        ? chatbotMetrics[0]
                          ? `${chatbotMetrics[0].name} (${chatbotMetrics[0].count} chats)`
                          : 'Sem dados Chatbot'
                        : segmentFilter === 'voice'
                          ? `${summary.surveyTransferYesCount} transferidos de ${summary.surveyTransferTotalVoice} ligações`
                          : chatbotMetrics[0]
                            ? `Pesquisa Voice · Chat top: ${chatbotMetrics[0].name} (${chatbotMetrics[0].sharePercent.toFixed(0)}%)`
                            : `${summary.surveyTransferYesCount} transferidos para pesquisa`}
                    </p>
                  </div>
                </div>

                {/* VIEW 1: OVERVIEW (TMA Curve + Peak Windows Action Panel + Compact Agent Preview) */}
                {activeView === 'overview' && (
                  <>
                    <TmaPeakChart
                      hourlyBuckets={hourlyBuckets}
                      dailyBuckets={dailyBuckets}
                      segmentFilter={segmentFilter}
                      overallTmaSeconds={summary.overallTmaSeconds}
                      selectedHour={selectedHour}
                      onSelectHour={setSelectedHour}
                    />

                    {/* Actionable Peak Hours & Critical Login Panel */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7">
                        <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h2 className="font-display text-base font-semibold text-slate-900">
                              Janelas Críticas de Pico e Logins
                            </h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Horários de maior impacto, dimensionamento necessário e horário crítico de login
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleExportFullReport}
                            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5 text-blue-700" />
                            <span>Baixar Relatório (.xlsx)</span>
                          </button>
                        </div>

                        {summary.peakHours.length === 0 ? (
                          <p className="py-8 text-center text-xs text-slate-500">
                            Nenhum horário com atendimento no filtro selecionado.
                          </p>
                        ) : (
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                                  <th className="py-2.5 pr-3">Faixa Horária</th>
                                  <th className="py-2.5 px-2 text-right">Volume</th>
                                  <th className="py-2.5 px-2 text-right">TMA</th>
                                  <th className="py-2.5 px-2 text-right">Escala Rec.</th>
                                  <th className="py-2.5 px-2">Login Crítico</th>
                                  <th className="py-2.5 pl-2 text-right">Ação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 tabular-nums">
                                {summary.peakHours.map((pk, idx) => {
                                  const impact = impactByHour.get(pk.hour);
                                  return (
                                    <tr key={pk.hour} className="h-11">
                                      <td className="py-2 pr-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                        {idx + 1}. {pk.rangeLabel}
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono text-slate-800 whitespace-nowrap">
                                        {pk.totalCount} ({pk.sharePercent.toFixed(1)}%)
                                      </td>
                                      <td
                                        className={`py-2 px-2 text-right font-mono font-semibold whitespace-nowrap ${
                                          pk.isTmaSpike ? 'text-red-700' : 'text-amber-700'
                                        }`}
                                      >
                                        {formatTma(pk.tmaSeconds)}
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono text-slate-700 whitespace-nowrap">
                                        {impact
                                          ? `${impact.recommendedAgents} rec. (${impact.observedAgentsAvg} obs.)`
                                          : '-'}
                                      </td>
                                      <td className="py-2 px-2 font-mono font-semibold text-blue-700 whitespace-nowrap">
                                        {impact?.criticalLoginTime ?? '-'}
                                      </td>
                                      <td className="py-2 pl-2 text-right">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSelectedHour(selectedHour === pk.hour ? null : pk.hour)
                                          }
                                          className="font-medium text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
                                        >
                                          {selectedHour === pk.hour ? 'Remover' : 'Filtrar'}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {impactAnalysis.criticalWindows.length > 0 && (
                          <div className="mt-4 border-t border-slate-200 pt-3">
                            <p className="text-xs font-semibold text-slate-800">
                              Solução sugerida por onda de pico
                            </p>
                            <ul className="mt-2 space-y-2 text-xs text-slate-600">
                              {impactAnalysis.criticalWindows.slice(0, 3).map((w) => (
                                <li key={w.windowLabel} className="leading-relaxed">
                                  <span className="font-mono font-semibold text-slate-900">
                                    {w.windowLabel}
                                  </span>{' '}
                                  · Login crítico:{' '}
                                  <span className="font-mono font-semibold text-blue-700">
                                    {w.criticalLoginTime}
                                  </span>{' '}
                                  — {w.solutionSummary}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5">
                        <div className="border-b border-slate-200 pb-3">
                          <h2 className="font-display text-base font-semibold text-slate-900">
                            Leitura Operacional do Recorte
                          </h2>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Indicadores calculados diretamente da planilha carregada
                          </p>
                        </div>

                        <dl className="mt-4 divide-y divide-slate-100 text-xs tabular-nums">
                          <div className="flex items-center justify-between py-2.5">
                            <dt className="text-slate-600">Concentração nas 3 horas de pico</dt>
                            <dd className="font-mono font-semibold text-slate-900">
                              {summary.peakConcentrationPercent.toFixed(1)}% do volume
                            </dd>
                          </div>
                          <div className="flex items-center justify-between py-2.5">
                            <dt className="text-slate-600">Pressão pico vs fora do pico</dt>
                            <dd className="font-mono font-semibold text-blue-700">
                              {summary.peakVsOffPeakRatio.toFixed(2)}x mais fluxo
                            </dd>
                          </div>
                          <div className="flex items-center justify-between py-2.5">
                            <dt className="text-slate-600">Horário de maior TMA</dt>
                            <dd className="font-mono font-semibold text-amber-700">
                              {summary.highestTmaHour
                                ? `${summary.highestTmaHour.rangeLabel} (${formatTma(summary.highestTmaHour.tmaSeconds)})`
                                : '--'}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between py-2.5">
                            <dt className="text-slate-600">Janela segura p/ pausas</dt>
                            <dd className="font-mono font-semibold text-teal-700">
                              {impactAnalysis.safeWindows[0]?.windowLabel ?? '--'}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between py-2.5">
                            <dt className="text-slate-600">Dias cobertos no recorte</dt>
                            <dd className="font-mono font-semibold text-slate-900">
                              {summary.activeDaysCount} dia(s)
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                          <span className="text-xs text-slate-500">
                            Deseja inspecionar as médias por operador?
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveView('agents')}
                            className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                          >
                            Ver Atendentes →
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Compact Agent Preview right on overview so user sees agent averages immediately */}
                    <AgentAverageChart
                      agents={agentMetrics}
                      segmentFilter={segmentFilter}
                      teamAvgCallsPerDay={summary.teamAvgCallsPerAgentPerDay}
                      overallTmaSeconds={summary.overallTmaSeconds}
                      selectedAgent={selectedAgent}
                      onSelectAgent={setSelectedAgent}
                      compact
                    />
                  </>
                )}

                {/* VIEW 2: FULL AGENT PERSPECTIVE */}
                {activeView === 'agents' && (
                  <AgentAverageChart
                    agents={agentMetrics}
                    segmentFilter={segmentFilter}
                    teamAvgCallsPerDay={summary.teamAvgCallsPerAgentPerDay}
                    overallTmaSeconds={summary.overallTmaSeconds}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                  />
                )}

                {/* VIEW 2B: TMA BY OPERATOR WITH OPERATOR + PERIOD FILTERS */}
                {activeView === 'operator-tma' && (
                  <OperatorTmaView
                    records={scopedRecords}
                    segmentFilter={segmentFilter}
                    availableOperators={filterOptions.agents}
                    selectedOperator={selectedOperatorTma}
                    onSelectOperator={setSelectedOperatorTma}
                    dateStart={dateStart}
                    dateEnd={dateEnd}
                    selectedDate={selectedDate}
                    onChangeDateStart={(val) => {
                      setDateStart(val);
                      if (val) {
                        setSelectedDate('all');
                        if (dateEnd && val > dateEnd) setDateEnd('');
                      }
                    }}
                    onChangeDateEnd={(val) => {
                      setDateEnd(val);
                      if (val) {
                        setSelectedDate('all');
                        if (dateStart && val < dateStart) setDateStart('');
                      }
                    }}
                    onClearPeriod={() => {
                      setSelectedDate('all');
                      setDateStart('');
                      setDateEnd('');
                    }}
                  />
                )}

                {/* VIEW 3: QUEUES & CHANNELS (Chatbot Origin + Voice Survey + Disconnects) */}
                {activeView === 'channels' && (
                  <ChannelQueueBreakdown
                    queues={queueMetrics}
                    chatbotSources={chatbotMetrics}
                    disconnects={disconnectMetrics}
                    surveyBreakdown={surveyMetrics}
                    segmentFilter={segmentFilter}
                    selectedQueue={selectedQueue}
                    onSelectQueue={setSelectedQueue}
                  />
                )}

                {/* VIEW 4: RAW SPREADSHEET RECORDS TABLE */}
                {activeView === 'records' && <RecordsTable records={scopedRecords} />}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
