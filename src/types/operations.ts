export type Segment = 'voice' | 'chat';
export type SegmentFilter = 'all' | 'voice' | 'chat';
export type ActiveView = 'overview' | 'agents' | 'operator-tma' | 'channels' | 'records';

export interface AttendanceRecord {
  id: string;
  segment: Segment;
  entryTimeRaw: string;
  entryHour: number; // 0-23
  entryMinute: number; // 0-59
  entryTimeFormatted: string; // HH:mm:ss
  attendanceDate: string; // YYYY-MM-DD
  attendanceDateDisplay: string; // DD/MM/YYYY
  closingDateDisplay: string; // DD/MM/YYYY
  durationSeconds: number;
  durationFormatted: string; // mm:ss or hh:mm:ss
  agent: string;
  customerNumber: string;
  protocol: string;
  queue: string;
  disconnectReason: string;
  surveyTransfer?: string; // Voice only
  chatbotSource?: string; // Chat only
}

export interface ParsedWorkbookResult {
  fileName: string;
  records: AttendanceRecord[];
  voiceCount: number;
  chatCount: number;
  detectedSheets: {
    voice?: string;
    chat?: string;
  };
  warnings: string[];
  isSample?: boolean;
}

export interface HourlyBucket {
  hour: number;
  label: string;
  rangeLabel: string;
  totalCount: number;
  voiceCount: number;
  chatCount: number;
  tmaSeconds: number;
  voiceTmaSeconds: number;
  chatTmaSeconds: number;
  sharePercent: number;
  isPeak: boolean;
  isTmaSpike: boolean;
}

export interface DailyBucket {
  date: string;
  dateDisplay: string;
  totalCount: number;
  voiceCount: number;
  chatCount: number;
  tmaSeconds: number;
  voiceTmaSeconds: number;
  chatTmaSeconds: number;
}

export interface AgentMetric {
  agent: string;
  totalCalls: number;
  voiceCalls: number;
  chatCalls: number;
  activeDays: number;
  activeHours: number;
  avgCallsPerDay: number;
  avgCallsPerActiveHour: number;
  tmaSeconds: number;
  voiceTmaSeconds: number;
  chatTmaSeconds: number;
  deltaFromTeamTmaSeconds: number;
  deltaFromTeamAvgCalls: number;
  surveyYesCount: number;
  surveyEligibleCount: number;
  surveyRatePercent: number | null;
  topQueues: { name: string; count: number }[];
  hourlyVolume: number[];
}

export interface CategoryMetric {
  name: string;
  count: number;
  voiceCount: number;
  chatCount: number;
  tmaSeconds: number;
  sharePercent: number;
}

export interface OperationalSummary {
  totalRecords: number;
  voiceCount: number;
  chatCount: number;
  overallTmaSeconds: number;
  voiceTmaSeconds: number;
  chatTmaSeconds: number;
  teamAvgCallsPerAgentPerDay: number;
  teamAvgCallsPerAgentTotal: number;
  activeAgentsCount: number;
  activeDaysCount: number;
  peakHours: HourlyBucket[];
  highestTmaHour: HourlyBucket | null;
  peakConcentrationPercent: number;
  peakVsOffPeakRatio: number;
  surveyTransferRatePercent: number | null;
  surveyTransferYesCount: number;
  surveyTransferTotalVoice: number;
}

export type ImpactLevel = 'Crítico' | 'Alto' | 'Moderado' | 'Baixo' | 'Sem Fluxo';

export interface HourlyImpactRow {
  hour: number;
  label: string;
  rangeLabel: string;
  totalCount: number;
  voiceCount: number;
  chatCount: number;
  avgVolumePerDay: number;
  sharePercent: number;
  tmaSeconds: number;
  voiceTmaSeconds: number;
  chatTmaSeconds: number;
  workloadRatio: number;
  impactLevel: ImpactLevel;
  observedAgentsAvg: number;
  recommendedAgents: number;
  staffingGap: number;
  criticalLoginTime: string;
  actionRecommendation: string;
}

export interface CriticalLoginWindow {
  windowLabel: string;
  startHour: number;
  endHour: number;
  criticalLoginTime: string;
  totalVolume: number;
  sharePercent: number;
  avgTmaSeconds: number;
  maxRequiredAgents: number;
  avgObservedAgents: number;
  extraAgentsNeeded: number;
  topQueue: string;
  solutionSummary: string;
}

export interface SafeBreakWindow {
  windowLabel: string;
  totalVolume: number;
  sharePercent: number;
  avgTmaSeconds: number;
  guidance: string;
}

