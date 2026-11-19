import * as XLSX from 'xlsx';
import type {
  CallRecord,
  DashboardSummary,
  FilterState,
  ImportMetadata,
} from '../types/callCenter';

function normalizeHeader(header: string): string {
  return String(header || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES: Record<string, keyof RawColumnMap> = {
  cod: 'cod',
  codigo: 'cod',
  protocolo: 'protocolo',
  numero: 'numero',
  telefone: 'numero',
  atendente: 'atendente',
  operador: 'atendente',
  agente: 'atendente',
  datadaentrada: 'dataEntrada',
  dataentrada: 'dataEntrada',
  entrada: 'dataEntrada',
  datadoatendimento: 'dataAtendimento',
  dataatendimento: 'dataAtendimento',
  datadatend: 'dataAtendimento',
  datadoencerramento: 'dataEncerramento',
  dataencerramento: 'dataEncerramento',
  datadeencerramento: 'dataEncerramento',
  duracaodoatend: 'duracao',
  duracaodoatendimento: 'duracao',
  duracaoatend: 'duracao',
  duracaoatendimento: 'duracao',
  duracao: 'duracao',
  tma: 'duracao',
  esperaemseg: 'espera',
  esperaseg: 'espera',
  espera: 'espera',
  tempoespera: 'espera',
  filadeatendimento: 'fila',
  filaatendimento: 'fila',
  fila: 'fila',
  desligamento: 'desligamento',
  transfpesquisa: 'transfPesquisa',
  transferenciapesquisa: 'transfPesquisa',
  uniqueid: 'uniqueId',
  idunico: 'uniqueId',
};

interface RawColumnMap {
  cod: number;
  protocolo: number;
  numero: number;
  atendente: number;
  dataEntrada: number;
  dataAtendimento: number;
  dataEncerramento: number;
  duracao: number;
  espera: number;
  fila: number;
  desligamento: number;
  transfPesquisa: number;
  uniqueId: number;
}

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

export function formatDateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

export function formatDateTimeBR(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '—';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function formatSecondsToMMSS(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '—';
  }
  const rounded = Math.round(totalSeconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${pad2(mins)}:${pad2(secs)}`;
}

export function formatMinutesToHuman(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '00m 00s';
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${pad2(mins)}m ${pad2(secs)}s`;
}

export function parseExcelOrStringDate(value: unknown): { date: Date | null; raw: string } {
  if (value === null || value === undefined || value === '') {
    return { date: null, raw: '' };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { date: null, raw: '' };
    return { date: value, raw: formatDateTimeBR(value) };
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // SheetJS SSF.parse_date_code avoids local/UTC timezone drift
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const date = new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H || 0,
        parsed.M || 0,
        Math.round(parsed.S || 0)
      );
      if (!Number.isNaN(date.getTime())) {
        return { date, raw: formatDateTimeBR(date) };
      }
    }
    return { date: null, raw: String(value) };
  }

  const str = String(value).trim();
  if (!str || str === '-' || str === '—') {
    return { date: null, raw: str };
  }

  // DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm or DD/MM/YYYY
  const brMatch = str.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10);
    let year = parseInt(brMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
    const minute = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    const second = brMatch[6] ? parseInt(brMatch[6], 10) : 0;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23 && minute <= 59 && second <= 59) {
      const date = new Date(year, month - 1, day, hour, minute, second);
      if (!Number.isNaN(date.getTime())) {
        return { date, raw: str };
      }
    }
  }

  // ISO YYYY-MM-DD HH:mm:ss
  const isoMatch = str.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const minute = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const second = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (!Number.isNaN(date.getTime())) {
      return { date, raw: str };
    }
  }

  return { date: null, raw: str };
}

