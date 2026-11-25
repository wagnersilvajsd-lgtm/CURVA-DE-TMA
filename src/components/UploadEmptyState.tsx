import React, {useRef, useState} from 'react';
import {Download, FileSpreadsheet, Upload} from 'lucide-react';

interface UploadEmptyStateProps {
  onFileSelected: (file: File) => void;
  onDownloadTemplate: () => void;
  onLoadSample: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

const VOICE_COLUMNS = [
  'HORARIO DE ENTRADA',
  'DATA DA ENTRADA',
  'DATA DO ENCERRAMENTO',
  'DURAÇÃO',
  'ATENDENTE',
  'NÚMERO (Cliente)',
  'PROTOCOLO',
  'FILA DE ATENDIMENTO',
  'DESLIGAMENTO / DELIGAMENTO',
  'TRANSFERENCIA PARA PESQUISA',
];

const CHAT_COLUMNS = [
  'HORARIO DE ENTRADA',
  'DATA DA ENTRADA',
  'DATA DO ENCERRAMENTO',
  'DURAÇÃO',
  'ATENDENTE',
  'NÚMERO (Cliente)',
  'PROTOCOLO',
  'FILA DE ATENDIMENTO',
  'DESLIGAMENTO / DELIGAMENTO',
  'CHATBOT (Site do Produto / WhatsApp)',
];

export const UploadEmptyState: React.FC<UploadEmptyStateProps> = ({
  onFileSelected,
  onDownloadTemplate,
  onLoadSample,
  isLoading,
  errorMessage,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div className="mx-auto max-w-5xl py-6">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
          Curva de TMA e Picos de Fluxo
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Carregue sua planilha externa com as abas <strong className="font-semibold text-slate-900">VOICE</strong> e{' '}
          <strong className="font-semibold text-slate-900">CHAT</strong> para identificar automaticamente os horários de
          maior volume, oscilações de TMA e a média de atendimentos por operador.
        </p>
      </div>

      {/* Dropzone Container */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border bg-white p-8 transition-colors ${
          isDragging ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
            e.target.value = '';
          }}
        />

        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-700">
            <FileSpreadsheet className="h-6 w-6" />
          </div>

          <h2 className="mt-4 font-display text-lg font-semibold text-slate-900">
            {isLoading ? 'Processando planilha...' : 'Arraste sua planilha aqui ou selecione o arquivo'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Formatos suportados: .xlsx, .xls, .xlsm · Leitura local no navegador (nenhum dado é enviado para terceiros)
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mt-4 w-full max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-xs font-medium text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>Selecionar Planilha</span>
            </button>

            <button
              type="button"
              onClick={onDownloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Baixar Modelo (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex items-center gap-2 rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Explorar com Planilha de Exemplo</span>
            </button>
          </div>
        </div>

        {/* Clean Two-Column Expected Structure */}
        <div className="mt-8 border-t border-slate-200 pt-6">
          <p className="text-xs font-semibold text-slate-700">Estrutura esperada nas duas abas da planilha</p>
          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                <h3 className="font-display text-sm font-semibold text-slate-900">1ª Aba: VOICE</h3>
                <span className="text-xs text-slate-500">10 colunas</span>
              </div>
              <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                {VOICE_COLUMNS.map((col, idx) => (
                  <li key={col} className="truncate font-mono text-[11px] text-slate-700">
                    {idx + 1}. {col}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                <h3 className="font-display text-sm font-semibold text-slate-900">2ª Aba: CHAT</h3>
                <span className="text-xs text-slate-500">10 colunas</span>
              </div>
              <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                {CHAT_COLUMNS.map((col, idx) => (
                  <li key={col} className="truncate font-mono text-[11px] text-slate-700">
                    {idx + 1}. {col}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
