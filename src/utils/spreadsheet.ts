import * as XLSX from 'xlsx';
import type {AttendanceRecord, ParsedWorkbookResult, Segment} from '../types/operations';

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const COLUMN_ALIASES = {
  entryTime: [
    'horario de entrada',
    'horario da entrada',
    'hora de entrada',
    'hora da entrada',
    'horario entrada',
    'hora entrada',
    'horario',
    'hora',
    'inicio',
  ],
  attendanceDate: [
    'data da entrada',
    'data de entrada',
    'data entrada',
    'data do atendimento',
    'data atendimento',
    'data contato',
    'data do contato',
    'data',
  ],
  closingDate: [
    'data do encerramento',
    'data encerramento',
    'data de encerramento',
    'encerramento',
    'data fim',
    'data final',
  ],
  duration: [
    'duracao',
    'tempo de atendimento',
    'tempo atendimento',
    'tma',
    'tempo',
    'duracao atendimento',
  ],
  agent: ['atendente', 'operador', 'agente', 'consultor', 'responsavel', 'colaborador'],
  customerNumber: [
    'numero',
    'numero do cliente',
    'numero cliente',
    'telefone',
    'celular',
    'contato',
    'fone',
  ],
  protocol: ['protocolo', 'id atendimento', 'ticket', 'chamado', 'codigo'],
  queue: ['fila de atendimento', 'fila atendimento', 'fila', 'skill', 'departamento', 'grupo'],
  disconnectReason: [
    'desligamento',
    'deligamento',
    'quem desligou',
    'motivo desligamento',
    'encerrado por',
    'finalizacao',
  ],
  surveyTransfer: [
    'transferencia para pesquisa',
    'transferencia pesquisa',
    'transf pesquisa',
    'pesquisa',
    'ura pesquisa',
    'pesquisa satisfacao',
  ],
  chatbotSource: [
    'chatbot',
    'origem chatbot',
    'origem',
    'canal',
    'canal de entrada',
    'plataforma',
    'origem cliente',
  ],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

function buildHeaderMap(headers: string[]): Partial<Record<ColumnKey, string>> {
  const map: Partial<Record<ColumnKey, string>> = {};
  const usedRawHeaders = new Set<string>();
  const normalizedHeaders = headers.map((h) => ({raw: h, norm: normalizeHeader(h)}));

  const isAllowedForKey = (key: ColumnKey, norm: string): boolean => {
    if (key === 'entryTime' && norm.startsWith('data')) return false;
    if (
      key === 'attendanceDate' &&
      (norm.includes('encerramento') || norm.includes('fim') || norm.includes('final'))
    ) {
      return false;
    }
    return true;
  };

  (Object.keys(COLUMN_ALIASES) as ColumnKey[]).forEach((key) => {
    const aliases = COLUMN_ALIASES[key];
    // Exact normalized match first
    for (const alias of aliases) {
      const found = normalizedHeaders.find(
        (h) => !usedRawHeaders.has(h.raw) && h.norm === alias && isAllowedForKey(key, h.norm),
      );
      if (found) {
        map[key] = found.raw;
        usedRawHeaders.add(found.raw);
        return;
      }
    }
    // Partial substring match second
    for (const alias of aliases) {
      const found = normalizedHeaders.find(
        (h) =>
          !usedRawHeaders.has(h.raw) &&
          isAllowedForKey(key, h.norm) &&
          (h.norm.includes(alias) || (alias.length >= 5 && alias.includes(h.norm) && h.norm.length >= 4)),
      );
      if (found) {
        map[key] = found.raw;
        usedRawHeaders.add(found.raw);
        return;
      }
    }
  });

  return map;
}

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function parseExcelSerialDate(serial: number): {iso: string; display: string} | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 90000) return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return null;
  const iso = `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
  const display = `${pad2(parsed.d)}/${pad2(parsed.m)}/${parsed.y}`;
  return {iso, display};
}

function parseDateValue(val: unknown): {iso: string; display: string} {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = val.getMonth() + 1;
    const d = val.getDate();
    return {
      iso: `${y}-${pad2(m)}-${pad2(d)}`,
      display: `${pad2(d)}/${pad2(m)}/${y}`,
    };
  }

  if (typeof val === 'number') {
    const fromSerial = parseExcelSerialDate(val);
    if (fromSerial) return fromSerial;
  }

  const str = String(val ?? '').trim();
  if (!str) return {iso: '', display: '-'};

  // Handle combined datetime strings like "22/11/2026 09:15:00"
  const datePart = str.split(/[T\s]+/)[0];

  // DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
  const brMatch = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (brMatch) {
    const d = Number(brMatch[1]);
    const m = Number(brMatch[2]);
    let y = Number(brMatch[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return {
        iso: `${y}-${pad2(m)}-${pad2(d)}`,
        display: `${pad2(d)}/${pad2(m)}/${y}`,
      };
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return {
      iso: `${y}-${pad2(m)}-${pad2(d)}`,
      display: `${pad2(d)}/${pad2(m)}/${y}`,
    };
  }

  // Fallback native Date
  const native = new Date(str);
  if (!Number.isNaN(native.getTime())) {
    const y = native.getFullYear();
    const m = native.getMonth() + 1;
    const d = native.getDate();
    return {
      iso: `${y}-${pad2(m)}-${pad2(d)}`,
      display: `${pad2(d)}/${pad2(m)}/${y}`,
    };
  }

  return {iso: str, display: str};
}

function parseTimeOfDay(val: unknown): {hour: number; minute: number; second: number; formatted: string} | null {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const hour = val.getHours();
    const minute = val.getMinutes();
    const second = val.getSeconds();
    return {hour, minute, second, formatted: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`};
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    const frac = val >= 1 ? val - Math.floor(val) : val;
    if (frac >= 0 && frac < 1) {
      const totalSeconds = Math.round(frac * 86400) % 86400;
      const hour = Math.floor(totalSeconds / 3600);
      const minute = Math.floor((totalSeconds % 3600) / 60);
      const second = totalSeconds % 60;
      return {hour, minute, second, formatted: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`};
    }
  }

  const str = String(val ?? '').trim();
  if (!str) return null;

  // Match HH:MM:SS or HH:MM (optionally inside a datetime string)
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hour = Math.min(23, Math.max(0, Number(timeMatch[1])));
    const minute = Math.min(59, Math.max(0, Number(timeMatch[2])));
    const second = Math.min(59, Math.max(0, Number(timeMatch[3] ?? 0)));
    return {hour, minute, second, formatted: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`};
  }

  // Match "14h30" or "14h"
  const hMatch = str.match(/^(\d{1,2})h(\d{2})?$/i);
  if (hMatch) {
    const hour = Math.min(23, Math.max(0, Number(hMatch[1])));
    const minute = Math.min(59, Math.max(0, Number(hMatch[2] ?? 0)));
    return {hour, minute, second: 0, formatted: `${pad2(hour)}:${pad2(minute)}:00`};
  }

  return null;
}

