import * as XLSX from 'xlsx';
import type {
  AgentMetric,
  AttendanceRecord,
  CategoryMetric,
  CriticalLoginWindow,
  DailyBucket,
  HourlyImpactRow,
  OperationalSummary,
  SafeBreakWindow,
  SegmentFilter,
} from '../types/operations';
import {formatTma} from './analytics';

export interface AnalyticalReportPayload {
  sourceFileName: string;
  segmentFilter: SegmentFilter;
  filterDescription: string;
  records: AttendanceRecord[];
  summary: OperationalSummary;
  hourlyImpact: HourlyImpactRow[];
  criticalWindows: CriticalLoginWindow[];
  safeWindows: SafeBreakWindow[];
  dailyBuckets: DailyBucket[];
  agentMetrics: AgentMetric[];
  queueMetrics: CategoryMetric[];
  chatbotMetrics: CategoryMetric[];
  disconnectMetrics: CategoryMetric[];
  surveyMetrics: CategoryMetric[];
}

function autoFitCols(rows: unknown[][], minW = 12, maxW = 56): XLSX.ColInfo[] {
  const colWidths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, idx) => {
      const len = String(cell ?? '').length;
      colWidths[idx] = Math.max(colWidths[idx] ?? minW, Math.min(maxW, len + 3));
    });
  }
  return colWidths.map((wch) => ({wch}));
}

function formatSignedTma(deltaSeconds: number): string {
  const sign = deltaSeconds >= 0 ? '+' : '-';
  return `${sign}${formatTma(Math.abs(deltaSeconds))}`;
}

