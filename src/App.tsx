import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Building2, User, CheckCircle2, Filter, Upload, X, Loader2 } from 'lucide-react';
import Fuse from 'fuse.js';
import Papa from 'papaparse';
import { condominios, type Condominio } from './data/parser';
import { cn } from './lib/utils';

export default function App() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedNucleo, setSelectedNucleo] = useState('ALL');
  const [dataList, setDataList] = useState<Condominio[]>(condominios);
  const [importMessage, setImportMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fuse = useMemo(() => {
    return new Fuse(dataList, {
      keys: ['nome', 'codigo'],
      threshold: 0.3,
      ignoreLocation: true,
    });
  }, [dataList]);

  const results = useMemo(() => {
    let baseResults = [];
    
    if (!debouncedQuery.trim()) {
      baseResults = dataList;
    } else {
      baseResults = fuse.search(debouncedQuery).map(result => result.item);
    }

    if (selectedNucleo !== 'ALL') {
      baseResults = baseResults.filter(c => c.nucleo === selectedNucleo);
    }

    // Limit results if no query and no filter to avoid rendering too many items
    if (!debouncedQuery.trim() && selectedNucleo === 'ALL') {
      return baseResults.slice(0, 10);
    }

    return baseResults;
  }, [debouncedQuery, selectedNucleo, fuse, dataList]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setImportMessage({ text, type });
    setTimeout(() => setImportMessage(null), 5000);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newRecords = results.data as any[];
        
        setDataList(prev => {
          const updatedList = [...prev];
          let added = 0;
          let updated = 0;
          
          newRecords.forEach(record => {
            // Normalize keys to lowercase to handle different CSV header formats
            const normalizedRecord: any = {};
            for (const key in record) {
              normalizedRecord[key.toLowerCase().trim()] = record[key];
            }

            const codigo = normalizedRecord.codigo || normalizedRecord['código'];
            const nome = normalizedRecord.nome || normalizedRecord['nome resumido'];
            const gerente = normalizedRecord.gerente || normalizedRecord['gerente atendimento'];
            const nucleo = normalizedRecord.nucleo || normalizedRecord['núcleo'] || normalizedRecord['nucleo nova estr.'];

            if (!codigo || !nome) return; // Skip invalid rows

            const nucleoStr = String(nucleo || '').trim();
            const responsavel = nucleoStr.toUpperCase().includes('MAURO') ? 'NATHAN' : 'VICTOR';

            const newCondominio: Condominio = {
              codigo: String(codigo).trim(),
              nome: String(nome).trim(),
              gerente: String(gerente || '').trim(),
              nucleo: nucleoStr,
              responsavel
            };

            const existingIndex = updatedList.findIndex(c => c.codigo === newCondominio.codigo);
            if (existingIndex >= 0) {
              updatedList[existingIndex] = newCondominio;
              updated++;
            } else {
              updatedList.push(newCondominio);
              added++;
            }
          });

          showMessage(`Importação concluída! ${added} adicionados, ${updated} atualizados.`, 'success');
          return updatedList;
        });
        
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        showMessage('Erro ao ler o arquivo CSV: ' + error.message, 'error');
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <header className="space-y-4 text-center relative">
          <div className="absolute right-0 top-0">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 shadow-sm transition-colors text-sm font-medium"
              title="Importar CSV com colunas: codigo, nome, gerente, nucleo"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Importar CSV</span>
            </button>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 pt-2">
            Triagem de Condomínios
          </h1>
          <p className="text-gray-500">
            Digite o nome ou código do condomínio para descobrir o responsável.
          </p>
        </header>

        {importMessage && (
          <div className={cn(
            "p-4 rounded-xl flex items-center justify-between shadow-sm border",
            importMessage.type === 'success' ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
          )}>
            <span>{importMessage.text}</span>
            <button onClick={() => setImportMessage(null)} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              {isSearching ? (
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              ) : (
                <Search className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <input
              type="text"
              className={cn(
                "block w-full pl-12 pr-4 py-4 bg-white border rounded-2xl shadow-sm focus:outline-none text-lg transition-all duration-300",
                isSearching 
                  ? "border-blue-400 ring-4 ring-blue-100" 
                  : "border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              )}
              placeholder="Ex: Residencial Flor, 124..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="relative sm:w-64 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={selectedNucleo}
              onChange={(e) => setSelectedNucleo(e.target.value)}
              className="block w-full pl-11 pr-10 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg transition-shadow appearance-none cursor-pointer"
            >
              <option value="ALL">Todos os Núcleos</option>
              <option value="ANDERSON">Anderson</option>
              <option value="MAURO RIBEIRO">Mauro Ribeiro</option>
              <option value="ADRIANO">Adriano</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {results.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-gray-500 text-lg">Nenhum condomínio encontrado.</p>
            </div>
          ) : (
            results.map((condominio) => (
              <div 
                key={condominio.codigo}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-md">
                      #{condominio.codigo}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      {condominio.nome}
                    </h2>
                  </div>
                  
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4" />
                    <span>Gerente: <strong>{condominio.gerente}</strong></span>
                    <span className="text-gray-400 text-sm ml-2">(Núcleo: {condominio.nucleo})</span>
                  </div>
                </div>

                <div className={cn(
                  "flex items-center gap-2 px-6 py-4 rounded-xl font-bold text-lg border-2",
                  condominio.responsavel === 'VICTOR' 
                    ? "bg-green-50 text-green-700 border-green-200" 
                    : "bg-blue-50 text-blue-700 border-blue-200"
                )}>
                  <CheckCircle2 className="w-6 h-6" />
                  RESPONSÁVEL: {condominio.responsavel}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
