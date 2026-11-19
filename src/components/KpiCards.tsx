import React from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Clock,
  Flame,
  Hourglass,
  Minus,
  PhoneCall,
} from 'lucide-react';
import type {
  DashboardSummary,
  PeriodComparison,
  PeriodDelta,
} from '../types/callCenter';
import { formatDateKeyBR, formatDecimalBR } from '../utils/metricsCalculator';

interface KpiCardsProps {
  summary: DashboardSummary;
  comparison: PeriodComparison;
  compareEnabled: boolean;
  onToggleCompare: () => void;
  canQuickCompareHalf: boolean;
  onQuickCompareHalf: () => void;
}

interface DeltaRowProps {
  delta: PeriodDelta | null;
  previousLabel: string;
  invertGoodDirection?: boolean; // true for TMA and Wait (decrease = good)
}

const DeltaRow: React.FC<DeltaRowProps> = ({
  delta,
  previousLabel,
  invertGoodDirection = false,
}) => {
  if (!delta) return null;

  const pct = delta.diffPercent;
  const isZero = pct === null || Math.abs(pct) < 0.05;
  const isIncrease = (pct ?? 0) > 0;
  const isFavorable = invertGoodDirection ? !isIncrease : isIncrease;

  const toneClass = isZero
    ? 'text-slate-500 dark:text-slate-400'
    : isFavorable
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-amber-700 dark:text-amber-400';

  const formattedPct =
    pct === null
      ? '—'
      : `${isIncrease ? '+' : ''}${formatDecimalBR(pct, 1)}%`;

  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800 tabular-nums">
      <span className={`inline-flex items-center gap-1 font-mono font-semibold ${toneClass}`}>
        {isZero ? (
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        ) : isIncrease ? (
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>{formattedPct}</span>
      </span>
      <span className="truncate text-slate-500 dark:text-slate-400">
        {previousLabel}
      </span>
    </div>
  );
};

export const KpiCards: React.FC<KpiCardsProps> = ({
  summary,
  comparison,
  compareEnabled,
  onToggleCompare,
  canQuickCompareHalf,
  onQuickCompareHalf,
}) => {
  const peak = summary.peakAnalysis.peakHour;
  const waitMins = summary.avgWaitSeconds / 60;
  const prevPeak = comparison.previousSummary?.peakAnalysis.peakHour ?? null;

  const showDeltas = compareEnabled && comparison.isComparable;

  return (
    <section aria-label="Indicadores principais" className="space-y-3">
      {/* Period Comparison Context & Control Bar */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          <button
            type="button"
            onClick={onToggleCompare}
            aria-pressed={compareEnabled}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold transition-colors whitespace-nowrap shrink-0 ${
              compareEnabled
                ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Comparar Período Anterior</span>
          </button>

          {compareEnabled && comparison.isComparable && (
            <span className="text-slate-600 dark:text-slate-300 tabular-nums">
              Atual:{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatDateKeyBR(comparison.currentStart)}–{formatDateKeyBR(comparison.currentEnd)}
              </span>{' '}
              <span aria-hidden="true">·</span> Anterior:{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatDateKeyBR(comparison.previousStart)}–{formatDateKeyBR(comparison.previousEnd)}
              </span>{' '}
              <span className="text-slate-400 dark:text-slate-500">
                ({comparison.periodDays} {comparison.periodDays === 1 ? 'dia' : 'dias'})
              </span>
            </span>
          )}

          {compareEnabled && !comparison.isComparable && (
            <span className="text-slate-500 dark:text-slate-400">
              {comparison.reasonIfNotComparable}
            </span>
          )}

          {!compareEnabled && (
            <span className="text-slate-500 dark:text-slate-400">
              Ative para visualizar a variação percentual frente ao período imediatamente anterior
            </span>
          )}
        </div>

        {compareEnabled && !comparison.isComparable && canQuickCompareHalf && (
          <button
            type="button"
            onClick={onQuickCompareHalf}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap shrink-0 sm:self-auto"
          >
            Comparar 2ª metade vs. 1ª metade
          </button>
        )}
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: Total de Chamadas Atendidas */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total de Chamadas Atendidas
            </span>
            <PhoneCall className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
              {summary.totalCalls.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">chamadas</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {summary.validTmaCalls.toLocaleString('pt-BR')} com duração válida ·{' '}
            {summary.operatorMetrics.length} operadores ativos
          </p>
          {showDeltas && (
            <DeltaRow
              delta={comparison.callsDelta}
              previousLabel={`vs. ${(comparison.callsDelta?.previous ?? 0).toLocaleString('pt-BR')} ant.`}
            />
          )}
        </article>

        {/* KPI 2: TMA Médio */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              TMA Médio
            </span>
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
              {formatDecimalBR(summary.avgTmaMinutes)} min
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            Formato legível: <span className="font-mono font-medium">{summary.avgTmaHuman}</span> ·{' '}
            <span className="font-mono text-slate-500 dark:text-slate-400">
              {summary.avgTmaFormatted}
            </span>
          </p>
          {showDeltas && (
            <DeltaRow
              delta={comparison.tmaDelta}
              invertGoodDirection
              previousLabel={`vs. ${formatDecimalBR(comparison.tmaDelta?.previous ?? 0, 2)} min ant.`}
            />
          )}
        </article>

        {/* KPI 3: Horário de Pico Identificado */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Horário de Pico Identificado
            </span>
            <Flame className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl tabular-nums">
              {peak
                ? `${String(peak.hour).padStart(2, '0')}:00 às ${String(peak.hour).padStart(
                    2,
                    '0'
                  )}:59`
                : '—'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            {peak ? (
              <>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {peak.count.toLocaleString('pt-BR')} chamadas
                </span>{' '}
                · {formatDecimalBR(peak.percentage, 1)}% do volume total
              </>
            ) : (
              'Sem dados horários disponíveis'
            )}
          </p>
          {showDeltas && (
            <DeltaRow
              delta={comparison.peakVolumeDelta}
              previousLabel={
                prevPeak
                  ? `pico ant.: ${prevPeak.label} (${prevPeak.count.toLocaleString('pt-BR')})`
                  : 'sem pico anterior'
              }
            />
          )}
        </article>

        {/* KPI 4: Tempo Médio de Espera */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tempo Médio de Espera
            </span>
            <Hourglass className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
              {formatDecimalBR(summary.avgWaitSeconds, 1)} s
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Equivalente a{' '}
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {formatDecimalBR(waitMins, 2)} min
            </span>{' '}
            · <span className="font-mono">{summary.avgWaitFormatted}</span>
          </p>
          {showDeltas && (
            <DeltaRow
              delta={comparison.waitDelta}
              invertGoodDirection
              previousLabel={`vs. ${formatDecimalBR(comparison.waitDelta?.previous ?? 0, 1)} s ant.`}
            />
          )}
        </article>
      </div>
    </section>
  );
};
