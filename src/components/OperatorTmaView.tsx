import React, {useMemo, useState} from 'react';
import {RotateCcw, Search, UserCheck} from 'lucide-react';
import type {AttendanceRecord, SegmentFilter} from '../types/operations';
import {
  computeAgentMetrics,
  computeCategoryBreakdown,
  computeDailyCurve,
  computeHourlyCurve,
  formatTma,
} from '../utils/analytics';
import {TmaPeakChart} from './TmaPeakChart';

interface OperatorTmaViewProps {
  records: AttendanceRecord[];
  segmentFilter: SegmentFilter;
  availableOperators: string[];
  selectedOperator: string;
  onSelectOperator: (operator: string) => void;
  dateStart: string;
  dateEnd: string;
  selectedDate: string;
  onChangeDateStart: (value: string) => void;
  onChangeDateEnd: (value: string) => void;
  onClearPeriod: () => void;
}

type SortMode = 'tmaDesc' | 'tmaAsc' | 'volumeDesc' | 'nameAsc';

export const OperatorTmaView: React.FC<OperatorTmaViewProps> = ({
  records,
  segmentFilter,
  availableOperators,
  selectedOperator,
  onSelectOperator,
  dateStart,
  dateEnd,
  selectedDate,
  onChangeDateStart,
  onChangeDateEnd,
  onClearPeriod,
}) => {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('tmaDesc');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const allAgents = useMemo(() => computeAgentMetrics(records), [records]);

  const teamOverallTma = useMemo(() => {
    if (records.length === 0) return 0;
    const total = records.reduce((s, r) => s + r.durationSeconds, 0);
    return Math.round(total / records.length);
  }, [records]);

  const operatorRecords = useMemo(() => {
    if (selectedOperator === 'all') return records;
    return records.filter((r) => r.agent === selectedOperator);
  }, [records, selectedOperator]);

  const operatorHourlyFiltered = useMemo(() => {
    if (selectedHour === null) return operatorRecords;
    return operatorRecords.filter((r) => r.entryHour === selectedHour);
  }, [operatorRecords, selectedHour]);

  const selectedMetric = useMemo(() => {
    if (selectedOperator === 'all') return null;
    return allAgents.find((a) => a.agent === selectedOperator) ?? null;
  }, [allAgents, selectedOperator]);

  const displayedAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? allAgents.filter((a) => a.agent.toLowerCase().includes(q)) : allAgents;
    return [...list].sort((a, b) => {
      if (sortMode === 'tmaDesc') return b.tmaSeconds - a.tmaSeconds;
      if (sortMode === 'tmaAsc') return a.tmaSeconds - b.tmaSeconds;
      if (sortMode === 'volumeDesc') return b.totalCalls - a.totalCalls;
      return a.agent.localeCompare(b.agent, 'pt-BR');
    });
  }, [allAgents, search, sortMode]);

  const maxTmaScale = useMemo(() => {
    if (displayedAgents.length === 0) return 60;
    return Math.max(60, teamOverallTma * 1.25, ...displayedAgents.map((a) => a.tmaSeconds));
  }, [displayedAgents, teamOverallTma]);

  const teamTmaRefPct = Math.min(98, Math.max(2, (teamOverallTma / maxTmaScale) * 100));

  // Curves & breakdowns for selected operator (or filtered set)
  const opHourlyBuckets = useMemo(() => computeHourlyCurve(operatorRecords), [operatorRecords]);
  const opDailyBuckets = useMemo(() => computeDailyCurve(operatorRecords), [operatorRecords]);
  const opQueues = useMemo(
    () => computeCategoryBreakdown(operatorHourlyFiltered, (r) => r.queue),
    [operatorHourlyFiltered],
  );
  const opDisconnects = useMemo(
    () => computeCategoryBreakdown(operatorHourlyFiltered, (r) => r.disconnectReason),
    [operatorHourlyFiltered],
  );

  const summaryStats = useMemo(() => {
    const src = operatorHourlyFiltered;
    const voice = src.filter((r) => r.segment === 'voice');
    const chat = src.filter((r) => r.segment === 'chat');
    const avg = (list: AttendanceRecord[]) =>
      list.length > 0 ? Math.round(list.reduce((s, r) => s + r.durationSeconds, 0) / list.length) : 0;
    const activeDays = new Set(src.map((r) => r.attendanceDate).filter((d) => d && d !== 'Sem data')).size;
    const overallTma = avg(src);
    return {
      total: src.length,
      voiceCount: voice.length,
      chatCount: chat.length,
      overallTma,
      voiceTma: avg(voice),
      chatTma: avg(chat),
      activeDays: Math.max(src.length > 0 ? 1 : 0, activeDays),
      deltaVsTeam: overallTma - teamOverallTma,
    };
  }, [operatorHourlyFiltered, teamOverallTma]);

  const highestOperator = useMemo(
    () => (allAgents.length > 0 ? [...allAgents].sort((a, b) => b.tmaSeconds - a.tmaSeconds)[0] : null),
    [allAgents],
  );
  const lowestOperator = useMemo(
    () => (allAgents.length > 0 ? [...allAgents].sort((a, b) => a.tmaSeconds - b.tmaSeconds)[0] : null),
    [allAgents],
  );

  return (
    <div className="space-y-6">
      {/* Dedicated Filter Bar: Operador + Período */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              TMA por Operador
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Filtre por operador e período para analisar o TMA individual, evolução diária e filas atendidas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Operator Select */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="operator-tma-select"
                className="text-[11px] font-medium text-slate-500"
              >
                Operador
              </label>
              <select
                id="operator-tma-select"
                value={selectedOperator}
                onChange={(e) => {
                  onSelectOperator(e.target.value);
                  setSelectedHour(null);
                }}
                className="min-w-[210px] max-w-[260px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                <option value="all">Todos os operadores ({availableOperators.length})</option>
                {availableOperators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Filter (Full Year Unlocked) */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-500">Período</span>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                <input
                  type="date"
                  aria-label="Data inicial do período por operador"
                  value={dateStart}
                  onChange={(e) => onChangeDateStart(e.target.value)}
                  className="bg-transparent font-mono text-[11px] font-medium text-slate-800 tabular-nums focus:outline-none cursor-pointer"
                />
                <span className="text-slate-400" aria-hidden="true">
                  até
                </span>
                <input
                  type="date"
                  aria-label="Data final do período por operador"
                  value={dateEnd}
                  onChange={(e) => onChangeDateEnd(e.target.value)}
                  className="bg-transparent font-mono text-[11px] font-medium text-slate-800 tabular-nums focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {(selectedOperator !== 'all' || dateStart !== '' || dateEnd !== '' || selectedDate !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  onSelectOperator('all');
                  onClearPeriod();
                  setSelectedHour(null);
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Strip for Selected Operator / Period */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            {selectedOperator === 'all' ? 'TMA Médio da Equipe' : `TMA — ${selectedOperator}`}
          </p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {formatTma(summaryStats.overallTma)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Voice {formatTma(summaryStats.voiceTma)} · Chat {formatTma(summaryStats.chatTma)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Atendimentos no Período</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {summaryStats.total}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {summaryStats.voiceCount} Voice · {summaryStats.chatCount} Chat ({summaryStats.activeDays} dia(s))
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            {selectedOperator === 'all' ? 'Maior TMA do Período' : 'Diferença vs Equipe'}
          </p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {selectedOperator === 'all'
              ? highestOperator
                ? formatTma(highestOperator.tmaSeconds)
                : '--:--'
              : `${summaryStats.deltaVsTeam >= 0 ? '+' : '-'}${formatTma(Math.abs(summaryStats.deltaVsTeam))}`}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 tabular-nums">
            {selectedOperator === 'all'
              ? highestOperator
                ? `${highestOperator.agent} (${highestOperator.totalCalls} atend.)`
                : 'Sem registros'
              : `Média da equipe: ${formatTma(teamOverallTma)}`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            {selectedOperator === 'all' ? 'Menor TMA do Período' : 'Média Diária do Operador'}
          </p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {selectedOperator === 'all'
              ? lowestOperator
                ? formatTma(lowestOperator.tmaSeconds)
                : '--:--'
              : selectedMetric
                ? `${selectedMetric.avgCallsPerDay.toFixed(1)}/dia`
                : summaryStats.activeDays > 0
                  ? `${(summaryStats.total / summaryStats.activeDays).toFixed(1)}/dia`
                  : '0.0/dia'}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 tabular-nums">
            {selectedOperator === 'all'
              ? lowestOperator
                ? `${lowestOperator.agent} (${lowestOperator.totalCalls} atend.)`
                : 'Sem registros'
              : selectedMetric && selectedMetric.surveyRatePercent !== null
                ? `Pesquisa Voice: ${selectedMetric.surveyRatePercent.toFixed(0)}%`
                : `${allAgents.length} operador(es) no período`}
          </p>
        </div>
      </div>

      {/* Mode 1: All Operators TMA Ranking + Analytical Table */}
      {selectedOperator === 'all' ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Comparativo de TMA por Operador
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Linha tracejada indica o TMA médio da equipe ({formatTma(teamOverallTma)}) · Clique em um operador para abrir a curva detalhada
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar operador..."
                    className="w-44 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
                  {(
                    [
                      ['tmaDesc', 'Maior TMA'],
                      ['tmaAsc', 'Menor TMA'],
                      ['volumeDesc', 'Volume'],
                      ['nameAsc', 'Nome'],
                    ] as [SortMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSortMode(mode)}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        sortMode === mode
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {displayedAgents.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-500">
                Nenhum operador encontrado no período selecionado.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {displayedAgents.map((agent) => {
                  const pct = Math.min(100, Math.max(3, (agent.tmaSeconds / maxTmaScale) * 100));
                  const aboveAvg = teamOverallTma > 0 && agent.tmaSeconds > teamOverallTma * 1.1;
                  const delta = agent.deltaFromTeamTmaSeconds;

                  return (
                    <button
                      key={agent.agent}
                      type="button"
                      onClick={() => {
                        onSelectOperator(agent.agent);
                        setSelectedHour(null);
                      }}
                      className="group flex w-full flex-col gap-1.5 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4 cursor-pointer"
                    >
                      <div className="flex w-full items-center justify-between sm:w-52 sm:shrink-0">
                        <span className="truncate text-xs font-medium text-slate-900">{agent.agent}</span>
                        <span className="font-mono text-[11px] font-semibold text-slate-800 tabular-nums sm:hidden">
                          {formatTma(agent.tmaSeconds)}
                        </span>
                      </div>

                      <div className="relative h-6 flex-1 rounded bg-slate-100">
                        <div
                          className={`h-full rounded transition-all duration-200 ${
                            aboveAvg ? 'bg-amber-300' : 'bg-blue-300'
                          }`}
                          style={{width: `${pct}%`}}
                        />
                        <div
                          className="pointer-events-none absolute top-0 bottom-0 w-px border-l border-dashed border-slate-700/70"
                          style={{left: `${teamTmaRefPct}%`}}
                        />
                        <span
                          className="pointer-events-none absolute top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold tabular-nums text-slate-900"
                          style={{
                            left: pct > 78 ? undefined : `calc(${pct}% + 8px)`,
                            right: pct > 78 ? '8px' : undefined,
                            color: '#0F172A',
                          }}
                        >
                          {formatTma(agent.tmaSeconds)}
                        </span>
                      </div>

                      <div className="hidden w-64 shrink-0 items-center justify-end gap-3 text-right font-mono text-[11px] text-slate-600 tabular-nums sm:flex">
                        <span>{agent.totalCalls} atend.</span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          V {formatTma(agent.voiceTmaSeconds)} / C {formatTma(agent.chatTmaSeconds)}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className={delta > 0 ? 'text-amber-700' : 'text-teal-700'}>
                          {delta >= 0 ? '+' : '-'}
                          {formatTma(Math.abs(delta))}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Complete Tabular Summary per Operator */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Tabela de TMA por Operador
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Consolidado de volume, média diária e TMA separado por Voice e Chat no período filtrado
              </p>
            </div>

            {displayedAgents.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">Sem dados para exibir.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 pr-3">Operador</th>
                      <th className="py-2.5 px-2 text-right">Atend.</th>
                      <th className="py-2.5 px-2 text-right">Voice</th>
                      <th className="py-2.5 px-2 text-right">Chat</th>
                      <th className="py-2.5 px-2 text-right">Dias</th>
                      <th className="py-2.5 px-2 text-right">Média/Dia</th>
                      <th className="py-2.5 px-2 text-right">TMA Voice</th>
                      <th className="py-2.5 px-2 text-right">TMA Chat</th>
                      <th className="py-2.5 px-2 text-right">TMA Geral</th>
                      <th className="py-2.5 pl-2 text-right">vs Equipe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {displayedAgents.map((agent) => (
                      <tr
                        key={`row-${agent.agent}`}
                        onClick={() => {
                          onSelectOperator(agent.agent);
                          setSelectedHour(null);
                        }}
                        className="h-10 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap">
                          {agent.agent}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-800">
                          {agent.totalCalls}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600">
                          {agent.voiceCalls}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600">
                          {agent.chatCalls}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600">
                          {agent.activeDays}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-700">
                          {agent.avgCallsPerDay.toFixed(1)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-700">
                          {formatTma(agent.voiceTmaSeconds)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-700">
                          {formatTma(agent.chatTmaSeconds)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-semibold text-amber-700">
                          {formatTma(agent.tmaSeconds)}
                        </td>
                        <td
                          className={`py-2 pl-2 text-right font-mono font-medium ${
                            agent.deltaFromTeamTmaSeconds > 0 ? 'text-amber-700' : 'text-teal-700'
                          }`}
                        >
                          {agent.deltaFromTeamTmaSeconds >= 0 ? '+' : '-'}
                          {formatTma(Math.abs(agent.deltaFromTeamTmaSeconds))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Mode 2: Specific Operator Selected */
        <>
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-slate-800">
              <UserCheck className="h-4 w-4 text-blue-700" />
              <span>
                Exibindo curva de TMA e atendimentos de{' '}
                <strong className="font-semibold text-slate-900">{selectedOperator}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectOperator('all');
                setSelectedHour(null);
              }}
              className="font-medium text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
            >
              Ver todos os operadores
            </button>
          </div>

          <TmaPeakChart
            hourlyBuckets={opHourlyBuckets}
            dailyBuckets={opDailyBuckets}
            segmentFilter={segmentFilter}
            overallTmaSeconds={summaryStats.overallTma}
            selectedHour={selectedHour}
            onSelectHour={setSelectedHour}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Daily breakdown for this operator */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  TMA Diário do Operador no Período
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Evolução dia a dia de atendimentos e TMA para {selectedOperator}
                </p>
              </div>

              {opDailyBuckets.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Nenhum atendimento encontrado para este operador no período.
                </p>
              ) : (
                <div className="mt-3 max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2 pr-3">Data</th>
                        <th className="py-2 px-2 text-right">Total</th>
                        <th className="py-2 px-2 text-right">Voice</th>
                        <th className="py-2 px-2 text-right">Chat</th>
                        <th className="py-2 px-2 text-right">TMA Voice</th>
                        <th className="py-2 px-2 text-right">TMA Chat</th>
                        <th className="py-2 pl-2 text-right">TMA Dia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 tabular-nums">
                      {opDailyBuckets.map((day) => (
                        <tr key={day.date} className="h-9">
                          <td className="py-1.5 pr-3 font-mono font-medium text-slate-900">
                            {day.dateDisplay}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-800">
                            {day.totalCount}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                            {day.voiceCount}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                            {day.chatCount}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                            {formatTma(day.voiceTmaSeconds)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                            {formatTma(day.chatTmaSeconds)}
                          </td>
                          <td className="py-1.5 pl-2 text-right font-mono font-semibold text-amber-700">
                            {formatTma(day.tmaSeconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Queues & Disconnects for selected operator */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Filas e Desligamentos
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Distribuição dos atendimentos de {selectedOperator}
                </p>
              </div>

              <div className="mt-4 space-y-5">
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">Filas atendidas</h4>
                  {opQueues.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Sem filas registradas.</p>
                  ) : (
                    <div className="mt-2 divide-y divide-slate-100 text-xs tabular-nums">
                      {opQueues.map((q) => (
                        <div key={q.name} className="flex items-center justify-between py-2 gap-2">
                          <span className="truncate text-slate-700">{q.name}</span>
                          <span className="shrink-0 font-mono text-slate-900">
                            {q.count} ({q.sharePercent.toFixed(0)}%) · {formatTma(q.tmaSeconds)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-700">Desligamento</h4>
                  {opDisconnects.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Sem registros.</p>
                  ) : (
                    <div className="mt-2 divide-y divide-slate-100 text-xs tabular-nums">
                      {opDisconnects.map((d) => (
                        <div key={d.name} className="flex items-center justify-between py-2 gap-2">
                          <span className="truncate text-slate-700">{d.name}</span>
                          <span className="shrink-0 font-mono text-slate-900">
                            {d.count} ({d.sharePercent.toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
