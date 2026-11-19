import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, BarChart3, Flame, TrendingUp } from 'lucide-react';
import type { HourlyBucket, PeakAnalysis } from '../types/callCenter';
import { formatDecimalBR } from '../utils/metricsCalculator';

interface HourlyPeakChartProps {
  buckets: HourlyBucket[];
  peakAnalysis: PeakAnalysis;
  isDark: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HourlyBucket }>;
}

const HourlyTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-1.5 dark:border-slate-800">
        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
          {item.rangeLabel}
        </span>
        {item.isPeak && (
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            Horário de Pico
          </span>
        )}
        {!item.isPeak && item.isTop3 && (
          <span className="font-semibold text-blue-700 dark:text-blue-400">
            Top 3 Crítico
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">Volume:</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {item.count.toLocaleString('pt-BR')} chamadas ({formatDecimalBR(item.percentage, 1)}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">TMA na faixa:</span>
          <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
            {formatDecimalBR(item.avgTmaMinutes, 2)} min
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">Espera média:</span>
          <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
            {formatDecimalBR(item.avgWaitSeconds, 1)} s
          </span>
        </div>
      </div>
    </div>
  );
};

export const HourlyPeakChart: React.FC<HourlyPeakChartProps> = ({
  buckets,
  peakAnalysis,
  isDark,
}) => {
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');

  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const peakColor = isDark ? '#10B981' : '#059669';
  const top3Color = isDark ? '#3B82F6' : '#1E40AF';
  const normalColor = isDark ? '#334155' : '#94A3B8';

  const { peakHour, top3Critical, valleyHour, valleyAllHours } = peakAnalysis;

  return (
    <section
      aria-label="Curva de atendimento por hora"
      className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header & Chart Type Switch */}
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Curva de Atendimento por Hora (00h às 23h)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Distribuição horária pela Data da Entrada · Pico destacado em verde-esmeralda
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:self-auto">
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              chartType === 'bar'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Barras
          </button>
          <button
            type="button"
            onClick={() => setChartType('area')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              chartType === 'area'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Área
          </button>
        </div>
      </div>

      {/* Peak / Top 3 / Valley Summary Strip */}
      <div className="mt-4 grid grid-cols-1 gap-4 border-b border-slate-100 pb-4 dark:border-slate-800 lg:grid-cols-3">
        {/* Peak */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Flame className="h-3.5 w-3.5" />
            <span>Horário de Pico (Maior Volume)</span>
          </div>
          {peakHour ? (
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {peakHour.rangeLabel}
              </span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                {peakHour.count.toLocaleString('pt-BR')} chamadas ({formatDecimalBR(peakHour.percentage, 1)}%)
              </span>
            </div>
          ) : (
            <span className="mt-1.5 text-xs text-slate-400">Sem dados</span>
          )}
        </div>

        {/* Top 3 Critical */}
        <div className="border-t border-slate-100 pt-3 dark:border-slate-800 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <div className="text-xs font-semibold text-blue-800 dark:text-blue-400">
            Top 3 Horários Críticos
          </div>
          {top3Critical.length > 0 ? (
            <div className="mt-1.5 space-y-1">
              {top3Critical.map((item, idx) => (
                <div
                  key={item.hour}
                  className="flex items-center justify-between text-xs tabular-nums"
                >
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {idx + 1}º · {item.rangeLabel}
                  </span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {item.count.toLocaleString('pt-BR')} ({formatDecimalBR(item.percentage, 1)}%)
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="mt-1.5 text-xs text-slate-400">Sem dados</span>
          )}
        </div>

        {/* Valley */}
        <div className="border-t border-slate-100 pt-3 dark:border-slate-800 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <ArrowDownRight className="h-3.5 w-3.5" />
            <span>Horário de Vale (Menor Demanda)</span>
          </div>
          {valleyHour ? (
            <div className="mt-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {valleyHour.rangeLabel}
                </span>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  {valleyHour.count.toLocaleString('pt-BR')} chamadas ({formatDecimalBR(valleyHour.percentage, 1)}%)
                </span>
              </div>
              {valleyAllHours && valleyAllHours.count === 0 && valleyHour.count > 0 && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Menor faixa ativa · Existem faixas com 0 chamadas (ex: {valleyAllHours.rangeLabel})
                </p>
              )}
            </div>
          ) : (
            <span className="mt-1.5 text-xs text-slate-400">Sem dados</span>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="mt-4 h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={buckets} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                tick={{ fill: axisColor, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: axisColor, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }}
                content={<HourlyTooltip />}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {buckets.map((entry) => (
                  <Cell
                    key={`cell-${entry.hour}`}
                    fill={
                      entry.isPeak
                        ? peakColor
                        : entry.isTop3
                        ? top3Color
                        : normalColor
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={buckets} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
              <defs>
                <linearGradient id="hourlyEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={peakColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={peakColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                tick={{ fill: axisColor, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: axisColor, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<HourlyTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={peakColor}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#hourlyEmeraldGrad)"
                activeDot={{ r: 5, fill: peakColor, strokeWidth: 0 }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-5 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-xs"
            style={{ backgroundColor: peakColor }}
          />
          <span>Horário de Pico</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-xs"
            style={{ backgroundColor: top3Color }}
          />
          <span>Top 3 Horários Críticos</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-xs"
            style={{ backgroundColor: normalColor }}
          />
          <span>Demais Faixas Horárias</span>
        </div>
      </div>
    </section>
  );
};
