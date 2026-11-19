import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  Upload,
} from 'lucide-react';

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  onLoadSample: () => void;
  onDownloadTemplate: () => void;
  isLoading: boolean;
  error: string | null;
  compact?: boolean;
}

const EXPECTED_COLUMNS = [
  'Cod.',
  'Protocolo',
  'Número',
  'Atendente',
  'Data da Entrada',
  'Data do Atendimento',
  'Data do Encerramento',
  'Duraçãodo Atend.',
  'Espera em Seg.',
  'Fila de Atendimento',
  'Desligamento',
  'Transf. Pesquisa',
  'UniqueID',
];

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFileSelect,
  onLoadSample,
  onDownloadTemplate,
  isLoading,
  error,
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndEmit = (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.csv')) {
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    validateAndEmit(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div className={compact ? 'w-full' : 'mx-auto max-w-4xl py-8'}>
      {!compact && (
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl text-balance">
            Análise Operacional de Call Center
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Importe planilhas de atendimento (.xlsx ou .csv) para calcular o TMA em minutos,
            mapear a curva horária e identificar horários de pico diretamente no navegador.
          </p>
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isLoading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Área de upload de planilha XLSX ou CSV"
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
          isDragging
            ? 'border-emerald-600 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            validateAndEmit(file);
            e.target.value = '';
          }}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Processando planilha no navegador...
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Convertendo datas seriais, durações em minutos e agrupamentos horários
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-emerald-600">
              {isDragging ? (
                <FileSpreadsheet className="h-6 w-6" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Arraste sua planilha aqui ou clique para selecionar
            </p>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Formatos aceitos: .xlsx e .csv · Processamento 100% local, sem envio para servidores
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Selecionar Arquivo
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadSample();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Carregar Dados de Exemplo
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadTemplate();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Download className="h-4 w-4" />
                Baixar Modelo (.xlsx)
              </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold">Não foi possível ler a planilha</p>
            <p className="mt-0.5 text-red-700 dark:text-red-300/90">{error}</p>
          </div>
        </div>
      )}

      {!compact && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Estrutura de Colunas Suportada
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Compatível com datas seriais do Excel e formato DD/MM/YYYY HH:mm:ss
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400 sm:grid-cols-3 md:grid-cols-4">
            {EXPECTED_COLUMNS.map((col, idx) => (
              <div key={col} className="flex items-center gap-2 py-0.5">
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                  {col}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
