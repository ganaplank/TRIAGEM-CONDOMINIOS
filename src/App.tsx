import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Building2, User, CheckCircle2, Filter, Upload, X, Loader2, ChevronRight, FileSpreadsheet, FileText, Download } from 'lucide-react';
import Fuse from 'fuse.js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { condominios, type Condominio } from './data/parser';
import { cn } from './lib/utils';

export default function App() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedNucleo, setSelectedNucleo] = useState('ALL');
  const [dataList, setDataList] = useState<Condominio[]>(condominios);
  const [importMessage, setImportMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const [selectedCondominio, setSelectedCondominio] = useState<Condominio | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportModal, setExportModal] = useState<{ isOpen: boolean, format: 'excel' | 'pdf' }>({ isOpen: false, format: 'excel' });
  const [exportMode, setExportMode] = useState<'ALL' | 'CURRENT' | 'NUCLEO' | 'RESPONSAVEL' | 'RANGE' | 'INDIVIDUAL'>('CURRENT');
  const [exportNucleo, setExportNucleo] = useState('ANDERSON');
  const [exportResponsavel, setExportResponsavel] = useState('VICTOR');
  const [exportRange, setExportRange] = useState({ start: 1, end: 10 });
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());
  const [exportSearch, setExportSearch] = useState('');

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

  const filteredData = useMemo(() => {
    let baseResults = [];
    
    if (!debouncedQuery.trim()) {
      baseResults = dataList;
    } else {
      baseResults = fuse.search(debouncedQuery).map(result => result.item);
    }

    if (selectedNucleo !== 'ALL') {
      baseResults = baseResults.filter(c => c.nucleo === selectedNucleo);
    }

    return baseResults;
  }, [debouncedQuery, selectedNucleo, fuse, dataList]);

  const displayedData = useMemo(() => {
    // Limit results if no query and no filter to avoid rendering too many items
    if (!debouncedQuery.trim() && selectedNucleo === 'ALL') {
      return filteredData.slice(0, 10);
    }
    return filteredData;
  }, [filteredData, debouncedQuery, selectedNucleo]);

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

  const getExportData = () => {
    switch (exportMode) {
      case 'ALL': return dataList;
      case 'CURRENT': return filteredData;
      case 'NUCLEO': return dataList.filter(c => c.nucleo === exportNucleo);
      case 'RESPONSAVEL': return dataList.filter(c => c.responsavel === exportResponsavel);
      case 'RANGE': return dataList.slice(Math.max(0, exportRange.start - 1), exportRange.end);
      case 'INDIVIDUAL': return dataList.filter(c => exportSelectedIds.has(c.codigo));
      default: return filteredData;
    }
  };

  const handleConfirmExport = () => {
    const dataToExport = getExportData();
    if (dataToExport.length === 0) {
      showMessage("Nenhum condomínio selecionado para exportação.", "error");
      return;
    }

    if (exportModal.format === 'excel') {
      exportToExcel(dataToExport);
    } else {
      exportToPDF(dataToExport);
    }
    setExportModal({ ...exportModal, isOpen: false });
  };

  const exportToExcel = (dataToExport: Condominio[]) => {
    const worksheet = XLSX.utils.json_to_sheet(dataToExport.map(c => ({
      'Código': c.codigo,
      'Nome do Condomínio': c.nome,
      'Gerente': c.gerente,
      'Núcleo': c.nucleo,
      'Responsável': c.responsavel
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Condominios");
    XLSX.writeFile(workbook, "triagem_condominios.xlsx");
    showMessage("Lista exportada para Excel com sucesso!", "success");
  };

  const exportToPDF = (dataToExport: Condominio[]) => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Relatório de Triagem de Condomínios", 14, 15);
    doc.setFontSize(10);
    doc.text(`Total de registros: ${dataToExport.length}`, 14, 22);
    
    const tableData = dataToExport.map(c => [
      c.codigo,
      c.nome,
      c.gerente,
      c.nucleo,
      c.responsavel
    ]);

    autoTable(doc, {
      head: [['Código', 'Nome', 'Gerente', 'Núcleo', 'Responsável']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246] }, // blue-500
      alternateRowStyles: { fillColor: [249, 250, 251] } // gray-50
    });

    doc.save("triagem_condominios.pdf");
    showMessage("Lista exportada para PDF com sucesso!", "success");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <header className="space-y-4 text-center relative">
          <div className="absolute right-0 top-0 flex items-center gap-2">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 shadow-sm transition-colors text-sm font-medium"
              title="Importar CSV com colunas: codigo, nome, gerente, nucleo"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Importar CSV</span>
            </button>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 pt-2 sm:pt-0">
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

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-2 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-500">
            {displayedData.length < filteredData.length 
              ? `Mostrando ${displayedData.length} de ${filteredData.length} condomínios`
              : `Mostrando ${filteredData.length} condomínio${filteredData.length !== 1 ? 's' : ''}`
            }
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setExportModal({ isOpen: true, format: 'excel' })}
              disabled={dataList.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar para Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button 
              onClick={() => setExportModal({ isOpen: true, format: 'pdf' })}
              disabled={dataList.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar para PDF"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {displayedData.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-gray-500 text-lg">Nenhum condomínio encontrado.</p>
            </div>
          ) : (
            displayedData.map((condominio) => (
              <div 
                key={condominio.codigo}
                onClick={() => setSelectedCondominio(condominio)}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-md">
                      #{condominio.codigo}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                      <Building2 className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      {condominio.nome}
                    </h2>
                  </div>
                  
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4" />
                    <span>Gerente: <strong>{condominio.gerente}</strong></span>
                    <span className="text-gray-400 text-sm ml-2 hidden sm:inline">(Núcleo: {condominio.nucleo})</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-4 rounded-xl font-bold text-sm sm:text-lg border-2",
                    condominio.responsavel === 'VICTOR' 
                      ? "bg-green-50 text-green-700 border-green-200" 
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  )}>
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="hidden sm:inline">RESPONSÁVEL:</span> {condominio.responsavel}
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Modal de Detalhes */}
      {selectedCondominio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCondominio(null)}>
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-lg mb-3 inline-block">
                    Código #{selectedCondominio.codigo}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-blue-500" />
                    {selectedCondominio.nome}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedCondominio(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors -mr-2 -mt-2"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="bg-white p-2 rounded-xl shadow-sm">
                    <User className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Gerente de Atendimento</p>
                    <p className="font-bold text-lg">{selectedCondominio.gerente}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="bg-white p-2 rounded-xl shadow-sm">
                    <Filter className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Núcleo</p>
                    <p className="font-bold text-lg">{selectedCondominio.nucleo}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-sm text-gray-500 font-medium mb-2 text-center">Responsável pela Triagem</p>
                <div className={cn(
                  "flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-xl border-2",
                  selectedCondominio.responsavel === 'VICTOR' 
                    ? "bg-green-50 text-green-700 border-green-200" 
                    : "bg-blue-50 text-blue-700 border-blue-200"
                )}>
                  <CheckCircle2 className="w-7 h-7" />
                  {selectedCondominio.responsavel}
                </div>
              </div>
              
              <button
                onClick={() => setSelectedCondominio(null)}
                className="w-full py-4 mt-2 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:bg-gray-800 transition-colors shadow-md hover:shadow-lg"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportação Avançada */}
      {exportModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setExportModal({ ...exportModal, isOpen: false })}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Download className="w-6 h-6 text-blue-500" />
                Exportar para {exportModal.format === 'excel' ? 'Excel' : 'PDF'}
              </h2>
              <button onClick={() => setExportModal({ ...exportModal, isOpen: false })} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={cn("border rounded-xl p-4 cursor-pointer flex items-start gap-3 transition-colors", exportMode === 'CURRENT' ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50 border-gray-200")}>
                  <input type="radio" name="exportMode" checked={exportMode === 'CURRENT'} onChange={() => setExportMode('CURRENT')} className="mt-1 w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-bold text-gray-900">Busca Atual</p>
                    <p className="text-sm text-gray-500">Exportar os {filteredData.length} itens filtrados na tela</p>
                  </div>
                </label>

                <label className={cn("border rounded-xl p-4 cursor-pointer flex items-start gap-3 transition-colors", exportMode === 'ALL' ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50 border-gray-200")}>
                  <input type="radio" name="exportMode" checked={exportMode === 'ALL'} onChange={() => setExportMode('ALL')} className="mt-1 w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-bold text-gray-900">Todos os Condomínios</p>
                    <p className="text-sm text-gray-500">Exportar toda a base ({dataList.length} itens)</p>
                  </div>
                </label>

                <label className={cn("border rounded-xl p-4 cursor-pointer flex items-start gap-3 transition-colors", exportMode === 'NUCLEO' ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50 border-gray-200")}>
                  <input type="radio" name="exportMode" checked={exportMode === 'NUCLEO'} onChange={() => setExportMode('NUCLEO')} className="mt-1 w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-bold text-gray-900">Por Núcleo</p>
                    <p className="text-sm text-gray-500">Selecione um núcleo específico</p>
                  </div>
                </label>

                <label className={cn("border rounded-xl p-4 cursor-pointer flex items-start gap-3 transition-colors", exportMode === 'RESPONSAVEL' ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50 border-gray-200")}>
                  <input type="radio" name="exportMode" checked={exportMode === 'RESPONSAVEL'} onChange={() => setExportMode('RESPONSAVEL')} className="mt-1 w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-bold text-gray-900">Por Responsável</p>
                    <p className="text-sm text-gray-500">Victor ou Nathan</p>
                  </div>
                </label>

                <label className={cn("border rounded-xl p-4 cursor-pointer flex items-start gap-3 transition-colors", exportMode === 'RANGE' ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50 border-gray-200")}>
                  <input type="radio" name="exportMode" checked={exportMode === 'RANGE'} onChange={() => setExportMode('RANGE')} className="mt-1 w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-bold text-gray-900">Por Intervalo</p>
                    <p className="text-sm text-gray-500">Ex: 1 ao 10</p>
                  </div>
                </label>

                <label className={cn("border rounded-xl p-4 cursor-pointer flex items-start gap-3 transition-colors", exportMode === 'INDIVIDUAL' ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50 border-gray-200")}>
                  <input type="radio" name="exportMode" checked={exportMode === 'INDIVIDUAL'} onChange={() => setExportMode('INDIVIDUAL')} className="mt-1 w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-bold text-gray-900">Seleção Individual</p>
                    <p className="text-sm text-gray-500">Escolha um a um ({exportSelectedIds.size} selecionados)</p>
                  </div>
                </label>
              </div>

              {/* Conditional Inputs */}
              {exportMode === 'NUCLEO' && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Selecione o Núcleo:</label>
                  <select value={exportNucleo} onChange={e => setExportNucleo(e.target.value)} className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500">
                    <option value="ANDERSON">Anderson</option>
                    <option value="MAURO RIBEIRO">Mauro Ribeiro</option>
                    <option value="ADRIANO">Adriano</option>
                    <option value="Sem Núcleo">Sem Núcleo</option>
                  </select>
                </div>
              )}

              {exportMode === 'RESPONSAVEL' && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Selecione o Responsável:</label>
                  <select value={exportResponsavel} onChange={e => setExportResponsavel(e.target.value)} className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500">
                    <option value="VICTOR">Victor</option>
                    <option value="NATHAN">Nathan</option>
                  </select>
                </div>
              )}

              {exportMode === 'RANGE' && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Do item:</label>
                    <input type="number" min="1" max={dataList.length} value={exportRange.start} onChange={e => setExportRange({...exportRange, start: parseInt(e.target.value) || 1})} className="w-full p-3 rounded-lg border border-gray-200" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Até o item:</label>
                    <input type="number" min="1" max={dataList.length} value={exportRange.end} onChange={e => setExportRange({...exportRange, end: parseInt(e.target.value) || 1})} className="w-full p-3 rounded-lg border border-gray-200" />
                  </div>
                </div>
              )}

              {exportMode === 'INDIVIDUAL' && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in flex flex-col h-64">
                  <input type="text" placeholder="Buscar condomínio para selecionar..." value={exportSearch} onChange={e => setExportSearch(e.target.value)} className="w-full p-3 rounded-lg border border-gray-200 mb-3" />
                  <div className="overflow-y-auto flex-1 space-y-1 bg-white rounded-lg border border-gray-200 p-2">
                    {dataList.filter(c => c.nome.toLowerCase().includes(exportSearch.toLowerCase()) || c.codigo.includes(exportSearch)).map(c => (
                      <label key={c.codigo} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={exportSelectedIds.has(c.codigo)} onChange={(e) => {
                          const newSet = new Set(exportSelectedIds);
                          if (e.target.checked) newSet.add(c.codigo);
                          else newSet.delete(c.codigo);
                          setExportSelectedIds(newSet);
                        }} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="font-medium text-gray-900 text-sm">#{c.codigo} - {c.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setExportModal({ ...exportModal, isOpen: false })} className="px-6 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleConfirmExport} className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md">
                <Download className="w-5 h-5" />
                Exportar {getExportData().length} itens
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
