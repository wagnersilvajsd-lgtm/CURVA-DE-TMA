import type {
  CallRecord,
  DashboardSummary,
  FilterState,
  HourlyBucket,
  OperatorMetrics,
  PeakAnalysis,
  PeriodComparison,
} from '../types/callCenter';
import { formatMinutesToHuman, formatSecondsToMMSS } from './spreadsheetParser';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatHourRange(hour: number): string {
  const h = pad2(hour);
  return `${h}:00 - ${h}:59`;
}

export function formatDecimalBR(val: number, decimals = 2): string {
  if (!Number.isFinite(val)) return '0,00';
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function getFilterBounds(records: CallRecord[]): {
  operators: string[];
  queues: string[];
  minDate: string;
  maxDate: string;
} {
  const opSet = new Set<string>();
  const queueSet = new Set<string>();
  let minDate = '';
  let maxDate = '';

  for (const r of records) {
    if (r.atendente) opSet.add(r.atendente);
    if (r.fila) queueSet.add(r.fila);
    if (r.entryDateKey) {
      if (!minDate || r.entryDateKey < minDate) minDate = r.entryDateKey;
      if (!maxDate || r.entryDateKey > maxDate) maxDate = r.entryDateKey;
    }
  }

  return {
    operators: Array.from(opSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    queues: Array.from(queueSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    minDate,
    maxDate,
  };
}

export function filterCallRecords(records: CallRecord[], filters: FilterState): CallRecord[] {
  const hasOperatorFilter = filters.selectedOperators.length > 0;
  const opSet = hasOperatorFilter ? new Set(filters.selectedOperators) : null;
  const hasQueueFilter = filters.selectedQueue !== 'ALL';

  return records.filter((r) => {
    if (opSet && !opSet.has(r.atendente)) return false;
    if (hasQueueFilter && r.fila !== filters.selectedQueue) return false;

    if (filters.startDate && r.entryDateKey && r.entryDateKey < filters.startDate) {
      return false;
    }
    if (filters.endDate && r.entryDateKey && r.entryDateKey > filters.endDate) {
      return false;
    }

    return true;
  });
}

export function calculateDashboardSummary(records: CallRecord[]): DashboardSummary {
  const totalCalls = records.length;

  let totalDurationMinutes = 0;
  let validTmaCalls = 0;
  let totalWaitSeconds = 0;
  let validWaitCalls = 0;

  // 24-hour accumulators
  const hourAgg = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
    durationSum: 0,
    durationValidCount: 0,
    waitSum: 0,
    waitValidCount: 0,
  }));

  // Operator accumulators
  const opMap = new Map<
    string,
    {
      callCount: number;
      validDurationCount: number;
      totalMinutes: number;
      waitSum: number;
      waitValidCount: number;
      hourCounts: number[];
    }
  >();

  for (const r of records) {
    if (r.duracaoMinutes !== null && Number.isFinite(r.duracaoMinutes)) {
      totalDurationMinutes += r.duracaoMinutes;
      validTmaCalls++;
    }
    if (r.esperaSeconds !== null && Number.isFinite(r.esperaSeconds)) {
      totalWaitSeconds += r.esperaSeconds;
      validWaitCalls++;
    }

    if (r.entryHour !== null && r.entryHour >= 0 && r.entryHour <= 23) {
      const bucket = hourAgg[r.entryHour];
      bucket.count++;
      if (r.duracaoMinutes !== null && Number.isFinite(r.duracaoMinutes)) {
        bucket.durationSum += r.duracaoMinutes;
        bucket.durationValidCount++;
      }
      if (r.esperaSeconds !== null && Number.isFinite(r.esperaSeconds)) {
        bucket.waitSum += r.esperaSeconds;
        bucket.waitValidCount++;
      }
    }

    let opEntry = opMap.get(r.atendente);
    if (!opEntry) {
      opEntry = {
        callCount: 0,
        validDurationCount: 0,
        totalMinutes: 0,
        waitSum: 0,
        waitValidCount: 0,
        hourCounts: new Array(24).fill(0),
      };
      opMap.set(r.atendente, opEntry);
    }

    opEntry.callCount++;
    if (r.duracaoMinutes !== null && Number.isFinite(r.duracaoMinutes)) {
      opEntry.totalMinutes += r.duracaoMinutes;
      opEntry.validDurationCount++;
    }
    if (r.esperaSeconds !== null && Number.isFinite(r.esperaSeconds)) {
      opEntry.waitSum += r.esperaSeconds;
      opEntry.waitValidCount++;
    }
    if (r.entryHour !== null && r.entryHour >= 0 && r.entryHour <= 23) {
      opEntry.hourCounts[r.entryHour]++;
    }
  }

  const avgTmaMinutes = validTmaCalls > 0 ? totalDurationMinutes / validTmaCalls : 0;
  const avgWaitSeconds = validWaitCalls > 0 ? totalWaitSeconds / validWaitCalls : 0;

  // Build hourly buckets and identify Peak, Top 3, and Valley
  const totalWithHour = hourAgg.reduce((acc, b) => acc + b.count, 0);
  const hourlyBuckets: HourlyBucket[] = hourAgg.map((b) => ({
    hour: b.hour,
    label: `${pad2(b.hour)}h`,
    rangeLabel: formatHourRange(b.hour),
    count: b.count,
    percentage: totalWithHour > 0 ? (b.count / totalWithHour) * 100 : 0,
    avgTmaMinutes: b.durationValidCount > 0 ? b.durationSum / b.durationValidCount : 0,
    avgWaitSeconds: b.waitValidCount > 0 ? b.waitSum / b.waitValidCount : 0,
    isPeak: false,
    isTop3: false,
    isValley: false,
  }));

  let peakHour: HourlyBucket | null = null;
  let top3Critical: HourlyBucket[] = [];
  let valleyHour: HourlyBucket | null = null;
  let valleyAllHours: HourlyBucket | null = null;

  if (totalWithHour > 0) {
    const sortedDesc = [...hourlyBuckets].sort((a, b) => b.count - a.count || a.hour - b.hour);
    peakHour = sortedDesc[0];
    peakHour.isPeak = true;

    top3Critical = sortedDesc.filter((b) => b.count > 0).slice(0, 3);
    const top3Set = new Set(top3Critical.map((b) => b.hour));
    for (const b of hourlyBuckets) {
      if (top3Set.has(b.hour)) b.isTop3 = true;
    }

    // Lowest demand hour among active hours (>0), plus overall lowest across 24h
    const activeAsc = [...hourlyBuckets]
      .filter((b) => b.count > 0)
      .sort((a, b) => a.count - b.count || a.hour - b.hour);
    const allAsc = [...hourlyBuckets].sort((a, b) => a.count - b.count || a.hour - b.hour);

    valleyHour = activeAsc[0] || allAsc[0];
    valleyAllHours = allAsc[0];
    if (valleyHour) valleyHour.isValley = true;
  }

  const peakAnalysis: PeakAnalysis = {
    peakHour,
    top3Critical,
    valleyHour,
    valleyAllHours,
  };

  // Build operator metrics sorted from highest to lowest TMA in minutes
  const operatorMetrics: OperatorMetrics[] = Array.from(opMap.entries())
    .map(([operator, data]) => {
      const tmaMinutes =
        data.validDurationCount > 0 ? data.totalMinutes / data.validDurationCount : 0;
      const opAvgWait = data.waitValidCount > 0 ? data.waitSum / data.waitValidCount : 0;

      // Find individual peak hour
      let bestHour: number | null = null;
      let bestCount = 0;
      data.hourCounts.forEach((cnt, h) => {
        if (cnt > bestCount) {
          bestCount = cnt;
          bestHour = h;
        }
      });

      return {
        operator,
        callCount: data.callCount,
        validDurationCount: data.validDurationCount,
        totalMinutes: data.totalMinutes,
        tmaMinutes,
        tmaFormatted: formatSecondsToMMSS(tmaMinutes * 60),
        tmaHuman: formatMinutesToHuman(tmaMinutes),
        peakHour: bestHour,
        peakHourLabel: bestHour !== null ? formatHourRange(bestHour) : '—',
        peakHourCalls: bestCount,
        avgWaitSeconds: opAvgWait,
        avgWaitFormatted: formatSecondsToMMSS(opAvgWait),
        sharePercent: totalCalls > 0 ? (data.callCount / totalCalls) * 100 : 0,
      };
    })
    .sort((a, b) => b.tmaMinutes - a.tmaMinutes || b.callCount - a.callCount);

  return {
    totalCalls,
    validTmaCalls,
    avgTmaMinutes,
    avgTmaFormatted: formatSecondsToMMSS(avgTmaMinutes * 60),
    avgTmaHuman: formatMinutesToHuman(avgTmaMinutes),
    avgWaitSeconds,
    avgWaitFormatted: formatSecondsToMMSS(avgWaitSeconds),
    hourlyBuckets,
    peakAnalysis,
    operatorMetrics,
  };
}

