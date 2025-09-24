'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

const CHUNK_SIZE = 1000; // Process 1000 rows at a time

// Define a type for the data imported from the Excel sheet
interface ExcelRow {
  data_do_periodo?: string;
  periodo?: string;
  duracao_do_periodo?: number;
  numero_minimo_de_entregadores_regulares_na_escala?: number;
  tag?: string;
  id_da_pessoa_entregadora?: string;
  pessoa_entregadora?: string;
  praca?: string;
  sub_praca?: string;
  origem?: string;
  tempo_disponivel_escalado?: number;
  tempo_disponivel_absoluto?: number;
  numero_de_corridas_ofertadas?: number;
  numero_de_corridas_aceitas?: number;
  numero_de_corridas_rejeitadas?: number;
  numero_de_corridas_completadas?: number;
  numero_de_corridas_canceladas_pela_pessoa_entregadora?: number;
  numero_de_pedidos_aceitos_e_concluidos?: number;
  soma_das_taxas_das_corridas_aceitas?: number;
  [key: string]: string | number | undefined; // Allow other keys
}

export default function UploadForm({ onUploadSuccess }: { onUploadSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccess(null);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setProgress({ current: 0, total: 0 });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        const mappedData = (json as ExcelRow[]).map((row) => ({
          data_do_periodo: row['data_do_periodo'],
          periodo: row['periodo'],
          duracao_do_periodo: row['duracao_do_periodo'],
          numero_minimo_de_entregadores_regulares_na_escala: row['numero_minimo_de_entregadores_regulares_na_escala'],
          tag: row['tag'],
          id_da_pessoa_entregadora: row['id_da_pessoa_entregadora'],
          pessoa_entregadora: row['pessoa_entregadora'],
          praca: row['praca'],
          sub_praca: row['sub_praca'],
          origem: row['origem'],
          tempo_disponivel_escalado: row['tempo_disponivel_escalado'],
          tempo_disponivel_absoluto: row['tempo_disponivel_absoluto'],
          numero_de_corridas_ofertadas: row['numero_de_corridas_ofertadas'],
          numero_de_corridas_aceitas: row['numero_de_corridas_aceitas'],
          numero_de_corridas_rejeitadas: row['numero_de_corridas_rejeitadas'],
          numero_de_corridas_completadas: row['numero_de_corridas_completadas'],
          numero_de_corridas_canceladas_pela_pessoa_entregadora: row['numero_de_corridas_canceladas_pela_pessoa_entregadora'],
          numero_de_pedidos_aceitos_e_concluidos: row['numero_de_pedidos_aceitos_e_concluidos'],
          soma_das_taxas_das_corridas_aceitas: row['soma_das_taxas_das_corridas_aceitas'],
        }));

        const totalChunks = Math.ceil(mappedData.length / CHUNK_SIZE);
        setProgress({ current: 0, total: totalChunks });

        for (let i = 0; i < mappedData.length; i += CHUNK_SIZE) {
          const chunk = mappedData.slice(i, i + CHUNK_SIZE);
          const { error: uploadError } = await supabase.from('corridas').insert(chunk);

          if (uploadError) {
            throw new Error(`Erro no lote ${i / CHUNK_SIZE + 1}: ${uploadError.message}`);
          }
          setProgress({ current: i / CHUNK_SIZE + 1, total: totalChunks });
        }

        setSuccess(`Arquivo com ${mappedData.length} linhas importado com sucesso!`);
        onUploadSuccess(); // Refresh data on dashboard
      } catch (err) {
        const error = err as Error;
        setError(`Erro ao importar o arquivo: ${error.message}`);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const uploadProgress = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-8">
      <h3 className="text-lg font-semibold mb-4">Importar Planilha</h3>
      <div className="flex items-center space-x-4">
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-violet-50 file:text-violet-700
            hover:file:bg-violet-100"
        />
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="px-4 py-2 bg-violet-600 text-white rounded-full disabled:bg-gray-400 min-w-[110px]"
        >
          {uploading ? `Enviando...` : 'Importar'}
        </button>
      </div>
      
      {uploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-violet-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Enviando lote {progress.current} de {progress.total}... ({uploadProgress}%)
          </p>
        </div>
      )}

      {error && <p className="text-red-500 mt-2">{error}</p>}
      {success && <p className="text-green-500 mt-2">{success}</p>}
    </div>
  );
}