export function parseDurationToSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.getHours() * 3600 + value.getMinutes() * 60 + value.getSeconds();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0) return null;
    // Excel serial time: < 10 treated as pure duration days; >= 10 extract fractional time of day
    const fraction = value < 10 ? value : value - Math.floor(value);
    const seconds = Math.round(fraction * 86400);
    return seconds >= 0 ? seconds : null;
  }

  const str = String(value).trim();
  if (!str || str === '-' || str === '—') return null;

  // HH:mm:ss or H:mm:ss
  const hmsMatch = str.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hmsMatch) {
    const h = parseInt(hmsMatch[1], 10);
    const m = parseInt(hmsMatch[2], 10);
    const s = parseInt(hmsMatch[3], 10);
    if (m < 60 && s < 60) {
      return h * 3600 + m * 60 + s;
    }
  }

  // MM:SS fallback
  const msMatch = str.match(/^(\d+):(\d{1,2})$/);
  if (msMatch) {
    const m = parseInt(msMatch[1], 10);
    const s = parseInt(msMatch[2], 10);
    if (s < 60) {
      return m * 60 + s;
    }
  }

  // Numeric string (e.g. Excel serial stored as text or seconds)
  const numeric = Number(str.replace(',', '.'));
  if (Number.isFinite(numeric) && numeric >= 0) {
    if (numeric > 0 && numeric < 1) {
      return Math.round(numeric * 86400);
    }
    return Math.round(numeric);
  }

  return null;
}

export function parseWaitSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? value : null;
  }
  const str = String(value).trim();
  if (!str || str === '-' || str === '—') return null;

  // Check if formatted as HH:mm:ss
  if (str.includes(':')) {
    return parseDurationToSeconds(str);
  }

  const num = Number(str.replace(',', '.'));
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Check UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  // If replacement character appears, fallback to Windows-1252 (common in Brazilian Excel CSV exports)
  if (utf8.includes('\uFFFD')) {
    return new TextDecoder('windows-1252').decode(bytes);
  }
  return utf8;
}

function detectCsvDelimiter(csvText: string): string {
  const firstLines = csvText.split(/\r?\n/).slice(0, 5).join('\n');
  const semicolons = (firstLines.match(/;/g) || []).length;
  const commas = (firstLines.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

export async function parseCallCenterFile(
  file: File
): Promise<{ records: CallRecord[]; metadata: ImportMetadata }> {
  const buffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith('.csv');

  let workbook: XLSX.WorkBook;
  if (isCsv) {
    const text = decodeCsvBuffer(buffer);
    const delimiter = detectCsvDelimiter(text);
    workbook = XLSX.read(text, {
      type: 'string',
      FS: delimiter,
      raw: false,
    });
  } else {
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: false,
      raw: true,
    });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('A planilha não possui nenhuma aba válida.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  if (rows.length < 2) {
    throw new Error('A planilha está vazia ou contém apenas o cabeçalho.');
  }

  // Locate header row (first non-empty row with at least 3 recognized columns or first non-empty row)
  let headerRowIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const candidate = rows[i];
    if (!Array.isArray(candidate)) continue;
    let score = 0;
    for (const cell of candidate) {
      const norm = normalizeHeader(String(cell ?? ''));
      if (norm in HEADER_ALIASES) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
    }
  }

  const headerRow = rows[headerRowIndex] as unknown[];
  const colMap: RawColumnMap = {
    cod: -1,
    protocolo: -1,
    numero: -1,
    atendente: -1,
    dataEntrada: -1,
    dataAtendimento: -1,
    dataEncerramento: -1,
    duracao: -1,
    espera: -1,
    fila: -1,
    desligamento: -1,
    transfPesquisa: -1,
    uniqueId: -1,
  };

  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeader(String(cell ?? ''));
    const mapped = HEADER_ALIASES[norm];
    if (mapped && colMap[mapped] === -1) {
      colMap[mapped] = idx;
    }
  });

  const warnings: string[] = [];
  if (colMap.atendente === -1) {
    warnings.push('Coluna "Atendente" não identificada automaticamente.');
  }
  if (colMap.dataEntrada === -1 && colMap.dataAtendimento === -1) {
    warnings.push('Coluna "Data da Entrada" não encontrada.');
  }
  if (colMap.duracao === -1) {
    warnings.push('Coluna "Duraçãodo Atend." / "Duração do Atend." não encontrada.');
  }

  if (bestScore < 2) {
    throw new Error(
      'Estrutura de colunas incompatível. Verifique se a planilha contém as colunas esperadas (Atendente, Data da Entrada, Duração do Atend., etc.).'
    );
  }

  const records: CallRecord[] = [];
  let validDurationRows = 0;
  let validDateRows = 0;

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    // Skip completely empty rows
    const hasContent = row.some((c) => c !== null && c !== undefined && String(c).trim() !== '');
    if (!hasContent) continue;

    const getCell = (idx: number): unknown => (idx >= 0 && idx < row.length ? row[idx] : '');
    const getStr = (idx: number): string => String(getCell(idx) ?? '').trim();

    const entradaParsed = parseExcelOrStringDate(getCell(colMap.dataEntrada));
    const atendimentoParsed = parseExcelOrStringDate(getCell(colMap.dataAtendimento));
    const encerramentoParsed = parseExcelOrStringDate(getCell(colMap.dataEncerramento));

    const referenceDate = entradaParsed.date || atendimentoParsed.date;
    if (referenceDate) validDateRows++;

    const duracaoSeconds = parseDurationToSeconds(getCell(colMap.duracao));
    const duracaoMinutes = duracaoSeconds !== null ? duracaoSeconds / 60 : null;
    if (duracaoMinutes !== null) validDurationRows++;

    const esperaSeconds = parseWaitSeconds(getCell(colMap.espera));

    const atendente = getStr(colMap.atendente) || 'Não identificado';
    const fila = getStr(colMap.fila) || 'Sem fila';
    const cod = getStr(colMap.cod);
    const protocolo = getStr(colMap.protocolo);
    const uniqueId = getStr(colMap.uniqueId) || `${r}-${cod || protocolo}`;

    records.push({
      id: `${r}-${uniqueId}`,
      cod,
      protocolo,
      numero: getStr(colMap.numero),
      atendente,
      dataEntrada: entradaParsed.date,
      dataEntradaRaw: entradaParsed.raw || formatDateTimeBR(referenceDate),
      dataAtendimento: atendimentoParsed.date,
      dataEncerramento: encerramentoParsed.date,
      duracaoSeconds,
      duracaoMinutes,
      duracaoFormatted: formatSecondsToMMSS(duracaoSeconds),
      esperaSeconds,
      fila,
      desligamento: getStr(colMap.desligamento) || '—',
      transfPesquisa: getStr(colMap.transfPesquisa) || '—',
      uniqueId,
      entryHour: referenceDate ? referenceDate.getHours() : null,
      entryDateKey: referenceDate ? formatDateToKey(referenceDate) : null,
    });
  }

  return {
    records,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      sheetName,
      totalRows: records.length,
      validDurationRows,
      validDateRows,
      importedAt: new Date(),
      warnings,
    },
  };
}