export function exportAnalyticalReportWorkbook(payload: AnalyticalReportPayload): void {
  const wb = XLSX.utils.book_new();
  const nowStr = new Date().toLocaleString('pt-BR');
  const segmentLabel =
    payload.segmentFilter === 'all'
      ? 'Todos (Voice + Chat)'
      : payload.segmentFilter === 'voice'
        ? 'Voice'
        : 'Chat';

  // ---------------------------------------------------------------------------
  // ABA 1: RESUMO E SOLUÇÕES
  // ---------------------------------------------------------------------------
  const summaryRows: unknown[][] = [
    ['RELATÓRIO OPERACIONAL DE CURVA DE TMA, PICOS DE FLUXO E ESCALA DE LOGINS'],
    ['Arquivo de Origem', payload.sourceFileName],
    ['Segmento Analisado', segmentLabel],
    ['Filtros Aplicados', payload.filterDescription],
    ['Gerado em', nowStr],
    [],
    ['1. INDICADORES GERAIS DO RECORTE', 'Valor', 'Detalhe / Contexto'],
    ['Total de Atendimentos', payload.summary.totalRecords, `${payload.summary.voiceCount} Voice | ${payload.summary.chatCount} Chat`],
    ['TMA Geral', formatTma(payload.summary.overallTmaSeconds), `Voice: ${formatTma(payload.summary.voiceTmaSeconds)} | Chat: ${formatTma(payload.summary.chatTmaSeconds)}`],
    ['Atendentes Ativos', payload.summary.activeAgentsCount, `${payload.summary.activeDaysCount} dia(s) coberto(s) por DATA DA ENTRADA`],
    ['Média por Atendente / Dia', Number(payload.summary.teamAvgCallsPerAgentPerDay.toFixed(1)), `Média acumulada por atendente: ${payload.summary.teamAvgCallsPerAgentTotal.toFixed(1)}`],
    [
      'Maior Horário de Pico',
      payload.summary.peakHours[0]?.rangeLabel ?? '-',
      payload.summary.peakHours[0]
        ? `${payload.summary.peakHours[0].totalCount} atend. (${payload.summary.peakHours[0].sharePercent.toFixed(1)}% do fluxo) | TMA ${formatTma(payload.summary.peakHours[0].tmaSeconds)}`
        : '-',
    ],
    [
      'Horário de Maior TMA',
      payload.summary.highestTmaHour?.rangeLabel ?? '-',
      payload.summary.highestTmaHour
        ? `TMA ${formatTma(payload.summary.highestTmaHour.tmaSeconds)} (${payload.summary.highestTmaHour.totalCount} atend.)`
        : '-',
    ],
    ['Concentração nos 3 Maiores Picos', `${payload.summary.peakConcentrationPercent.toFixed(1)}%`, `Pressão ${payload.summary.peakVsOffPeakRatio.toFixed(2)}x maior que fora do pico`],
    [
      'Transferência p/ Pesquisa (Voice)',
      payload.summary.surveyTransferRatePercent !== null
        ? `${payload.summary.surveyTransferRatePercent.toFixed(1)}%`
        : 'N/A',
      `${payload.summary.surveyTransferYesCount} transferidos de ${payload.summary.surveyTransferTotalVoice} ligações Voice`,
    ],
    [
      'Principal Origem Chatbot (Chat)',
      payload.chatbotMetrics[0]?.name ?? 'N/A',
      payload.chatbotMetrics[0]
        ? `${payload.chatbotMetrics[0].count} chats (${payload.chatbotMetrics[0].sharePercent.toFixed(1)}%) | TMA ${formatTma(payload.chatbotMetrics[0].tmaSeconds)}`
        : '-',
    ],
    [],
    ['2. SOLUÇÃO PARA IMPACTOS DE FLUXO — JANELAS CRÍTICAS E HORÁRIOS DE LOGIN'],
    [
      'Janela de Impacto',
      'Horário Crítico de Login',
      'Volume na Janela',
      '% do Fluxo',
      'TMA Médio',
      'Atend. Observados (Média)',
      'Atend. Recomendados (85% ocup.)',
      'Reforço Adicional',
      'Fila Mais Pressionada',
      'Solução Operacional Recomendada',
    ],
  ];

  if (payload.criticalWindows.length === 0) {
    summaryRows.push(['Nenhuma janela crítica identificada neste recorte.', '', '', '', '', '', '', '', '', '']);
  } else {
    for (const w of payload.criticalWindows) {
      summaryRows.push([
        w.windowLabel,
        w.criticalLoginTime,
        w.totalVolume,
        `${w.sharePercent.toFixed(1)}%`,
        formatTma(w.avgTmaSeconds),
        w.avgObservedAgents,
        w.maxRequiredAgents,
        w.extraAgentsNeeded > 0 ? `+${w.extraAgentsNeeded}` : '0 (adequado)',
        w.topQueue,
        w.solutionSummary,
      ]);
    }
  }

  summaryRows.push([]);
  summaryRows.push(['3. JANELAS SEGURAS PARA PAUSAS, ALMOÇO E TREINAMENTOS']);
  summaryRows.push(['Janela Horária', 'Volume', '% do Fluxo', 'TMA Médio', 'Recomendação de Uso']);
  if (payload.safeWindows.length === 0) {
    summaryRows.push(['Nenhuma janela de baixa pressão encontrada.', '', '', '', '']);
  } else {
    for (const s of payload.safeWindows) {
      summaryRows.push([
        s.windowLabel,
        s.totalVolume,
        `${s.sharePercent.toFixed(1)}%`,
        formatTma(s.avgTmaSeconds),
        s.guidance,
      ]);
    }
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = autoFitCols(summaryRows, 14, 64);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo e Soluções');

  // ---------------------------------------------------------------------------
  // ABA 2: CURVA HORÁRIA E LOGINS (00h - 23h)
  // ---------------------------------------------------------------------------
  const hourlyHeader = [
    'Faixa Horária',
    'Hora',
    'Volume Total',
    'Volume Voice',
    'Volume Chat',
    'Média Atend./Dia',
    '% do Fluxo',
    'TMA Geral',
    'TMA Voice',
    'TMA Chat',
    'Índice de Carga (x Média)',
    'Nível de Impacto',
    'Atend. Observados/Dia',
    'Atend. Recomendados (85% ocup.)',
    'Déficit / Reforço',
    'Horário Crítico de Login',
    'Solução Operacional Sugerida',
  ];

  const hourlyRows: unknown[][] = [
    hourlyHeader,
    ...payload.hourlyImpact.map((h) => [
      h.rangeLabel,
      h.label,
      h.totalCount,
      h.voiceCount,
      h.chatCount,
      h.avgVolumePerDay,
      `${h.sharePercent.toFixed(1)}%`,
      h.totalCount > 0 ? formatTma(h.tmaSeconds) : '00:00',
      h.voiceCount > 0 ? formatTma(h.voiceTmaSeconds) : '00:00',
      h.chatCount > 0 ? formatTma(h.chatTmaSeconds) : '00:00',
      h.totalCount > 0 ? `${h.workloadRatio.toFixed(2)}x` : '0.00x',
      h.impactLevel,
      h.observedAgentsAvg,
      h.recommendedAgents,
      h.staffingGap > 0 ? `+${h.staffingGap}` : 0,
      h.criticalLoginTime,
      h.actionRecommendation,
    ]),
  ];

  const wsHourly = XLSX.utils.aoa_to_sheet(hourlyRows);
  wsHourly['!cols'] = autoFitCols(hourlyRows, 12, 58);
  XLSX.utils.book_append_sheet(wb, wsHourly, 'Curva Horária e Logins');

  // ---------------------------------------------------------------------------
  // ABA 3: PLANO DE LOGIN CRÍTICO (Priorizado por Impacto)
  // ---------------------------------------------------------------------------
  const activeImpactSorted = [...payload.hourlyImpact]
    .filter((h) => h.totalCount > 0)
    .sort((a, b) => b.workloadRatio - a.workloadRatio);

  const loginPlanRows: unknown[][] = [
    ['MATRIZ DE PRIORIZAÇÃO DE IMPACTOS E HORÁRIOS CRÍTICOS DE LOGIN'],
    ['Ordenado do horário de maior pressão operacional para o menor (base: volume x TMA diário)'],
    [],
    [
      'Prioridade',
      'Faixa Horária',
      'Nível de Impacto',
      'Horário Crítico de Login',
      'Volume Total',
      '% do Fluxo',
      'TMA do Horário',
      'Índice de Carga',
      'Atend. Observados',
      'Atend. Recomendados',
      'Reforço Necessário',
      'Plano de Ação',
    ],
    ...activeImpactSorted.map((h, idx) => [
      `${idx + 1}º`,
      h.rangeLabel,
      h.impactLevel,
      h.criticalLoginTime,
      h.totalCount,
      `${h.sharePercent.toFixed(1)}%`,
      formatTma(h.tmaSeconds),
      `${h.workloadRatio.toFixed(2)}x`,
      h.observedAgentsAvg,
      h.recommendedAgents,
      h.staffingGap > 0 ? `+${h.staffingGap} atendente(s)` : 'Adequado',
      h.actionRecommendation,
    ]),
  ];

  const wsLoginPlan = XLSX.utils.aoa_to_sheet(loginPlanRows);
  wsLoginPlan['!cols'] = autoFitCols(loginPlanRows, 12, 62);
  XLSX.utils.book_append_sheet(wb, wsLoginPlan, 'Plano de Login Crítico');

  // ---------------------------------------------------------------------------
  // ABA 4: CURVA POR DATA (DATA DA ENTRADA)
  // ---------------------------------------------------------------------------
  const peakHourByDate = new Map<string, string>();
  const dateHourMap = new Map<string, Map<number, number>>();
  for (const r of payload.records) {
    const dKey = r.attendanceDate || 'Sem data';
    const hMap = dateHourMap.get(dKey) ?? new Map<number, number>();
    hMap.set(r.entryHour, (hMap.get(r.entryHour) ?? 0) + 1);
    dateHourMap.set(dKey, hMap);
  }
  for (const [dKey, hMap] of dateHourMap.entries()) {
    const top = Array.from(hMap.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const hStr = String(top[0]).padStart(2, '0');
      peakHourByDate.set(dKey, `${hStr}:00–${hStr}:59 (${top[1]} atend.)`);
    }
  }

  const dailyRows: unknown[][] = [
    ['Data da Entrada', 'Volume Total', 'Voice', 'Chat', 'TMA Geral', 'TMA Voice', 'TMA Chat', 'Horário de Maior Pico no Dia'],
    ...payload.dailyBuckets.map((d) => [
      d.dateDisplay,
      d.totalCount,
      d.voiceCount,
      d.chatCount,
      formatTma(d.tmaSeconds),
      d.voiceCount > 0 ? formatTma(d.voiceTmaSeconds) : '00:00',
      d.chatCount > 0 ? formatTma(d.chatTmaSeconds) : '00:00',
      peakHourByDate.get(d.date) ?? '-',
    ]),
  ];

  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
  wsDaily['!cols'] = autoFitCols(dailyRows, 14, 34);
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Curva por Data');

  // ---------------------------------------------------------------------------
  // ABA 5: ATENDENTES
  // ---------------------------------------------------------------------------
  const agentRows: unknown[][] = [
    [
      'Atendente',
      'Volume Total',
      'Voice',
      'Chat',
      'Dias Ativos',
      'Média Atend./Dia',
      'Dif. Média vs Equipe',
      'Média Atend./Hora Ativa',
      'TMA Médio',
      'Dif. TMA vs Equipe',
      'TMA Voice',
      'TMA Chat',
      'Taxa Pesquisa (Voice)',
      'Principal Fila',
      'Horário de Maior Atuação',
    ],
    ...payload.agentMetrics.map((a) => {
      const maxHourVal = Math.max(...a.hourlyVolume);
      const topHourIdx = a.hourlyVolume.findIndex((v) => v === maxHourVal);
      const topHourStr =
        maxHourVal > 0 && topHourIdx >= 0
          ? `${String(topHourIdx).padStart(2, '0')}h (${maxHourVal} atend.)`
          : '-';

      return [
        a.agent,
        a.totalCalls,
        a.voiceCalls,
        a.chatCalls,
        a.activeDays,
        Number(a.avgCallsPerDay.toFixed(1)),
        `${a.deltaFromTeamAvgCalls >= 0 ? '+' : ''}${a.deltaFromTeamAvgCalls.toFixed(1)}`,
        Number(a.avgCallsPerActiveHour.toFixed(1)),
        formatTma(a.tmaSeconds),
        formatSignedTma(a.deltaFromTeamTmaSeconds),
        a.voiceCalls > 0 ? formatTma(a.voiceTmaSeconds) : '00:00',
        a.chatCalls > 0 ? formatTma(a.chatTmaSeconds) : '00:00',
        a.surveyRatePercent !== null ? `${a.surveyRatePercent.toFixed(1)}%` : 'N/A',
        a.topQueues[0]?.name ?? '-',
        topHourStr,
      ];
    }),
  ];

  const wsAgents = XLSX.utils.aoa_to_sheet(agentRows);
  wsAgents['!cols'] = autoFitCols(agentRows, 14, 30);
  XLSX.utils.book_append_sheet(wb, wsAgents, 'Atendentes');

  // ---------------------------------------------------------------------------
  // ABA 6: FILAS E CANAIS
  // ---------------------------------------------------------------------------
  const channelsRows: unknown[][] = [
    ['1. FILAS DE ATENDIMENTO'],
    ['Fila', 'Volume Total', 'Voice', 'Chat', '% Participação', 'TMA Médio'],
    ...payload.queueMetrics.map((q) => [
      q.name,
      q.count,
      q.voiceCount,
      q.chatCount,
      `${q.sharePercent.toFixed(1)}%`,
      formatTma(q.tmaSeconds),
    ]),
    [],
    ['2. ORIGEM CHATBOT (SEGMENTO CHAT)'],
    ['Canal Chatbot', 'Volume Chats', '% Participação', 'TMA Médio'],
    ...payload.chatbotMetrics.map((c) => [
      c.name,
      c.count,
      `${c.sharePercent.toFixed(1)}%`,
      formatTma(c.tmaSeconds),
    ]),
    [],
    ['3. MOTIVO / RESPONSÁVEL PELO DESLIGAMENTO'],
    ['Desligamento', 'Quantidade', 'Voice', 'Chat', '% Participação', 'TMA Médio'],
    ...payload.disconnectMetrics.map((d) => [
      d.name,
      d.count,
      d.voiceCount,
      d.chatCount,
      `${d.sharePercent.toFixed(1)}%`,
      formatTma(d.tmaSeconds),
    ]),
    [],
    ['4. TRANSFERÊNCIA PARA PESQUISA (SEGMENTO VOICE)'],
    ['Transferência Pesquisa', 'Quantidade', '% Participação', 'TMA Médio'],
    ...payload.surveyMetrics.map((s) => [
      s.name,
      s.count,
      `${s.sharePercent.toFixed(1)}%`,
      formatTma(s.tmaSeconds),
    ]),
  ];

  const wsChannels = XLSX.utils.aoa_to_sheet(channelsRows);
  wsChannels['!cols'] = autoFitCols(channelsRows, 16, 36);
  XLSX.utils.book_append_sheet(wb, wsChannels, 'Filas e Canais');

  // ---------------------------------------------------------------------------
  // ABAS 7 & 8: DADOS FILTRADOS ORIGINAIS (VOICE e CHAT)
  // ---------------------------------------------------------------------------
  const voiceRecords = payload.records
    .filter((r) => r.segment === 'voice')
    .map((r) => ({
      'HORARIO DE ENTRADA': r.entryTimeFormatted,
      'DATA DA ENTRADA': r.attendanceDateDisplay,
      'DATA DO ENCERRAMENTO': r.closingDateDisplay,
      DURAÇÃO: r.durationFormatted,
      ATENDENTE: r.agent,
      NÚMERO: r.customerNumber,
      PROTOCOLO: r.protocol,
      'FILA DE ATENDIMENTO': r.queue,
      DELIGAMENTO: r.disconnectReason,
      'TRANSFERENCIA PARA PESQUISA': r.surveyTransfer ?? '',
    }));

  const chatRecords = payload.records
    .filter((r) => r.segment === 'chat')
    .map((r) => ({
      'HORARIO DE ENTRADA': r.entryTimeFormatted,
      'DATA DA ENTRADA': r.attendanceDateDisplay,
      'DATA DO ENCERRAMENTO': r.closingDateDisplay,
      DURAÇÃO: r.durationFormatted,
      ATENDENTE: r.agent,
      NÚMERO: r.customerNumber,
      PROTOCOLO: r.protocol,
      'FILA DE ATENDIMENTO': r.queue,
      DELIGAMENTO: r.disconnectReason,
      CHATBOT: r.chatbotSource ?? '',
    }));

  if (voiceRecords.length > 0) {
    const wsVoiceData = XLSX.utils.json_to_sheet(voiceRecords);
    wsVoiceData['!cols'] = Array.from({length: 10}, () => ({wch: 20}));
    XLSX.utils.book_append_sheet(wb, wsVoiceData, 'VOICE_Dados');
  }

  if (chatRecords.length > 0) {
    const wsChatData = XLSX.utils.json_to_sheet(chatRecords);
    wsChatData['!cols'] = Array.from({length: 10}, () => ({wch: 20}));
    XLSX.utils.book_append_sheet(wb, wsChatData, 'CHAT_Dados');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `relatorio_tma_picos_logins_${stamp}.xlsx`);
}
