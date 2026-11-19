export interface CallRecord {
  id: string;
  cod: string;
  protocolo: string;
  numero: string;
  atendente: string;
  dataEntrada: Date | null;
  dataEntradaRaw: string;
  dataAtendimento: Date | null;
  dataEncerramento: Date | null;
  duracaoSeconds: number | null;
  duracaoMinutes: number | null;
  duracaoFormatted: string;
  esperaSeconds: number | null;
  fila: string;
  desligamento: string;
  transfPesquisa: string;
  uniqueId: string;
  entryHour: number | null; // 0..23
  entryDateKey: string | null; // YYYY-MM-DD
}

export interface ImportMetadata {
  fileName: string;
  fileSize: number;
  sheetName: string;
  totalRows: number;
  validDurationRows: number;
  validDateRows: number;
  importedAt: Date;
  warnings: string[];
}

export interface FilterState {
  selectedOperators: string[]; // Empty array means "Todos os Operadores"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  selectedQueue: string; // 'ALL' means "Todas"
}

export interface HourlyBucket {
  hour: number; // 0..23
  label: string; // "00h" .. "23h"
  rangeLabel: string; // "00:00 - 00:59"
  count: number;
  percentage: number;
  avgTmaMinutes: number;
  avgWaitSeconds: number;
  isPeak: boolean;
  isTop3: boolean;
  isValley: boolean;
}

export interface PeakAnalysis {
  peakHour: HourlyBucket | null;
  top3Critical: HourlyBucket[];
  valleyHour: HourlyBucket | null; // Lowest active (>0) or overall lowest if needed
  valleyAllHours: HourlyBucket | null;
}

export interface OperatorMetrics {
  operator: string;
  callCount: number;
  validDurationCount: number;
  totalMinutes: number;
  tmaMinutes: number;
  tmaFormatted: string; // MM:SS
  tmaHuman: string; // 07m 10s
  peakHour: number | null;
  peakHourLabel: string; // e.g., "10:00 - 10:59"
  peakHourCalls: number;
  avgWaitSeconds: number;
  avgWaitFormatted: string;
  sharePercent: number;
}

export interface DashboardSummary {
  totalCalls: number;
  validTmaCalls: number;
  avgTmaMinutes: number;
  avgTmaFormatted: string; // MM:SS
  avgTmaHuman: string; // 07m 10s
  avgWaitSeconds: number;
  avgWaitFormatted: string; // MM:SS or Xs
  hourlyBuckets: HourlyBucket[];
  peakAnalysis: PeakAnalysis;
  operatorMetrics: OperatorMetrics[];
}

export interface PeriodDelta {
  current: number;
  previous: number;
  diffAbsolute: number;
  diffPercent: number | null; // null if previous === 0
}

export interface PeriodComparison {
  isComparable: boolean;
  reasonIfNotComparable?: string;
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  periodDays: number;
  previousSummary: DashboardSummary | null;
  callsDelta: PeriodDelta | null;
  tmaDelta: PeriodDelta | null;
  waitDelta: PeriodDelta | null;
  peakVolumeDelta: PeriodDelta | null;
}
