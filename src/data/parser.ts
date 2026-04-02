import { rawData } from './raw-data';

export interface Condominio {
  codigo: string;
  nome: string;
  gerente: string;
  nucleo: string;
  responsavel: 'VICTOR' | 'NATHAN';
}

export function parseData(): Condominio[] {
  const lines = rawData.trim().split('\n');
  return lines.map(line => {
    let nucleo = '';
    if (line.endsWith('MAURO RIBEIRO')) {
      nucleo = 'MAURO RIBEIRO';
    } else if (line.endsWith('ANDERSON')) {
      nucleo = 'ANDERSON';
    } else if (line.endsWith('ADRIANO')) {
      nucleo = 'ADRIANO';
    }

    const withoutNucleo = line.substring(0, line.length - nucleo.length).trim();
    
    const knownGerentes = [
      'SHIRLEI SANTANA', 'FLAVIA CARMEN', 'ERASMO BEZERRA', 'DAYANE PAIVA',
      'MAURO RIBEIRO', 'ALINE VARGAS', 'ALESSANDRA PRADO', 'EDER SILVA',
      'LAIZ MIGUÉL', 'GISELE SOARES', 'ALEXANDRE DE MELO', 'JACQUELINE',
      'NINA CARLEN', 'ADRIANO AOKI'
    ];

    let gerente = '';
    for (const g of knownGerentes) {
      if (withoutNucleo.endsWith(g)) {
        gerente = g;
        break;
      }
    }

    const withoutGerente = withoutNucleo.substring(0, withoutNucleo.length - gerente.length).trim();
    
    const firstSpaceIndex = withoutGerente.indexOf(' ');
    const codigo = withoutGerente.substring(0, firstSpaceIndex);
    const nome = withoutGerente.substring(firstSpaceIndex + 1).trim();

    let responsavel: 'VICTOR' | 'NATHAN' = 'VICTOR';
    if (nucleo === 'MAURO RIBEIRO') {
      responsavel = 'NATHAN';
    } else if (nucleo === 'ANDERSON' || nucleo === 'ADRIANO') {
      responsavel = 'VICTOR';
    }

    return {
      codigo,
      nome,
      gerente,
      nucleo,
      responsavel
    };
  });
}

const parsedCondominios = parseData();

// Adicionando o Metrocasa Freguesia do Ó manualmente conforme solicitado
parsedCondominios.push({
  codigo: '555',
  nome: 'METROCASA FREGUESIA DO Ó',
  gerente: 'Sem Gerente',
  nucleo: 'Sem Núcleo',
  responsavel: 'NATHAN'
});

export const condominios = parsedCondominios;
