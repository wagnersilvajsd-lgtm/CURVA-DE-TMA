import type {
  AgentMetric,
  AttendanceRecord,
  CategoryMetric,
  DailyBucket,
  HourlyBucket,
  OperationalSummary,
} from '../types/operations';
import {formatSecondsToClock} from './spreadsheet';

export function formatTma(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  return formatSecondsToClock(Math.round(seconds));
}

function avgDuration(records: AttendanceRecord[]): number {
  if (records.length === 0) return 0;
  const total = records.reduce((acc, r) => acc + r.durationSeconds, 0);
  return Math.round(total / records.length);
}

export function computeHourlyCurve(records: AttendanceRecord[]): HourlyBucket[] {
  const totalRecords = records.length;
  const buckets: HourlyBucket[] = Array.from({length: 24}, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}h`,
    rangeLabel: `${String(hour).padStart(2, '0')}:00 – ${String(hour).padStart(2, '0')}:59`,
    totalCount: 0,
    voiceCount: 0,
    chatCount: 0,
    tmaSeconds: 0,
    voiceTmaSeconds: 0,
    chatTmaSeconds: 0,
    sharePercent: 0,
    isPeak: false,
    isTmaSpike: false,
  }));

  const grouped: AttendanceRecord[][] = Array.from({length: 24}, () => []);
  for (const rec of records) {
    const h = Math.min(23, Math.max(0, rec.entryHour));
    grouped[h].push(rec);
  }

  for (let h = 0; h < 24; h++) {
    const list = grouped[h];
    const voice = list.filter((r) => r.segment === 'voice');
    const chat = list.filter((r) => r.segment === 'chat');
    buckets[h].totalCount = list.length;
    buckets[h].voiceCount = voice.length;
    buckets[h].chatCount = chat.length;
    buckets[h].tmaSeconds = avgDuration(list);
    buckets[h].voiceTmaSeconds = avgDuration(voice);
    buckets[h].chatTmaSeconds = avgDuration(chat);
    buckets[h].sharePercent = totalRecords > 0 ? (list.length / totalRecords) * 100 : 0;
  }

  const activeBuckets = buckets.filter((b) => b.totalCount > 0);
  if (activeBuckets.length > 0) {
    const meanVol = activeBuckets.reduce((s, b) => s + b.totalCount, 0) / activeBuckets.length;
    const variance =
      activeBuckets.reduce((s, b) => s + Math.pow(b.totalCount - meanVol, 2), 0) / activeBuckets.length;
    const stdDev = Math.sqrt(variance);
    const peakThreshold = meanVol + Math.max(1, stdDev * 0.65);

    const sortedByVol = [...activeBuckets].sort((a, b) => b.totalCount - a.totalCount);
    const topHourSet = new Set(sortedByVol.slice(0, Math.min(3, sortedByVol.length)).map((b) => b.hour));

    const overallTma = avgDuration(records);

    for (const b of buckets) {
      b.isPeak = b.totalCount > 0 && (b.totalCount >= peakThreshold || topHourSet.has(b.hour));
      b.isTmaSpike = overallTma > 0 && b.totalCount >= 2 && b.tmaSeconds >= overallTma * 1.15;
    }
  }

  return buckets;
}

export function computeDailyCurve(records: AttendanceRecord[]): DailyBucket[] {
  const byDate = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const key = r.attendanceDate || 'Sem data';
    const arr = byDate.get(key) ?? [];
    arr.push(r);
    byDate.set(key, arr);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const voice = list.filter((r) => r.segment === 'voice');
      const chat = list.filter((r) => r.segment === 'chat');
      return {
        date,
        dateDisplay: list[0]?.attendanceDateDisplay ?? date,
        totalCount: list.length,
        voiceCount: voice.length,
        chatCount: chat.length,
        tmaSeconds: avgDuration(list),
        voiceTmaSeconds: avgDuration(voice),
        chatTmaSeconds: avgDuration(chat),
      };
    });
}

function isPositiveSurvey(val: string | undefined): boolean | null {
  if (!val) return null;
  const norm = val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!norm || norm === 'nao informado' || norm === '-') return null;
  if (norm === 'sim' || norm === 's' || norm === 'yes' || norm === '1' || norm.includes('transferid')) {
    return true;
  }
  if (norm === 'nao' || norm === 'n' || norm === 'no' || norm === '0') {
    return false;
  }
  return null;
}

export function computeAgentMetrics(records: AttendanceRecord[]): AgentMetric[] {
  const byAgent = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const arr = byAgent.get(r.agent) ?? [];
    arr.push(r);
    byAgent.set(r.agent, arr);
  }

  const teamTma = avgDuration(records);

  const rawList: Omit<AgentMetric, 'deltaFromTeamTmaSeconds' | 'deltaFromTeamAvgCalls'>[] = [];

  for (const [agent, list] of byAgent.entries()) {
    const voice = list.filter((r) => r.segment === 'voice');
    const chat = list.filter((r) => r.segment === 'chat');

    const distinctDays = new Set(list.map((r) => r.attendanceDate).filter((d) => d && d !== 'Sem data'));
    const activeDays = Math.max(1, distinctDays.size);

    const distinctHours = new Set(list.map((r) => `${r.attendanceDate}-${r.entryHour}`));
    const activeHours = Math.max(1, distinctHours.size);

    let surveyYesCount = 0;
    let surveyEligibleCount = 0;
    for (const v of voice) {
      const res = isPositiveSurvey(v.surveyTransfer);
      if (res !== null) {
        surveyEligibleCount++;
        if (res) surveyYesCount++;
      }
    }

    const queueMap = new Map<string, number>();
    const hourlyVolume = Array.from({length: 24}, () => 0);
    for (const r of list) {
      queueMap.set(r.queue, (queueMap.get(r.queue) ?? 0) + 1);
      hourlyVolume[Math.min(23, Math.max(0, r.entryHour))]++;
    }

    const topQueues = Array.from(queueMap.entries())
      .map(([name, count]) => ({name, count}))
      .sort((a, b) => b.count - a.count);

    rawList.push({
      agent,
      totalCalls: list.length,
      voiceCalls: voice.length,
      chatCalls: chat.length,
      activeDays,
      activeHours,
      avgCallsPerDay: list.length / activeDays,
      avgCallsPerActiveHour: list.length / activeHours,
      tmaSeconds: avgDuration(list),
      voiceTmaSeconds: avgDuration(voice),
      chatTmaSeconds: avgDuration(chat),
      surveyYesCount,
      surveyEligibleCount,
      surveyRatePercent: surveyEligibleCount > 0 ? (surveyYesCount / surveyEligibleCount) * 100 : null,
      topQueues,
      hourlyVolume,
    });
  }

  const teamAvgCallsPerDay =
    rawList.length > 0 ? rawList.reduce((sum, a) => sum + a.avgCallsPerDay, 0) / rawList.length : 0;

  return rawList
    .map((a) => ({
      ...a,
      deltaFromTeamTmaSeconds: a.tmaSeconds - teamTma,
      deltaFromTeamAvgCalls: a.avgCallsPerDay - teamAvgCallsPerDay,
    }))
    .sort((a, b) => b.avgCallsPerDay - a.avgCallsPerDay);
}

export function computeCategoryBreakdown(
  records: AttendanceRecord[],
  extractor: (r: AttendanceRecord) => string,
): CategoryMetric[] {
  const total = records.length;
  const map = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const key = extractor(r) || 'Não informado';
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }

  return Array.from(map.entries())
    .map(([name, list]) => ({
      name,
      count: list.length,
      voiceCount: list.filter((r) => r.segment === 'voice').length,
      chatCount: list.filter((r) => r.segment === 'chat').length,
      tmaSeconds: avgDuration(list),
      sharePercent: total > 0 ? (list.length / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeOperationalSummary(
  records: AttendanceRecord[],
  hourlyBuckets: HourlyBucket[],
  agentMetrics: AgentMetric[],
): OperationalSummary {
  const voice = records.filter((r) => r.segment === 'voice');
  const chat = records.filter((r) => r.segment === 'chat');

  const distinctDays = new Set(records.map((r) => r.attendanceDate).filter((d) => d && d !== 'Sem data'));
  const activeDaysCount = Math.max(1, distinctDays.size);

  const activeHours = hourlyBuckets.filter((b) => b.totalCount > 0);
  const peakHours = [...activeHours].sort((a, b) => b.totalCount - a.totalCount).slice(0, 3);
  const peakVolume = peakHours.reduce((s, h) => s + h.totalCount, 0);
  const peakConcentrationPercent = records.length > 0 ? (peakVolume / records.length) * 100 : 0;

  const nonPeakHours = activeHours.filter((b) => !peakHours.some((p) => p.hour === b.hour));
  const avgPeakVol = peakHours.length > 0 ? peakVolume / peakHours.length : 0;
  const avgNonPeakVol =
    nonPeakHours.length > 0
      ? nonPeakHours.reduce((s, h) => s + h.totalCount, 0) / nonPeakHours.length
      : avgPeakVol;

  const peakVsOffPeakRatio = avgNonPeakVol > 0 ? avgPeakVol / avgNonPeakVol : 1;

  const highestTmaHour =
    activeHours.filter((h) => h.totalCount >= 2).sort((a, b) => b.tmaSeconds - a.tmaSeconds)[0] ??
    activeHours.sort((a, b) => b.tmaSeconds - a.tmaSeconds)[0] ??
    null;

  const teamAvgCallsPerAgentPerDay =
    agentMetrics.length > 0
      ? agentMetrics.reduce((sum, a) => sum + a.avgCallsPerDay, 0) / agentMetrics.length
      : 0;

  const teamAvgCallsPerAgentTotal = agentMetrics.length > 0 ? records.length / agentMetrics.length : 0;

  let surveyYes = 0;
  let surveyTotal = 0;
  for (const v of voice) {
    const res = isPositiveSurvey(v.surveyTransfer);
    if (res !== null) {
      surveyTotal++;
      if (res) surveyYes++;
    }
  }

  return {
    totalRecords: records.length,
    voiceCount: voice.length,
    chatCount: chat.length,
    overallTmaSeconds: avgDuration(records),
    voiceTmaSeconds: avgDuration(voice),
    chatTmaSeconds: avgDuration(chat),
    teamAvgCallsPerAgentPerDay,
    teamAvgCallsPerAgentTotal,
    activeAgentsCount: agentMetrics.length,
    activeDaysCount,
    peakHours,
    highestTmaHour,
    peakConcentrationPercent,
    peakVsOffPeakRatio,
    surveyTransferRatePercent: surveyTotal > 0 ? (surveyYes / surveyTotal) * 100 : null,
    surveyTransferYesCount: surveyYes,
    surveyTransferTotalVoice: voice.length,
  };
}