function parseDurationSeconds(val: unknown): number {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.getHours() * 3600 + val.getMinutes() * 60 + val.getSeconds();
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    if (val <= 0) return 0;
    // Excel serial time fraction (< 1 day)
    if (val < 1) return Math.round(val * 86400);
    // Otherwise numeric seconds
    return Math.round(val);
  }

  const str = String(val ?? '').trim();
  if (!str) return 0;

  // HH:MM:SS
  const hms = str.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hms) {
    return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  }

  // MM:SS
  const ms = str.match(/^(\d+):(\d{1,2})$/);
  if (ms) {
    return Number(ms[1]) * 60 + Number(ms[2]);
  }

  // Text like "5m 40s" or "1h 02m 10s"
  const textMatch = str.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s)?/i);
  if (textMatch && (textMatch[1] || textMatch[2] || textMatch[3])) {
    const h = Number(textMatch[1] ?? 0);
    const m = Number(textMatch[2] ?? 0);
    const s = Number(textMatch[3] ?? 0);
    return h * 3600 + m * 60 + s;
  }

  // Numeric string (e.g. "340" or "5,5")
  const numeric = Number(str.replace(',', '.'));
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.round(numeric);
  }

  return 0;
}

export function formatSecondsToClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }
  return `${pad2(m)}:${pad2(s)}`;
}

