import type {
  AgentMetric,
  AttendanceRecord,
  CategoryMetric,
  CriticalLoginWindow,
  DailyBucket,
  HourlyBucket,
  HourlyImpactRow,
  ImpactLevel,
  OperationalSummary,
  SafeBreakWindow,
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

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

export function computeHourlyImpactAndLoginPlan(
  records: AttendanceRecord[],
  hourlyBuckets: HourlyBucket[],
): {
  hourlyImpact: HourlyImpactRow[];
  criticalWindows: CriticalLoginWindow[];
  safeWindows: SafeBreakWindow[];
} {
  const distinctDays = new Set(records.map((r) => r.attendanceDate).filter((d) => d && d !== 'Sem data'));
  const activeDaysCount = Math.max(1, distinctDays.size);

  const grouped: AttendanceRecord[][] = Array.from({length: 24}, () => []);
  for (const r of records) {
    grouped[Math.min(23, Math.max(0, r.entryHour))].push(r);
  }

  // Compute daily workload (seconds/day) per hour to normalize pressure across hours
  const workloadByHour = hourlyBuckets.map((b, h) => {
    const recs = grouped[h];
    const totalSec = recs.reduce((acc, r) => acc + r.durationSeconds, 0);
    return totalSec / activeDaysCount;
  });

  const activeWorkloads = workloadByHour.filter((w) => w > 0);
  const meanWorkload =
    activeWorkloads.length > 0
      ? activeWorkloads.reduce((a, b) => a + b, 0) / activeWorkloads.length
      : 1;

  // First pass: impact metrics & staffing
  const prelim = hourlyBuckets.map((b, h) => {
    const recs = grouped[h];
    const workloadPerDay = workloadByHour[h];
    const workloadRatio = b.totalCount > 0 && meanWorkload > 0 ? workloadPerDay / meanWorkload : 0;

    // Observed distinct agents per active day in this hour
    const agentsByDay = new Map<string, Set<string>>();
    let voiceSec = 0;
    let chatSec = 0;
    for (const r of recs) {
      const dayKey = r.attendanceDate || 'Sem data';
      const set = agentsByDay.get(dayKey) ?? new Set<string>();
      set.add(r.agent);
      agentsByDay.set(dayKey, set);
      if (r.segment === 'voice') voiceSec += r.durationSeconds;
      else chatSec += r.durationSeconds;
    }

    const dayAgentCounts = Array.from(agentsByDay.values()).map((s) => s.size);
    const observedAgentsAvg =
      dayAgentCounts.length > 0
        ? dayAgentCounts.reduce((a, c) => a + c, 0) / dayAgentCounts.length
        : 0;

    // Recommended logged-in agents: 85% occupancy (3060s/h), Voice 1:1, Chat 1.5 concurrency
    const rawAgentsNeeded =
      (voiceSec / activeDaysCount) / 3060 + (chatSec / activeDaysCount) / (3060 * 1.5);
    const recommendedAgents =
      b.totalCount === 0
        ? 0
        : Math.max(1, Math.ceil(rawAgentsNeeded + (rawAgentsNeeded >= 0.65 ? 0.35 : 0)));

    const staffingGap = Math.max(0, recommendedAgents - Math.round(observedAgentsAvg));

    let impactLevel: ImpactLevel = 'Sem Fluxo';
    if (b.totalCount > 0) {
      if (b.isPeak || workloadRatio >= 1.35) {
        impactLevel = 'Crítico';
      } else if (workloadRatio >= 1.05 || b.isTmaSpike) {
        impactLevel = 'Alto';
      } else if (workloadRatio >= 0.65) {
        impactLevel = 'Moderado';
      } else {
        impactLevel = 'Baixo';
      }
    }

    return {
      bucket: b,
      avgVolumePerDay: b.totalCount / activeDaysCount,
      workloadRatio,
      impactLevel,
      observedAgentsAvg: Number(observedAgentsAvg.toFixed(1)),
      recommendedAgents,
      staffingGap,
    };
  });

  // Second pass: determine critical login times and concrete action plans based on adjacent hours
  const hourlyImpact: HourlyImpactRow[] = prelim.map((item, h) => {
    const prev = h > 0 ? prelim[h - 1] : null;
    const isHigh = item.impactLevel === 'Crítico' || item.impactLevel === 'Alto';
    const prevWasHigh = prev !== null && (prev.impactLevel === 'Crítico' || prev.impactLevel === 'Alto');
    const prevHourStr = pad2((h + 23) % 24);

    let criticalLoginTime = '-';
    let actionRecommendation = 'Sem atendimentos registrados nesta faixa.';

    if (item.bucket.totalCount > 0) {
      if (isHigh) {
        if (!prevWasHigh) {
          criticalLoginTime = `${prevHourStr}:30 – ${prevHourStr}:45`;
          actionRecommendation =
            item.staffingGap > 0
              ? `Início de onda de impacto: antecipar login às ${prevHourStr}:30 com +${item.staffingGap} atendente(s) e bloquear pausas/reuniões.`
              : `Início de onda de impacto: garantir equipe logada até ${prevHourStr}:45 para absorver a subida de fluxo sem fila.`;
        } else {
          criticalLoginTime =
            item.staffingGap > 0
              ? `${prevHourStr}:30 (reforço +${item.staffingGap})`
              : `${prevHourStr}:45 (manter escala cheia)`;
          actionRecommendation =
            item.bucket.isTmaSpike
              ? `Sustentação de pico com TMA elevado (${formatTma(item.bucket.tmaSeconds)}): manter escala cheia e acionar apoio de supervisão para destravar chamados longos.`
              : `Sustentação de pico: manter 100% dos postos ativos e evitar trocas de turno ou pausas longas nesta hora.`;
        }
      } else if (item.impactLevel === 'Moderado') {
        criticalLoginTime = 'Escala padrão';
        actionRecommendation = item.bucket.isTmaSpike
          ? `Fluxo moderado com TMA alto (${formatTma(item.bucket.tmaSeconds)}): revisar motivo de retenção na fila.`
          : 'Fluxo equilibrado: janela viável para revezamento controlado de pausas rápidas.';
      } else {
        criticalLoginTime = 'Janela de baixa pressão';
        actionRecommendation = 'Baixo impacto: horário recomendado para almoço escalonado, feedbacks, treinamentos e backoffice.';
      }
    }

    return {
      hour: h,
      label: item.bucket.label,
      rangeLabel: item.bucket.rangeLabel,
      totalCount: item.bucket.totalCount,
      voiceCount: item.bucket.voiceCount,
      chatCount: item.bucket.chatCount,
      avgVolumePerDay: Number(item.avgVolumePerDay.toFixed(1)),
      sharePercent: item.bucket.sharePercent,
      tmaSeconds: item.bucket.tmaSeconds,
      voiceTmaSeconds: item.bucket.voiceTmaSeconds,
      chatTmaSeconds: item.bucket.chatTmaSeconds,
      workloadRatio: Number(item.workloadRatio.toFixed(2)),
      impactLevel: item.impactLevel,
      observedAgentsAvg: item.observedAgentsAvg,
      recommendedAgents: item.recommendedAgents,
      staffingGap: item.staffingGap,
      criticalLoginTime,
      actionRecommendation,
    };
  });

  // Group contiguous Crítico/Alto hours into Critical Login Windows
  const criticalWindows: CriticalLoginWindow[] = [];
  let currentGroup: HourlyImpactRow[] = [];

  const flushCriticalGroup = () => {
    if (currentGroup.length === 0) return;
    const startHour = currentGroup[0].hour;
    const endHour = currentGroup[currentGroup.length - 1].hour;
    const prevHourStr = pad2((startHour + 23) % 24);
    const windowRecs = currentGroup.flatMap((g) => grouped[g.hour]);
    const totalVolume = windowRecs.length;
    const sharePercent = records.length > 0 ? (totalVolume / records.length) * 100 : 0;
    const avgTmaSeconds = avgDuration(windowRecs);
    const maxRequiredAgents = Math.max(...currentGroup.map((g) => g.recommendedAgents));
    const avgObservedAgents =
      currentGroup.reduce((s, g) => s + g.observedAgentsAvg, 0) / currentGroup.length;
    const extraAgentsNeeded = Math.max(0, maxRequiredAgents - Math.round(avgObservedAgents));

    const queueCount = new Map<string, number>();
    for (const r of windowRecs) {
      queueCount.set(r.queue, (queueCount.get(r.queue) ?? 0) + 1);
    }
    const topQueue =
      Array.from(queueCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Geral';

    const criticalLoginTime = `${prevHourStr}:30 – ${prevHourStr}:45`;
    const windowLabel = `${pad2(startHour)}:00 – ${pad2(endHour)}:59`;

    const solutionSummary =
      extraAgentsNeeded > 0
        ? `Programar entrada/login crítico entre ${criticalLoginTime} com mínimo de ${maxRequiredAgents} operador(es) (+${extraAgentsNeeded} sobre a média observada de ${avgObservedAgents.toFixed(1)}). Priorizar fila "${topQueue}" e suspender reuniões até ${pad2(endHour)}:59.`
        : `Garantir 100% do login até ${prevHourStr}:45 (${maxRequiredAgents} operador(es) ativos) antes da abertura da janela ${windowLabel}. Direcionar foco inicial para a fila "${topQueue}".`;

    criticalWindows.push({
      windowLabel,
      startHour,
      endHour,
      criticalLoginTime,
      totalVolume,
      sharePercent,
      avgTmaSeconds,
      maxRequiredAgents,
      avgObservedAgents: Number(avgObservedAgents.toFixed(1)),
      extraAgentsNeeded,
      topQueue,
      solutionSummary,
    });
    currentGroup = [];
  };

  for (const row of hourlyImpact) {
    if (row.impactLevel === 'Crítico' || row.impactLevel === 'Alto') {
      currentGroup.push(row);
    } else {
      flushCriticalGroup();
    }
  }
  flushCriticalGroup();

  // Group contiguous active Baixo/Moderado hours into Safe Break Windows
  const safeWindows: SafeBreakWindow[] = [];
  let safeGroup: HourlyImpactRow[] = [];

  const flushSafeGroup = () => {
    if (safeGroup.length === 0) return;
    const startHour = safeGroup[0].hour;
    const endHour = safeGroup[safeGroup.length - 1].hour;
    const windowRecs = safeGroup.flatMap((g) => grouped[g.hour]);
    const totalVolume = windowRecs.length;
    const sharePercent = records.length > 0 ? (totalVolume / records.length) * 100 : 0;
    const avgTmaSeconds = avgDuration(windowRecs);
    const hasOnlyLow = safeGroup.every((g) => g.impactLevel === 'Baixo');

    safeWindows.push({
      windowLabel: `${pad2(startHour)}:00 – ${pad2(endHour)}:59`,
      totalVolume,
      sharePercent,
      avgTmaSeconds,
      guidance: hasOnlyLow
        ? 'Janela ideal para almoço escalonado, pausas NR-17, treinamentos e feedbacks.'
        : 'Fluxo moderado: permite revezamento parcial de pausas sem impactar o SLA.',
    });
    safeGroup = [];
  };

  for (const row of hourlyImpact) {
    if (row.totalCount > 0 && (row.impactLevel === 'Baixo' || row.impactLevel === 'Moderado')) {
      safeGroup.push(row);
    } else {
      flushSafeGroup();
    }
  }
  flushSafeGroup();

  return {
    hourlyImpact,
    criticalWindows,
    safeWindows: safeWindows.sort((a, b) => a.sharePercent - b.sharePercent),
  };
}