function parseDateKeyUTC(dateKey: string): number | null {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

function formatUTCDateKey(utcMs: number): string {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

export function formatDateKeyBR(dateKey: string): string {
  if (!dateKey) return '—';
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function computePreviousDateRange(
  startDate: string,
  endDate: string
): { previousStart: string; previousEnd: string; periodDays: number } | null {
  const startMs = parseDateKeyUTC(startDate);
  const endMs = parseDateKeyUTC(endDate);
  if (startMs === null || endMs === null || endMs < startMs) return null;

  const DAY_MS = 86_400_000;
  const periodDays = Math.round((endMs - startMs) / DAY_MS) + 1;
  const prevEndMs = startMs - DAY_MS;
  const prevStartMs = prevEndMs - (periodDays - 1) * DAY_MS;

  return {
    previousStart: formatUTCDateKey(prevStartMs),
    previousEnd: formatUTCDateKey(prevEndMs),
    periodDays,
  };
}

function buildDelta(current: number, previous: number): {
  current: number;
  previous: number;
  diffAbsolute: number;
  diffPercent: number | null;
} {
  const diffAbsolute = current - previous;
  const diffPercent = previous > 0 ? (diffAbsolute / previous) * 100 : null;
  return { current, previous, diffAbsolute, diffPercent };
}

export function calculatePeriodComparison(
  allRecords: CallRecord[],
  filters: FilterState,
  currentSummary: DashboardSummary,
  minAvailableDate: string
): PeriodComparison {
  const range = computePreviousDateRange(filters.startDate, filters.endDate);

  if (!range) {
    return {
      isComparable: false,
      reasonIfNotComparable: 'Defina uma data inicial e final válida para comparar períodos.',
      currentStart: filters.startDate,
      currentEnd: filters.endDate,
      previousStart: '',
      previousEnd: '',
      periodDays: 0,
      previousSummary: null,
      callsDelta: null,
      tmaDelta: null,
      waitDelta: null,
      peakVolumeDelta: null,
    };
  }

  const prevFilters: FilterState = {
    selectedOperators: filters.selectedOperators,
    selectedQueue: filters.selectedQueue,
    startDate: range.previousStart,
    endDate: range.previousEnd,
  };

  const prevRecords = filterCallRecords(allRecords, prevFilters);

  if (prevRecords.length === 0) {
    const isAtDatasetStart = Boolean(minAvailableDate && filters.startDate <= minAvailableDate);
    return {
      isComparable: false,
      reasonIfNotComparable: isAtDatasetStart
        ? 'O período selecionado inicia no primeiro dia da planilha; avance a data inicial para comparar com dias anteriores.'
        : `Sem registros no período anterior (${formatDateKeyBR(range.previousStart)} a ${formatDateKeyBR(range.previousEnd)}).`,
      currentStart: filters.startDate,
      currentEnd: filters.endDate,
      previousStart: range.previousStart,
      previousEnd: range.previousEnd,
      periodDays: range.periodDays,
      previousSummary: null,
      callsDelta: null,
      tmaDelta: null,
      waitDelta: null,
      peakVolumeDelta: null,
    };
  }

  const previousSummary = calculateDashboardSummary(prevRecords);

  const currentPeakCount = currentSummary.peakAnalysis.peakHour?.count ?? 0;
  const previousPeakCount = previousSummary.peakAnalysis.peakHour?.count ?? 0;

  return {
    isComparable: true,
    currentStart: filters.startDate,
    currentEnd: filters.endDate,
    previousStart: range.previousStart,
    previousEnd: range.previousEnd,
    periodDays: range.periodDays,
    previousSummary,
    callsDelta: buildDelta(currentSummary.totalCalls, previousSummary.totalCalls),
    tmaDelta:
      currentSummary.validTmaCalls > 0 && previousSummary.validTmaCalls > 0
        ? buildDelta(currentSummary.avgTmaMinutes, previousSummary.avgTmaMinutes)
        : null,
    waitDelta: buildDelta(currentSummary.avgWaitSeconds, previousSummary.avgWaitSeconds),
    peakVolumeDelta:
      currentPeakCount > 0 && previousPeakCount > 0
        ? buildDelta(currentPeakCount, previousPeakCount)
        : null,
  };
}
