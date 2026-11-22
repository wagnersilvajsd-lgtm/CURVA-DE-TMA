import React, {useMemo, useState} from 'react';
import {ChevronLeft, ChevronRight, Download, Search} from 'lucide-react';
import type {AttendanceRecord} from '../types/operations';
import {exportRecordsWorkbook} from '../utils/spreadsheet';

interface RecordsTableProps {
  records: AttendanceRecord[];
}

const PAGE_SIZE = 25;

export const RecordsTable: React.FC<RecordsTableProps> = ({records}) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'time' | 'duration'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? records.filter(
          (r) =>
            r.protocol.toLowerCase().includes(q) ||
            r.agent.toLowerCase().includes(q) ||
            r.customerNumber.toLowerCase().includes(q) ||
            r.queue.toLowerCase().includes(q) ||
            (r.chatbotSource ?? '').toLowerCase().includes(q),
        )
      : records;

    return [...list].sort((a, b) => {
      if (sortBy === 'duration') {
        return sortDir === 'asc'
          ? a.durationSeconds - b.durationSeconds
          : b.durationSeconds - a.durationSeconds;
      }
      const keyA = `${a.attendanceDate} ${a.entryTimeFormatted}`;
      const keyB = `${b.attendanceDate} ${b.entryTimeFormatted}`;
      return sortDir === 'asc' ? keyA.localeCompare(keyB) : keyB.localeCompare(keyA);
    });
  }, [records, query, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (col: 'time' | 'duration') => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Registros da Planilha
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
            {filtered.length} atendimento(s) correspondem aos filtros ativos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Protocolo, atendente, número, fila..."
              className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => exportRecordsWorkbook(filtered)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar (.xlsx)</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
              <th className="px-4 py-3 whitespace-nowrap">Segmento</th>
              <th className="px-4 py-3 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('time')}
                  className="hover:text-slate-900 cursor-pointer"
                >
                  Data · Entrada {sortBy === 'time' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="px-4 py-3 whitespace-nowrap">Encerramento</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('duration')}
                  className="hover:text-slate-900 cursor-pointer"
                >
                  Duração {sortBy === 'duration' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="px-4 py-3 whitespace-nowrap">Atendente</th>
              <th className="px-4 py-3 whitespace-nowrap">Número</th>
              <th className="px-4 py-3 whitespace-nowrap">Protocolo</th>
              <th className="px-4 py-3 whitespace-nowrap">Fila</th>
              <th className="px-4 py-3 whitespace-nowrap">Desligamento</th>
              <th className="px-4 py-3 whitespace-nowrap">Pesquisa / Chatbot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.id} className="h-10 hover:bg-slate-50/80">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">
                    <span className={row.segment === 'voice' ? 'text-blue-700' : 'text-teal-700'}>
                      {row.segment === 'voice' ? 'Voice' : 'Chat'}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                    {row.attendanceDateDisplay} · {row.entryTimeFormatted}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {row.closingDateDisplay}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                    {row.durationFormatted}
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-2 text-slate-900">{row.agent}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {row.customerNumber}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {row.protocol}
                  </td>
                  <td className="max-w-[150px] truncate px-4 py-2 text-slate-700">{row.queue}</td>
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{row.disconnectReason}</td>
                  <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                    {row.segment === 'voice'
                      ? `Pesquisa: ${row.surveyTransfer ?? '-'}`
                      : row.chatbotSource ?? '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600 tabular-nums">
          <span>
            Página {safePage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <span>Próxima</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