function parseSheetRows(
  sheet: XLSX.WorkSheet,
  segment: Segment,
  sheetName: string,
): {records: AttendanceRecord[]; warnings: string[]} {
  const warnings: string[] = [];
  // Read both formatted strings and raw numbers so we never lose Excel serial precision
  const formattedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: '',
  });
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: '',
  });

  if (formattedRows.length === 0) {
    warnings.push(`A aba "${sheetName}" está vazia.`);
    return {records: [], warnings};
  }

  const headers = Object.keys(formattedRows[0]);
  const colMap = buildHeaderMap(headers);

  if (!colMap.entryTime) {
    warnings.push(`Aba "${sheetName}": coluna "HORARIO DE ENTRADA" não encontrada automaticamente.`);
  }
  if (!colMap.attendanceDate) {
    warnings.push(`Aba "${sheetName}": coluna "DATA DA ENTRADA" não encontrada automaticamente.`);
  }
  if (!colMap.duration) {
    warnings.push(`Aba "${sheetName}": coluna "DURAÇÃO" não encontrada automaticamente.`);
  }

  const records: AttendanceRecord[] = [];

  for (let i = 0; i < formattedRows.length; i++) {
    const fmtRow = formattedRows[i];
    const rawRow = rawRows[i] ?? fmtRow;

    const getVal = (key: ColumnKey): {fmt: unknown; raw: unknown} => {
      const col = colMap[key];
      if (!col) return {fmt: '', raw: ''};
      return {fmt: fmtRow[col], raw: rawRow[col]};
    };

    const entryTimeVal = getVal('entryTime');
    const attDateVal = getVal('attendanceDate');
    const closeDateVal = getVal('closingDate');
    const durationVal = getVal('duration');
    const agentVal = getVal('agent');
    const numVal = getVal('customerNumber');
    const protocolVal = getVal('protocol');
    const queueVal = getVal('queue');
    const disconnectVal = getVal('disconnectReason');
    const surveyVal = getVal('surveyTransfer');
    const chatbotVal = getVal('chatbotSource');

    // Skip completely blank lines
    const hasAnyContent = [
      entryTimeVal.fmt,
      attDateVal.fmt,
      durationVal.fmt,
      agentVal.fmt,
      protocolVal.fmt,
    ].some((v) => String(v ?? '').trim() !== '');

    if (!hasAnyContent) continue;

    // Parse time (prefer raw if numeric serial, else formatted, then fallback to DATA DA ENTRADA if datetime)
    const parsedTime =
      (typeof entryTimeVal.raw === 'number' ? parseTimeOfDay(entryTimeVal.raw) : null) ??
      parseTimeOfDay(entryTimeVal.fmt) ??
      (typeof attDateVal.raw === 'number' && attDateVal.raw % 1 !== 0
        ? parseTimeOfDay(attDateVal.raw)
        : null) ??
      parseTimeOfDay(attDateVal.fmt) ??
      {hour: 0, minute: 0, second: 0, formatted: '00:00:00'};

    const parsedAttDate =
      (typeof attDateVal.raw === 'number' ? parseDateValue(attDateVal.raw) : null) ??
      parseDateValue(attDateVal.fmt);

    const parsedCloseDate =
      (typeof closeDateVal.raw === 'number' ? parseDateValue(closeDateVal.raw) : null) ??
      parseDateValue(closeDateVal.fmt);

    // Parse duration: prefer formatted string when it contains ":" (e.g. "00:05:42"), otherwise raw Excel serial
    const fmtDurStr = String(durationVal.fmt ?? '').trim();
    const durationSeconds = fmtDurStr.includes(':')
      ? parseDurationSeconds(fmtDurStr)
      : typeof durationVal.raw === 'number'
        ? parseDurationSeconds(durationVal.raw)
        : parseDurationSeconds(fmtDurStr);

    const agent = String(agentVal.fmt ?? '').trim() || 'Não informado';
    const customerNumber = String(numVal.fmt ?? '').trim() || '-';
    const protocol = String(protocolVal.fmt ?? '').trim() || `${segment.toUpperCase()}-${i + 1}`;
    const queue = String(queueVal.fmt ?? '').trim() || 'Geral';
    const disconnectReason = String(disconnectVal.fmt ?? '').trim() || 'Não informado';

    const record: AttendanceRecord = {
      id: `${segment}-${i + 1}-${protocol}`,
      segment,
      entryTimeRaw: String(entryTimeVal.fmt ?? ''),
      entryHour: parsedTime.hour,
      entryMinute: parsedTime.minute,
      entryTimeFormatted: parsedTime.formatted,
      attendanceDate: parsedAttDate.iso || 'Sem data',
      attendanceDateDisplay: parsedAttDate.display,
      closingDateDisplay: parsedCloseDate.display,
      durationSeconds,
      durationFormatted: formatSecondsToClock(durationSeconds),
      agent,
      customerNumber,
      protocol,
      queue,
      disconnectReason,
    };

    if (segment === 'voice') {
      record.surveyTransfer = String(surveyVal.fmt ?? '').trim() || 'Não informado';
    } else {
      record.chatbotSource = String(chatbotVal.fmt ?? '').trim() || 'Não informado';
    }

    records.push(record);
  }

  return {records, warnings};
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedWorkbookResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {type: 'array', cellDates: false});

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('A planilha não possui nenhuma aba legível.');
  }

  // Locate VOICE and CHAT sheets by name first, then fall back to Tab 1 = VOICE, Tab 2 = CHAT
  const findByKeyword = (keyword: string, exclude?: string) =>
    sheetNames.find(
      (name) => name !== exclude && normalizeHeader(name).includes(keyword),
    );

  let voiceSheetName = findByKeyword('voice') ?? findByKeyword('voz') ?? findByKeyword('ligac');
  let chatSheetName = findByKeyword('chat', voiceSheetName);

  if (!voiceSheetName && sheetNames.length >= 1) {
    voiceSheetName = sheetNames[0] !== chatSheetName ? sheetNames[0] : undefined;
  }
  if (!chatSheetName && sheetNames.length >= 2) {
    chatSheetName = sheetNames.find((n) => n !== voiceSheetName);
  }

  const allRecords: AttendanceRecord[] = [];
  const warnings: string[] = [];
  let voiceCount = 0;
  let chatCount = 0;

  if (voiceSheetName && workbook.Sheets[voiceSheetName]) {
    const parsedVoice = parseSheetRows(workbook.Sheets[voiceSheetName], 'voice', voiceSheetName);
    allRecords.push(...parsedVoice.records);
    voiceCount = parsedVoice.records.length;
    warnings.push(...parsedVoice.warnings);
  }

  if (chatSheetName && workbook.Sheets[chatSheetName]) {
    const parsedChat = parseSheetRows(workbook.Sheets[chatSheetName], 'chat', chatSheetName);
    allRecords.push(...parsedChat.records);
    chatCount = parsedChat.records.length;
    warnings.push(...parsedChat.warnings);
  }

  if (allRecords.length === 0) {
    throw new Error(
      'Nenhum registro válido foi encontrado. Verifique se as abas VOICE e CHAT possuem cabeçalhos na primeira linha.',
    );
  }

  return {
    fileName: file.name,
    records: allRecords,
    voiceCount,
    chatCount,
    detectedSheets: {
      voice: voiceSheetName,
      chat: chatSheetName,
    },
    warnings,
    isSample: false,
  };
}