export function generateSampleRecords(): { records: CallRecord[]; metadata: ImportMetadata } {
  const operators = [
    { name: 'Ana Carolina Silva', baseTmaSec: 390, peakBias: 10 },
    { name: 'Bruno Henrique Costa', baseTmaSec: 465, peakBias: 11 },
    { name: 'Camila Ferreira Souza', baseTmaSec: 345, peakBias: 10 },
    { name: 'Diego Almeida Santos', baseTmaSec: 515, peakBias: 15 },
    { name: 'Eduarda Martins Lima', baseTmaSec: 420, peakBias: 14 },
    { name: 'Felipe Augusto Rocha', baseTmaSec: 485, peakBias: 16 },
    { name: 'Gabriela Mendes Pereira', baseTmaSec: 370, peakBias: 10 },
    { name: 'Henrique Oliveira Dias', baseTmaSec: 440, peakBias: 11 },
    { name: 'Isabela Ribeiro Gomes', baseTmaSec: 405, peakBias: 15 },
    { name: 'João Pedro Carvalho', baseTmaSec: 530, peakBias: 14 },
  ];

  const queues = ['Suporte Técnico', 'Financeiro & Cobrança', 'Atendimento Geral', 'Retenção & Planos'];
  const disconnects = ['Atendente', 'Cliente', 'Transferência', 'Cliente'];
  const transfers = ['Sim', 'Não', 'Não', 'Sim'];

  // Hourly weight profile simulating realistic Call Center curve (peaks at 10h and 15h, valley at 04h/23h)
  const hourlyWeights = [
    4, 2, 1, 1, 2, 5, 12, 24, 46, 68, 86, 74, 52, 58, 72, 80, 66, 48, 34, 22, 16, 11, 7, 5,
  ];

  // Deterministic pseudo-random generator for consistent sample runs
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const records: CallRecord[] = [];
  const baseDates = [
    new Date(2026, 9, 12),
    new Date(2026, 9, 13),
    new Date(2026, 9, 14),
    new Date(2026, 9, 15),
    new Date(2026, 9, 16),
  ];

  let idx = 1;
  for (const dayDate of baseDates) {
    for (let hour = 0; hour < 24; hour++) {
      const countForHour = Math.max(
        0,
        Math.round((hourlyWeights[hour] / 5) * (0.85 + rand() * 0.3))
      );
      for (let c = 0; c < countForHour; c++) {
        // Pick operator with slight affinity to peakBias
        let op = operators[Math.floor(rand() * operators.length)];
        if (rand() < 0.35) {
          const biased = operators.filter((o) => Math.abs(o.peakBias - hour) <= 1);
          if (biased.length > 0) {
            op = biased[Math.floor(rand() * biased.length)];
          }
        }

        const minute = Math.floor(rand() * 60);
        const second = Math.floor(rand() * 60);
        const waitSeconds = Math.round(8 + rand() * (hour >= 9 && hour <= 16 ? 58 : 22));
        const durationSec = Math.max(
          45,
          Math.round(op.baseTmaSec * (0.65 + rand() * 0.75))
        );

        const dataEntrada = new Date(
          dayDate.getFullYear(),
          dayDate.getMonth(),
          dayDate.getDate(),
          hour,
          minute,
          second
        );
        const dataAtendimento = new Date(dataEntrada.getTime() + waitSeconds * 1000);
        const dataEncerramento = new Date(dataAtendimento.getTime() + durationSec * 1000);

        const queue = queues[Math.floor(rand() * queues.length)];
        const cod = String(10400 + idx);
        const protocolo = `202610${pad2(dayDate.getDate())}${String(100000 + idx)}`;
        const ddd = ['11', '21', '31', '41', '51'][Math.floor(rand() * 5)];
        const numero = `(${ddd}) 9${Math.floor(8000 + rand() * 1999)}-${Math.floor(
          1000 + rand() * 8999
        )}`;

        records.push({
          id: `sample-${idx}`,
          cod,
          protocolo,
          numero,
          atendente: op.name,
          dataEntrada,
          dataEntradaRaw: formatDateTimeBR(dataEntrada),
          dataAtendimento,
          dataEncerramento,
          duracaoSeconds: durationSec,
          duracaoMinutes: durationSec / 60,
          duracaoFormatted: formatSecondsToMMSS(durationSec),
          esperaSeconds: waitSeconds,
          fila: queue,
          desligamento: disconnects[Math.floor(rand() * disconnects.length)],
          transfPesquisa: transfers[Math.floor(rand() * transfers.length)],
          uniqueId: `1760${idx}.${Math.floor(100 + rand() * 899)}`,
          entryHour: dataEntrada.getHours(),
          entryDateKey: formatDateToKey(dataEntrada),
        });
        idx++;
      }
    }
  }

  // Sort chronologically
  records.sort((a, b) => (a.dataEntrada?.getTime() || 0) - (b.dataEntrada?.getTime() || 0));

  return {
    records,
    metadata: {
      fileName: 'amostra_operacional_callcenter_out2026.xlsx',
      fileSize: 84210,
      sheetName: 'Atendimentos',
      totalRows: records.length,
      validDurationRows: records.length,
      validDateRows: records.length,
      importedAt: new Date(),
      warnings: [],
    },
  };
}

