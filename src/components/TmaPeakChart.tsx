import React, {useMemo, useState} from 'react';
import type {DailyBucket, HourlyBucket, SegmentFilter} from '../types/operations';
import {formatTma} from '../utils/analytics';

interface TmaPeakChartProps {
  hourlyBuckets: HourlyBucket[];
  dailyBuckets: DailyBucket[];
  segmentFilter: SegmentFilter;
  overallTmaSeconds: number;
  selectedHour: number | null;
  onSelectHour: (hour: number | null) => void;
}

type ChartMode = 'hourly' | 'daily';

function buildSmoothPath(points: {x: number; y: number}[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const tension = 0.28;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

export const TmaPeakChart: React.FC<TmaPeakChartProps> = ({
  hourlyBuckets,
  dailyBuckets,
  segmentFilter,
  overallTmaSeconds,
  selectedHour,
  onSelectHour,
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('hourly');
  const [splitChannels, setSplitChannels] = useState<boolean>(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const items = useMemo(() => {
    if (chartMode === 'hourly') {
      // Determine active span or show 06h-22h if 00h-05h are empty, otherwise full 00h-23h
      const firstActive = hourlyBuckets.findIndex((b) => b.totalCount > 0);
      const lastActive = [...hourlyBuckets].reverse().findIndex((b) => b.totalCount > 0);
      const startHour = firstActive === -1 ? 7 : Math.max(0, Math.min(firstActive, 7));
      const endHour = lastActive === -1 ? 21 : Math.min(23, Math.max(23 - lastActive, 20));
      return hourlyBuckets.slice(startHour, endHour + 1).map((b) => ({
        key: String(b.hour),
        hour: b.hour,
        label: b.label,
        title: b.rangeLabel,
        totalCount: b.totalCount,
        voiceCount: b.voiceCount,
        chatCount: b.chatCount,
        tmaSeconds: b.tmaSeconds,
        voiceTmaSeconds: b.voiceTmaSeconds,
        chatTmaSeconds: b.chatTmaSeconds,
        sharePercent: b.sharePercent,
        isPeak: b.isPeak,
        isTmaSpike: b.isTmaSpike,
      }));
    }

    const totalAll = dailyBuckets.reduce((s, d) => s + d.totalCount, 0);
    const maxDayVol = Math.max(1, ...dailyBuckets.map((d) => d.totalCount));
    return dailyBuckets.map((d) => ({
      key: d.date,
      hour: null as number | null,
      label: d.dateDisplay.slice(0, 5),
      title: d.dateDisplay,
      totalCount: d.totalCount,
      voiceCount: d.voiceCount,
      chatCount: d.chatCount,
      tmaSeconds: d.tmaSeconds,
      voiceTmaSeconds: d.voiceTmaSeconds,
      chatTmaSeconds: d.chatTmaSeconds,
      sharePercent: totalAll > 0 ? (d.totalCount / totalAll) * 100 : 0,
      isPeak: d.totalCount >= maxDayVol * 0.85,
      isTmaSpike: overallTmaSeconds > 0 && d.tmaSeconds >= overallTmaSeconds * 1.15,
    }));
  }, [chartMode, hourlyBuckets, dailyBuckets, overallTmaSeconds]);

  const isDaily = chartMode === 'daily';
  const width = 960;
  const height = isDaily ? 378 : 350;
  const pad = {top: 38, right: 64, bottom: isDaily ? 70 : 42, left: 52};
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxVol = Math.max(4, ...items.map((d) => d.totalCount));
  const volCeiling = Math.ceil(maxVol * 1.24);

  const activeTmas = items.filter((d) => d.totalCount > 0).map((d) => d.tmaSeconds);
  const maxTma = Math.max(60, overallTmaSeconds * 1.35, ...activeTmas.map((v) => v * 1.15));
  const tmaCeiling = Math.ceil(maxTma / 60) * 60;

  const slotW = items.length > 0 ? plotW / items.length : plotW;
  const barW = Math.min(34, Math.max(10, slotW * 0.56));

  const yVol = (v: number) => pad.top + plotH - (v / volCeiling) * plotH;
  const yTma = (s: number) => pad.top + plotH - (s / tmaCeiling) * plotH;

  // Build curve points for hours/days that have > 0 records
  const tmaPoints = items
    .map((item, idx) => ({
      idx,
      x: pad.left + idx * slotW + slotW / 2,
      y: yTma(item.tmaSeconds),
      tma: item.tmaSeconds,
      hasData: item.totalCount > 0,
    }))
    .filter((p) => p.hasData);

  const tmaPath = buildSmoothPath(tmaPoints);
  const avgTmaY = yTma(overallTmaSeconds);

  const volTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(volCeiling * r));
  const tmaTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(tmaCeiling * r));

  const activeHover = hoveredIndex !== null ? items[hoveredIndex] : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Curva de TMA e Picos de Fluxo
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Volume de atendimentos (barras) cruzado com a curva de TMA em mm:ss (linha âmbar)
            {selectedHour !== null && chartMode === 'hourly' && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => onSelectHour(null)}
                  className="font-medium text-blue-700 hover:underline cursor-pointer"
                >
                  Limpar filtro de hora ({String(selectedHour).padStart(2, '0')}h)
                </button>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {segmentFilter === 'all' && (
            <button
              type="button"
              onClick={() => setSplitChannels((s) => !s)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                splitChannels
                  ? 'border-slate-300 bg-slate-100 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {splitChannels ? 'Empilhar Voice + Chat' : 'Volume Consolidado'}
            </button>
          )}

          <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setChartMode('hourly')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'hourly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Horário (Pico)
            </button>
            <button
              type="button"
              onClick={() => {
                setChartMode('daily');
                onSelectHour(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'daily'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Data
            </button>
          </div>
        </div>
      </div>

      {/* Legend Bar (Clean inline typographic markers) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-5">
          {segmentFilter === 'all' && splitChannels ? (
            <>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-xs bg-blue-400" aria-hidden="true" />
                <span>Volume Voice</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-xs bg-teal-400" aria-hidden="true" />
                <span>Volume Chat</span>
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-xs ${
                  segmentFilter === 'chat' ? 'bg-teal-400' : 'bg-blue-400'
                }`}
                aria-hidden="true"
              />
              <span>Volume de Atendimentos</span>
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-amber-600" aria-hidden="true" />
            <span>Curva de TMA</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 border-t border-dashed border-slate-500" aria-hidden="true" />
            <span className="tabular-nums">TMA Médio ({formatTma(overallTmaSeconds)})</span>
          </span>
        </div>
        {chartMode === 'hourly' && (
          <span className="text-[11px] text-slate-500">
            Clique em uma faixa horária para filtrar os dados abaixo
          </span>
        )}
      </div>

      {/* SVG Responsive Chart */}
      <div className="relative mt-3 w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full select-none overflow-visible"
          role="img"
          aria-label="Gráfico combinado de volume de atendimentos e curva de TMA"
        >
          {/* Horizontal grid lines */}
          {volTicks.map((tick, idx) => {
            const y = yVol(tick);
            const tmaTick = tmaTicks[idx] ?? 0;
            return (
              <g key={tick + '-' + idx}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[11px] tabular-nums"
                >
                  {tick}
                </text>
                <text
                  x={width - pad.right + 10}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-amber-700 font-mono text-[11px] tabular-nums"
                >
                  {formatTma(tmaTick)}
                </text>
              </g>
            );
          })}

          {/* Axis Units */}
          <text
            x={pad.left}
            y={14}
            textAnchor="start"
            className="fill-slate-500 text-[10px] font-medium"
          >
            Qtd. Atendimentos
          </text>
          <text
            x={width - pad.right}
            y={14}
            textAnchor="end"
            className="fill-amber-700 text-[10px] font-medium"
          >
            TMA (mm:ss)
          </text>

          {/* Average TMA Dashed Line */}
          {overallTmaSeconds > 0 && (
            <line
              x1={pad.left}
              y1={avgTmaY}
              x2={width - pad.right}
              y2={avgTmaY}
              stroke="#64748B"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}

          {/* Bars + Interactive Column Hitboxes */}
          {items.map((item, idx) => {
            const centerX = pad.left + idx * slotW + slotW / 2;
            const barX = centerX - barW / 2;
            const isHovered = hoveredIndex === idx;
            const isSelected = chartMode === 'hourly' && selectedHour !== null && selectedHour === item.hour;
            const totalH = plotH - (yVol(item.totalCount) - pad.top);
            const barY = yVol(item.totalCount);

            const showSplit = segmentFilter === 'all' && splitChannels;
            const voiceH = item.totalCount > 0 ? (item.voiceCount / item.totalCount) * totalH : 0;
            const chatH = totalH - voiceH;

            return (
              <g
                key={item.key}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => {
                  if (chartMode === 'hourly' && item.hour !== null && item.totalCount > 0) {
                    onSelectHour(selectedHour === item.hour ? null : item.hour);
                  }
                }}
                className={chartMode === 'hourly' && item.totalCount > 0 ? 'cursor-pointer' : ''}
              >
                {/* Subtle Hover / Selected Column Band only */}
                {(isHovered || isSelected) && (
                  <rect
                    x={pad.left + idx * slotW + 1}
                    y={pad.top}
                    width={Math.max(4, slotW - 2)}
                    height={plotH}
                    rx={4}
                    fill={isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(15, 23, 42, 0.035)'}
                  />
                )}

                {/* Volume Bar (soft uniform palette without harsh highlight contrast) */}
                {item.totalCount > 0 && !showSplit && (
                  <rect
                    x={barX}
                    y={barY}
                    width={barW}
                    height={Math.max(2, totalH)}
                    rx={3}
                    fill={
                      isSelected
                        ? segmentFilter === 'chat'
                          ? '#14B8A6'
                          : '#3B82F6'
                        : segmentFilter === 'chat'
                          ? '#5EEAD4'
                          : '#93C5FD'
                    }
                    opacity={isHovered ? 0.85 : 1}
                  />
                )}

                {item.totalCount > 0 && showSplit && (
                  <>
                    {/* Voice bottom segment */}
                    {item.voiceCount > 0 && (
                      <rect
                        x={barX}
                        y={pad.top + plotH - voiceH}
                        width={barW}
                        height={Math.max(1, voiceH)}
                        rx={item.chatCount === 0 ? 3 : 0}
                        fill={isSelected ? '#3B82F6' : '#60A5FA'}
                        opacity={isHovered ? 0.88 : 0.95}
                      />
                    )}
                    {/* Chat top segment */}
                    {item.chatCount > 0 && (
                      <rect
                        x={barX}
                        y={barY}
                        width={barW}
                        height={Math.max(1, chatH)}
                        rx={2}
                        fill={isSelected ? '#14B8A6' : '#5EEAD4'}
                        opacity={isHovered ? 0.88 : 0.95}
                      />
                    )}
                  </>
                )}

                {/* X-Axis Label */}
                {isDaily ? (
                  <text
                    x={centerX + 3}
                    y={pad.top + plotH + 14}
                    textAnchor="end"
                    transform={`rotate(-45 ${centerX + 3} ${pad.top + plotH + 14})`}
                    className={`font-mono ${items.length > 24 ? 'text-[10px]' : 'text-[11px]'} tabular-nums ${
                      isHovered ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                    }`}
                  >
                    {item.label}
                  </text>
                ) : (
                  <text
                    x={centerX}
                    y={height - 16}
                    textAnchor="middle"
                    className={`font-mono text-[11px] tabular-nums ${
                      isSelected || isHovered ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                    }`}
                  >
                    {item.label}
                  </text>
                )}

                {/* Invisible full-column hit target */}
                <rect
                  x={pad.left + idx * slotW}
                  y={pad.top}
                  width={slotW}
                  height={plotH + pad.bottom - 4}
                  fill="transparent"
                />
              </g>
            );
          })}

          {/* TMA Smooth Curve */}
          {tmaPath && (
            <path
              d={tmaPath}
              fill="none"
              stroke="#D97706"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
          )}

          {/* TMA Curve Nodes */}
          {tmaPoints.map((pt) => {
            const isHovered = hoveredIndex === pt.idx;
            return (
              <circle
                key={`dot-${pt.idx}`}
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5.5 : 3.4}
                fill="#FFFFFF"
                stroke="#D97706"
                strokeWidth={2}
                className="pointer-events-none"
              />
            );
          })}

          {/* Volume Values at the Top of Each Column */}
          {items.map((item, idx) => {
            if (item.totalCount <= 0) return null;
            const centerX = pad.left + idx * slotW + slotW / 2;
            const barY = yVol(item.totalCount);
            const tmaY = yTma(item.tmaSeconds);
            const dotNearBarTop = tmaY <= barY + 6 && tmaY >= barY - 26;
            const labelY = Math.max(pad.top + 22, dotNearBarTop ? tmaY - 8 : barY - 6);
            const isHovered = hoveredIndex === idx;
            const isSelected = chartMode === 'hourly' && selectedHour !== null && selectedHour === item.hour;

            return (
              <text
                key={`vol-label-${item.key}`}
                x={centerX}
                y={labelY}
                textAnchor="start"
                dominantBaseline="central"
                transform={`rotate(-90 ${centerX} ${labelY})`}
                stroke="#FFFFFF"
                strokeWidth={3.5}
                strokeLinejoin="round"
                style={{paintOrder: 'stroke'}}
                className={`pointer-events-none font-mono ${
                  items.length > 28 ? 'text-[9px]' : 'text-[10px]'
                } tabular-nums ${
                  isHovered || isSelected ? 'fill-slate-900 font-semibold' : 'fill-slate-700 font-medium'
                }`}
              >
                {item.totalCount}
              </text>
            );
          })}
        </svg>

        {/* Interactive Tooltip */}
        {activeHover && hoveredIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 z-20 w-60 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-md"
            style={{
              left:
                hoveredIndex > items.length * 0.65
                  ? undefined
                  : `${Math.min(72, Math.max(4, ((hoveredIndex + 0.5) / items.length) * 100))}%`,
              right:
                hoveredIndex > items.length * 0.65
                  ? `${Math.min(72, Math.max(4, ((items.length - hoveredIndex) / items.length) * 100))}%`
                  : undefined,
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-display font-semibold text-slate-900">{activeHover.title}</span>
              <span
                className={`font-medium ${
                  activeHover.isPeak
                    ? 'text-blue-700'
                    : activeHover.isTmaSpike
                      ? 'text-red-700'
                      : 'text-slate-500'
                }`}
              >
                {activeHover.isPeak ? 'Pico de Fluxo' : activeHover.isTmaSpike ? 'TMA Elevado' : 'Regular'}
              </span>
            </div>

            <div className="mt-2 space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500">Volume total</span>
                <span className="font-mono font-semibold text-slate-900">
                  {activeHover.totalCount} ({activeHover.sharePercent.toFixed(1)}%)
                </span>
              </div>
              {segmentFilter === 'all' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Voice / Chat</span>
                    <span className="font-mono text-slate-700">
                      {activeHover.voiceCount} / {activeHover.chatCount}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-1">
                <span className="text-slate-500">TMA do período</span>
                <span className="font-mono font-semibold text-amber-700">
                  {formatTma(activeHover.tmaSeconds)}
                </span>
              </div>
              {segmentFilter === 'all' && activeHover.voiceCount > 0 && activeHover.chatCount > 0 && (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>TMA Voice / Chat</span>
                  <span className="font-mono">
                    {formatTma(activeHover.voiceTmaSeconds)} / {formatTma(activeHover.chatTmaSeconds)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