// Deterministic pseudo-random generator for clean, reproducible example spreadsheet
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSampleRawSheets(): {
  voiceRows: Record<string, string>[];
  chatRows: Record<string, string>[];
} {
  const rand = mulberry32(20261122);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const dates = [
    {iso: '2026-11-16', br: '16/11/2026'},
    {iso: '2026-11-17', br: '17/11/2026'},
    {iso: '2026-11-18', br: '18/11/2026'},
    {iso: '2026-11-19', br: '19/11/2026'},
    {iso: '2026-11-20', br: '20/11/2026'},
  ];

  const voiceAgents = [
    'Ana Paula Costa',
    'Bruno Henrique',
    'Camila Ferreira',
    'Diego Almeida',
    'Eduarda Lima',
    'Felipe Souza',
  ];
  const chatAgents = [
    'Gabriela Martins',
    'Henrique Rocha',
    'Isabela Ribeiro',
    'João Pedro Nunes',
    'Camila Ferreira',
    'Lucas Barbosa',
  ];

  const voiceQueues = ['Suporte N1', 'Financeiro', 'Retenção', 'Vendas'];
  const chatQueues = ['Suporte Digital', 'Dúvidas Produto', 'Financeiro Chat', 'Pós-Venda'];
  const disconnects = ['Cliente', 'Atendente', 'Sistema / Queda'];
  const surveyOptions = ['Sim', 'Sim', 'Sim', 'Não', 'Não'];
  const chatbotOrigins = ['WhatsApp', 'WhatsApp', 'Site do Produto', 'Site do Produto', 'WhatsApp'];

  // Weighted hourly profile simulating realistic morning (10h-11h) and afternoon (14h-16h) peaks
  const hourWeights: {hour: number; weight: number; tmaFactor: number}[] = [
    {hour: 7, weight: 2, tmaFactor: 0.78},
    {hour: 8, weight: 6, tmaFactor: 0.86},
    {hour: 9, weight: 12, tmaFactor: 0.96},
    {hour: 10, weight: 22, tmaFactor: 1.24}, // Morning peak
    {hour: 11, weight: 19, tmaFactor: 1.18},
    {hour: 12, weight: 10, tmaFactor: 0.94},
    {hour: 13, weight: 11, tmaFactor: 0.98},
    {hour: 14, weight: 24, tmaFactor: 1.32}, // Afternoon major peak
    {hour: 15, weight: 21, tmaFactor: 1.25},
    {hour: 16, weight: 15, tmaFactor: 1.08},
    {hour: 17, weight: 11, tmaFactor: 0.96},
    {hour: 18, weight: 7, tmaFactor: 0.88},
    {hour: 19, weight: 4, tmaFactor: 0.82},
    {hour: 20, weight: 2, tmaFactor: 0.75},
  ];

  const weightedHours: number[] = [];
  const tmaFactorByHour = new Map<number, number>();
  for (const hw of hourWeights) {
    tmaFactorByHour.set(hw.hour, hw.tmaFactor);
    for (let k = 0; k < hw.weight; k++) weightedHours.push(hw.hour);
  }

  const formatPhone = () => {
    const ddd = pick(['11', '21', '31', '41', '51', '81']);
    const p1 = Math.floor(90000 + rand() * 9999);
    const p2 = Math.floor(1000 + rand() * 8999);
    return `(${ddd}) ${p1}-${p2}`;
  };

  const voiceRows: Record<string, string>[] = [];
  const chatRows: Record<string, string>[] = [];

  for (let i = 0; i < 240; i++) {
    const dateObj = pick(dates);
    const hour = pick(weightedHours);
    const min = Math.floor(rand() * 60);
    const sec = Math.floor(rand() * 60);
    const tmaFactor = tmaFactorByHour.get(hour) ?? 1;
    const baseDuration = 190 + rand() * 260; // ~3m to ~7.5m
    const durSec = Math.round(baseDuration * tmaFactor);
    const hDur = Math.floor(durSec / 3600);
    const mDur = Math.floor((durSec % 3600) / 60);
    const sDur = durSec % 60;

    voiceRows.push({
      'HORARIO DE ENTRADA': `${pad2(hour)}:${pad2(min)}:${pad2(sec)}`,
      'DATA DA ENTRADA': dateObj.br,
      'DATA DO ENCERRAMENTO': dateObj.br,
      DURAÇÃO: `${pad2(hDur)}:${pad2(mDur)}:${pad2(sDur)}`,
      ATENDENTE: pick(voiceAgents),
      NÚMERO: formatPhone(),
      PROTOCOLO: `202611${pad2(hour)}${String(1000 + i)}`,
      'FILA DE ATENDIMENTO': pick(voiceQueues),
      DELIGAMENTO: pick(disconnects),
      'TRANSFERENCIA PARA PESQUISA': pick(surveyOptions),
    });
  }

  for (let i = 0; i < 210; i++) {
    const dateObj = pick(dates);
    const hour = pick(weightedHours);
    const min = Math.floor(rand() * 60);
    const sec = Math.floor(rand() * 60);
    const tmaFactor = tmaFactorByHour.get(hour) ?? 1;
    const chatbot = pick(chatbotOrigins);
    const channelFactor = chatbot === 'Site do Produto' ? 0.88 : 1.12;
    const baseDuration = 280 + rand() * 340; // Chats tend to be slightly longer
    const durSec = Math.round(baseDuration * tmaFactor * channelFactor);
    const hDur = Math.floor(durSec / 3600);
    const mDur = Math.floor((durSec % 3600) / 60);
    const sDur = durSec % 60;

    chatRows.push({
      'HORARIO DE ENTRADA': `${pad2(hour)}:${pad2(min)}:${pad2(sec)}`,
      'DATA DA ENTRADA': dateObj.br,
      'DATA DO ENCERRAMENTO': dateObj.br,
      DURAÇÃO: `${pad2(hDur)}:${pad2(mDur)}:${pad2(sDur)}`,
      ATENDENTE: pick(chatAgents),
      NÚMERO: formatPhone(),
      PROTOCOLO: `CH2026${pad2(hour)}${String(5000 + i)}`,
      'FILA DE ATENDIMENTO': pick(chatQueues),
      DELIGAMENTO: pick(disconnects),
      CHATBOT: chatbot,
    });
  }

  return {voiceRows, chatRows};
}

