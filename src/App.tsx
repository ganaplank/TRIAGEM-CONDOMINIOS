import { useState, useMemo } from 'react';
import { Search, Building2, User, CheckCircle2, Filter } from 'lucide-react';
import Fuse from 'fuse.js';
import { condominios, type Condominio } from './data/parser';
import { cn } from './lib/utils';

export default function App() {
  const [query, setQuery] = useState('');
  const [selectedNucleo, setSelectedNucleo] = useState('ALL');

  const fuse = useMemo(() => {
    return new Fuse(condominios, {
      keys: ['nome', 'codigo'],
      threshold: 0.3,
      ignoreLocation: true,
    });
  }, []);

  const results = useMemo(() => {
    let baseResults = [];
    
    if (!query.trim()) {
      baseResults = condominios;
    } else {
      baseResults = fuse.search(query).map(result => result.item);
    }

    if (selectedNucleo !== 'ALL') {
      baseResults = baseResults.filter(c => c.nucleo === selectedNucleo);
    }

    // Limit results if no query and no filter to avoid rendering too many items
    if (!query.trim() && selectedNucleo === 'ALL') {
      return baseResults.slice(0, 10);
    }

    return baseResults;
  }, [query, selectedNucleo, fuse]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <header className="space-y-2 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
            Triagem de Condomínios
          </h1>
          <p className="text-gray-500">
            Digite o nome ou código do condomínio para descobrir o responsável.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg transition-shadow"
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
