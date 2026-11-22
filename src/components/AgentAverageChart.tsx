import React, {useMemo, useState} from 'react';
import {Search, X} from 'lucide-react';
import type {AgentMetric, SegmentFilter} from '../types/operations';
import {formatTma} from '../utils/analytics';

interface AgentAverageChartProps {
  agents: AgentMetric[];
  segmentFilter: SegmentFilter;
  teamAvgCallsPerDay: number;
  overallTmaSeconds: number;
  selectedAgent: string | null;
  onSelectAgent: (agent: string | null) => void;
  compact?: boolean;
}

type MetricView = 'avgPerDay' | 'totalCalls' | 'tma';

export const AgentAverageChart: React.FC<AgentAverageChartProps> = ({
  agents,
  segmentFilter,
  teamAvgCallsPerDay,
  overallTmaSeconds,
  selectedAgent,
  onSelectAgent,
  compact = false,
}) => {
  const [metricView, setMetricView] = useState<MetricView>('avgPerDay');
  const [search, setSearch] = useState('');

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? agents.filter((a) => a.agent.toLowerCase().includes(q)) : agents;

    return [...list].sort((a, b) => {
      if (metricView === 'avgPerDay') return b.avgCallsPerDay - a.avgCallsPerDay;
      if (metricView === 'totalCalls') return b.totalCalls - a.totalCalls;
      return b.tmaSeconds - a.tmaSeconds;
    });
  }, [agents, search, metricView]);

  const displayedAgents = compact ? filteredAndSorted.slice(0, 8) : filteredAndSorted;

  const teamAvgTotalCalls =
    agents.length > 0 ? agents.reduce((s, a) => s + a.totalCalls, 0) / agents.length : 0;

  const maxScale = useMemo(() => {
    if (displayedAgents.length === 0) return 1;
    if (metricView === 'avgPerDay') {
      return Math.max(1, teamAvgCallsPerDay * 1.25, ...displayedAgents.map((a) => a.avgCallsPerDay));
    }
    if (metricView === 'totalCalls') {
      return Math.max(1, teamAvgTotalCalls * 1.25, ...displayedAgents.map((a) => a.totalCalls));
    }
    return Math.max(60, overallTmaSeconds * 1.25, ...displayedAgents.map((a) => a.tmaSeconds));
  }, [displayedAgents, metricView, teamAvgCallsPerDay, teamAvgTotalCalls, overallTmaSeconds]);

  const teamRefValue =
    metricView === 'avgPerDay'
      ? teamAvgCallsPerDay
      : metricView === 'totalCalls'
        ? teamAvgTotalCalls
        : overallTmaSeconds;

  const teamRefPercent = Math.min(98, Math.max(2, (teamRefValue / maxScale) * 100));

  const inspectedAgent = useMemo(
    () => (selectedAgent ? agents.find((a) => a.agent === selectedAgent) ?? null : null),
    [agents, selectedAgent],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Média de Chamadas e TMA por Atendente
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Comparativo individual frente à média da equipe (linha tracejada) · Clique em um atendente para detalhar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!compact && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar atendente..."
                className="w-44 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMetricView('avgPerDay')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                metricView === 'avgPerDay'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Média / Dia
            </button>
            <button
              type="button"
              onClick={() => setMetricView('totalCalls')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                metricView === 'totalCalls'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Volume Total
            </button>
            <button
              type="button"
              onClick={() => setMetricView('tma')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                metricView === 'tma'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              TMA Médio
            </button>
          </div>
        </div>
      </div>

      {displayedAgents.length === 0 ? (
        <p className="py-10 text-center text-xs text-slate-500">
          Nenhum atendente encontrado com os filtros atuais.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Bar Chart List */}
          <div className={inspectedAgent ? 'xl:col-span-7' : 'xl:col-span-12'}>
            {/* Reference Header */}
            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Atendente</span>
              <div className="flex items-center gap-4 tabular-nums">
                <span>
                  Média da equipe:{' '}
                  <strong className="font-mono font-semibold text-slate-800">
                    {metricView === 'avgPerDay'
                      ? `${teamAvgCallsPerDay.toFixed(1)}/dia`
                      : metricView === 'totalCalls'
                        ? `${teamAvgTotalCalls.toFixed(1)} atend.`
                        : formatTma(overallTmaSeconds)}
                  </strong>
                </span>
                <span className="hidden sm:inline">TMA · Voice / Chat</span>
              </div>
            </div>

            <div className="relative space-y-2">
              {displayedAgents.map((agent) => {
                const val =
                  metricView === 'avgPerDay'
                    ? agent.avgCallsPerDay
                    : metricView === 'totalCalls'
                      ? agent.totalCalls
                      : agent.tmaSeconds;

                const pct = Math.min(100, Math.max(2, (val / maxScale) * 100));
                const isSelected = selectedAgent === agent.agent;

                const isAboveAvg =
                  metricView === 'tma'
                    ? agent.tmaSeconds > overallTmaSeconds * 1.1
                    : val >= teamRefValue;

                const barColor =
                  metricView === 'tma'
                    ? agent.tmaSeconds > overallTmaSeconds * 1.15
                      ? 'bg-amber-600'
                      : 'bg-slate-600'
                    : isAboveAvg
                      ? 'bg-blue-700'
                      : 'bg-slate-400';

                const voiceShare = agent.totalCalls > 0 ? (agent.voiceCalls / agent.totalCalls) * 100 : 0;

                return (
                  <button
                    key={agent.agent}
                    type="button"
                    onClick={() => onSelectAgent(isSelected ? null : agent.agent)}
                    className={`group flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors sm:flex-row sm:items-center sm:gap-4 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50'
                        : 'border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between sm:w-48 sm:shrink-0">
                      <span className="truncate text-xs font-medium text-slate-900">{agent.agent}</span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums sm:hidden">
                        {metricView === 'avgPerDay'
                          ? `${agent.avgCallsPerDay.toFixed(1)}/dia`
                          : metricView === 'totalCalls'
                            ? `${agent.totalCalls}`
                            : formatTma(agent.tmaSeconds)}
                      </span>
                    </div>

                    {/* Horizontal Bar with Team Average Marker */}
                    <div className="relative h-6 flex-1 rounded bg-slate-200/70">
                      {metricView !== 'tma' && segmentFilter === 'all' ? (
                        <div
                          className="flex h-full overflow-hidden rounded transition-all duration-200"
                          style={{width: `${pct}%`}}
                        >
                          <div
                            className="h-full bg-blue-700"
                            style={{width: `${voiceShare}%`}}
                            title={`Voice: ${agent.voiceCalls}`}
                          />
                          <div
                            className="h-full bg-teal-600"
                            style={{width: `${100 - voiceShare}%`}}
                            title={`Chat: ${agent.chatCalls}`}
                          />
                        </div>
                      ) : (
                        <div
                          className={`h-full rounded transition-all duration-200 ${barColor}`}
                          style={{width: `${pct}%`}}
                        />
                      )}

                      {/* Team Average Vertical Reference Line */}
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 w-px border-l border-dashed border-slate-800/70"
                        style={{left: `${teamRefPercent}%`}}
                      />

                      {/* Value inside or beside bar */}
                      <span
                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold tabular-nums text-slate-900"
                        style={{
                          left: pct > 78 ? undefined : `calc(${pct}% + 8px)`,
                          right: pct > 78 ? '8px' : undefined,
                          color: pct > 78 ? '#FFFFFF' : '#0F172A',
                        }}
                      >
                        {metricView === 'avgPerDay'
                          ? `${agent.avgCallsPerDay.toFixed(1)}/dia`
                          : metricView === 'totalCalls'
                            ? `${agent.totalCalls}`
                            : formatTma(agent.tmaSeconds)}
                      </span>
                    </div>

                    {/* Right Metadata */}
                    <div className="hidden w-44 shrink-0 items-center justify-end gap-3 text-right font-mono text-[11px] text-slate-600 tabular-nums sm:flex">
                      <span>TMA {formatTma(agent.tmaSeconds)}</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-slate-500">
                        {agent.voiceCalls}V / {agent.chatCalls}C
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Agent Detail Panel */}
          {inspectedAgent && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 xl:col-span-5">
              <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Perspectiva individual</p>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {inspectedAgent.agent}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectAgent(null)}
                  aria-label="Fechar detalhes do atendente"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 tabular-nums">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">Média / Dia</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900">
                    {inspectedAgent.avgCallsPerDay.toFixed(1)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {inspectedAgent.deltaFromTeamAvgCalls >= 0 ? '+' : ''}
                    {inspectedAgent.deltaFromTeamAvgCalls.toFixed(1)} vs equipe
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">TMA Médio</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold text-amber-700">
                    {formatTma(inspectedAgent.tmaSeconds)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {inspectedAgent.deltaFromTeamTmaSeconds >= 0 ? '+' : '-'}
                    {formatTma(Math.abs(inspectedAgent.deltaFromTeamTmaSeconds))} vs equipe
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">Voice · Chat</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                    {inspectedAgent.voiceCalls} · {inspectedAgent.chatCalls}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {inspectedAgent.activeDays} dia(s) ativo(s)
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">Pesquisa (Voice)</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                    {inspectedAgent.surveyRatePercent !== null
                      ? `${inspectedAgent.surveyRatePercent.toFixed(0)}%`
                      : 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {inspectedAgent.surveyYesCount} de {inspectedAgent.surveyEligibleCount} elegíveis
                  </p>
                </div>
              </div>

              {/* Mini Hourly Distribution for Selected Agent */}
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-700">Distribuição horária deste atendente</p>
                <div className="mt-2 flex h-20 items-end gap-1 rounded-lg border border-slate-200 bg-white px-2.5 pb-2 pt-3">
                  {inspectedAgent.hourlyVolume.slice(7, 22).map((vol, i) => {
                    const hour = i + 7;
                    const maxAgentHour = Math.max(1, ...inspectedAgent.hourlyVolume);
                    const hPct = Math.round((vol / maxAgentHour) * 100);
                    return (
                      <div key={hour} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-11 w-full items-end">
                          <div
                            className={`w-full rounded-t-xs ${vol > 0 ? 'bg-blue-700' : 'bg-slate-100'}`}
                            style={{height: `${Math.max(vol > 0 ? 12 : 4, hPct)}%`}}
                            title={`${String(hour).padStart(2, '0')}h: ${vol} atendimentos`}
                          />
                        </div>
                        <span className="font-mono text-[9px] text-slate-500 tabular-nums">
                          {hour % 2 === 0 ? `${hour}h` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {inspectedAgent.topQueues.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-700">Principais filas</p>
                  <div className="mt-1.5 space-y-1 text-xs text-slate-600 tabular-nums">
                    {inspectedAgent.topQueues.slice(0, 4).map((q) => (
                      <div key={q.name} className="flex items-center justify-between">
                        <span className="truncate">{q.name}</span>
                        <span className="font-mono text-slate-800">{q.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
