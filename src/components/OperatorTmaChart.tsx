import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OperatorMetrics } from '../types/callCenter';
import { formatDecimalBR } from '../utils/metricsCalculator';

interface OperatorTmaChartProps {
  operators: OperatorMetrics[];
  teamAvgTmaMinutes: number;
  isDark: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: OperatorMetrics }>;
  teamAvg: number;
}

const OperatorTooltip: React.FC<CustomTooltipProps> = ({ active, payload, teamAvg }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const diff = item.tmaMinutes - teamAvg;
  const isAbove = diff > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 pb-1.5 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
        {item.operator}
      </div>
      <div className="mt-2 space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">TMA (Minutos):</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {formatDecimalBR(item.tmaMinutes, 2)} min ({item.tmaFormatted})
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">Vs. Média da Equipe:</span>
          <span
            className={`font-mono font-medium ${
              isAbove
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {isAbove ? '+' : ''}
            {formatDecimalBR(diff, 2)} min ({isAbove ? 'Acima da média' : 'Dentro/abaixo da média'})
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">Chamadas atendidas:</span>
          <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
            {item.callCount.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>
    </div>
  );
};

export const OperatorTmaChart: React.FC<OperatorTmaChartProps> = ({
  operators,
  teamAvgTmaMinutes,
  isDark,
}) => {
  // Already sorted descending by TMA in metricsCalculator, keep deterministic order
  const chartData = [...operators].sort((a, b) => b.tmaMinutes - a.tmaMinutes);

  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const aboveAvgColor = isDark ? '#3B82F6' : '#1E3A8A';
  const belowAvgColor = isDark ? '#10B981' : '#059669';
  const refLineColor = isDark ? '#F59E0B' : '#D97706';

  const chartHeight = Math.max(300, chartData.length * 36 + 44);

  return (
    <section
      aria-label="TMA em minutos por operador"
      className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            TMA (em Minutos) por Operador
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Ordenado do maior para o menor TMA · Linha tracejada indica a média geral da equipe (
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {formatDecimalBR(teamAvgTmaMinutes, 2)} min
            </span>
            )
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-xs"
              style={{ backgroundColor: aboveAvgColor }}
            />
            <span>Acima da média</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-xs"
              style={{ backgroundColor: belowAvgColor }}
            />
            <span>Abaixo ou igual à média</span>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          Nenhum operador encontrado para os filtros aplicados.
        </div>
      ) : (
        <div className="mt-4 max-h-[460px] overflow-y-auto pr-1">
          <div style={{ height: `${chartHeight}px`, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 14, right: 28, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis
                  type="number"
                  tick={{ fill: axisColor, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v.toFixed(1)}m`}
                />
                <YAxis
                  type="category"
                  dataKey="operator"
                  width={150}
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(name: string) =>
                    name.length > 20 ? `${name.slice(0, 19)}…` : name
                  }
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }}
                  content={<OperatorTooltip teamAvg={teamAvgTmaMinutes} />}
                />
                <ReferenceLine
                  x={teamAvgTmaMinutes}
                  stroke={refLineColor}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: `Média: ${formatDecimalBR(teamAvgTmaMinutes, 2)} min`,
                    position: 'top',
                    fill: refLineColor,
                    fontSize: 11,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                />
                <Bar dataKey="tmaMinutes" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.operator}
                      fill={entry.tmaMinutes > teamAvgTmaMinutes ? aboveAvgColor : belowAvgColor}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
};