export function downloadSampleWorkbook(): void {
  const { records } = generateSampleRecords();
  const sheetData = records.map((r) => ({
    'Cod.': r.cod,
    Protocolo: r.protocolo,
    'Número': r.numero,
    Atendente: r.atendente,
    'Data da Entrada': formatDateTimeBR(r.dataEntrada),
    'Data do Atendimento': formatDateTimeBR(r.dataAtendimento),
    'Data do Encerramento': formatDateTimeBR(r.dataEncerramento),
    'Duraçãodo Atend.': r.duracaoSeconds !== null ? formatSecondsToHHMMSS(r.duracaoSeconds) : '',
    'Espera em Seg.': r.esperaSeconds ?? 0,
    'Fila de Atendimento': r.fila,
    Desligamento: r.desligamento,
    'Transf. Pesquisa': r.transfPesquisa,
    UniqueID: r.uniqueId,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'Atendimentos');
  XLSX.writeFile(wb, 'modelo_planilha_callcenter.xlsx');
}

function formatSecondsToHHMMSS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export function exportConsolidatedXLSX(
  summary: DashboardSummary,
  filters: FilterState,
  fileNameBase = 'relatorio_operacional_callcenter'
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumo Geral
  const resumoRows = [
    { Indicador: 'Período Inicial', Valor: filters.startDate || 'Todos' },
    { Indicador: 'Período Final', Valor: filters.endDate || 'Todos' },
    {
      Indicador: 'Fila de Atendimento',
      Valor: filters.selectedQueue === 'ALL' ? 'Todas' : filters.selectedQueue,
    },
    {
      Indicador: 'Operadores Selecionados',
      Valor:
        filters.selectedOperators.length === 0
          ? 'Todos os Operadores'
          : filters.selectedOperators.join(', '),
    },
    { Indicador: 'Total de Chamadas Atendidas', Valor: summary.totalCalls },
    { Indicador: 'Chamadas com Duração Válida', Valor: summary.validTmaCalls },
    {
      Indicador: 'TMA Médio (Minutos Decimais)',
      Valor: Number(summary.avgTmaMinutes.toFixed(2)),
    },
    { Indicador: 'TMA Médio (MM:SS)', Valor: summary.avgTmaFormatted },
    {
      Indicador: 'Horário de Pico',
      Valor: summary.peakAnalysis.peakHour
        ? `${summary.peakAnalysis.peakHour.rangeLabel} (${summary.peakAnalysis.peakHour.count} chamadas - ${summary.peakAnalysis.peakHour.percentage.toFixed(1)}%)`
        : '—',
    },
    {
      Indicador: 'Tempo Médio de Espera (Segundos)',
      Valor: Number(summary.avgWaitSeconds.toFixed(1)),
    },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo KPIs');

  // Sheet 2: Operadores
  const opRows = summary.operatorMetrics.map((op) => ({
    Operador: op.operator,
    'Qtd. Chamadas': op.callCount,
    'TMA (Minutos)': Number(op.tmaMinutes.toFixed(2)),
    'TMA (MM:SS)': op.tmaFormatted,
    'Horário de Pico Individual': op.peakHourLabel,
    'Chamadas no Pico Individual': op.peakHourCalls,
    'Espera Média (Seg.)': Number(op.avgWaitSeconds.toFixed(1)),
    'Espera Média (MM:SS)': op.avgWaitFormatted,
    'Participação (%)': Number(op.sharePercent.toFixed(2)),
  }));
  const wsOps = XLSX.utils.json_to_sheet(opRows);
  XLSX.utils.book_append_sheet(wb, wsOps, 'Por Operador');

  // Sheet 3: Curva Horária
  const hourRows = summary.hourlyBuckets.map((h) => ({
    'Faixa Horária': h.rangeLabel,
    Hora: h.label,
    'Qtd. Chamadas': h.count,
    'Participação (%)': Number(h.percentage.toFixed(2)),
    'TMA Médio (Minutos)': Number(h.avgTmaMinutes.toFixed(2)),
    Classificação: h.isPeak ? 'Horário de Pico' : h.isTop3 ? 'Top 3 Crítico' : h.isValley ? 'Vale' : 'Normal',
  }));
  const wsHours = XLSX.utils.json_to_sheet(hourRows);
  XLSX.utils.book_append_sheet(wb, wsHours, 'Curva Horária');

  XLSX.writeFile(wb, `${fileNameBase}.xlsx`);
}

export function exportConsolidatedCSV(
  summary: DashboardSummary,
  fileNameBase = 'relatorio_operadores_callcenter'
): void {
  const headers = [
    'Operador',
    'Qtd. Chamadas',
    'TMA (Minutos)',
    'TMA (MM:SS)',
    'Horário de Pico Individual',
    'Chamadas no Pico',
    'Espera Média (Seg.)',
    'Espera Média (MM:SS)',
    'Participação (%)',
  ];

  const lines = [
    headers.join(';'),
    ...summary.operatorMetrics.map((op) =>
      [
        `"${op.operator.replace(/"/g, '""')}"`,
        op.callCount,
        op.tmaMinutes.toFixed(2).replace('.', ','),
        op.tmaFormatted,
        op.peakHourLabel,
        op.peakHourCalls,
        op.avgWaitSeconds.toFixed(1).replace('.', ','),
        op.avgWaitFormatted,
        op.sharePercent.toFixed(2).replace('.', ','),
      ].join(';')
    ),
  ];

  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileNameBase}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