export function generateSampleWorkbookResult(): ParsedWorkbookResult {
  const {voiceRows, chatRows} = buildSampleRawSheets();
  const wb = XLSX.utils.book_new();
  const wsVoice = XLSX.utils.json_to_sheet(voiceRows);
  const wsChat = XLSX.utils.json_to_sheet(chatRows);
  XLSX.utils.book_append_sheet(wb, wsVoice, 'VOICE');
  XLSX.utils.book_append_sheet(wb, wsChat, 'CHAT');

  const parsedVoice = parseSheetRows(wsVoice, 'voice', 'VOICE');
  const parsedChat = parseSheetRows(wsChat, 'chat', 'CHAT');

  return {
    fileName: 'planilha_exemplo_voice_chat.xlsx',
    records: [...parsedVoice.records, ...parsedChat.records],
    voiceCount: parsedVoice.records.length,
    chatCount: parsedChat.records.length,
    detectedSheets: {voice: 'VOICE', chat: 'CHAT'},
    warnings: [],
    isSample: true,
  };
}

export function downloadTemplateWorkbook(): void {
  const {voiceRows, chatRows} = buildSampleRawSheets();
  const wb = XLSX.utils.book_new();
  const wsVoice = XLSX.utils.json_to_sheet(voiceRows);
  const wsChat = XLSX.utils.json_to_sheet(chatRows);

  wsVoice['!cols'] = [
    {wch: 20},
    {wch: 20},
    {wch: 22},
    {wch: 12},
    {wch: 22},
    {wch: 18},
    {wch: 18},
    {wch: 22},
    {wch: 18},
    {wch: 28},
  ];
  wsChat['!cols'] = [
    {wch: 20},
    {wch: 20},
    {wch: 22},
    {wch: 12},
    {wch: 22},
    {wch: 18},
    {wch: 18},
    {wch: 22},
    {wch: 18},
    {wch: 20},
  ];

  XLSX.utils.book_append_sheet(wb, wsVoice, 'VOICE');
  XLSX.utils.book_append_sheet(wb, wsChat, 'CHAT');
  XLSX.writeFile(wb, 'modelo_planilha_voice_chat.xlsx');
}

export function exportRecordsWorkbook(records: AttendanceRecord[], fileName = 'relatorio_tma_filtrado.xlsx'): void {
  const wb = XLSX.utils.book_new();
  const voiceRecords = records
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

  const chatRecords = records
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(voiceRecords), 'VOICE');
  }
  if (chatRecords.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chatRecords), 'CHAT');
  }
  XLSX.writeFile(wb, fileName);
}
