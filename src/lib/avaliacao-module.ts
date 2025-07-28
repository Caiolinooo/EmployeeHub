/**
 * Utilitário para inicializar e gerenciar o módulo de avaliação de desempenho
 */

// Variável para armazenar a instância inicializada do módulo
let avaliacaoModule: any = null;

/**
 * Inicializa o módulo de avaliação de desempenho se ainda não estiver inicializado
 * @returns A instância inicializada do módulo
 */
export async function initAvaliacaoModule() {
  if (!avaliacaoModule) {
    try {
      console.log('Inicializando módulo de avaliação de desempenho...');

      let avaliacaoDesempenho: any;
      try {
        avaliacaoDesempenho = await import('../../avaliacao-desempenho/src/index');
      } catch (error) {
        console.warn('Erro ao importar módulo de avaliação de desempenho, usando stub:', error);
        avaliacaoDesempenho = null;
      }

      // Criar um stub básico para o módulo
      const createStub = () => {
        return {
          version: '0.1.0-stub',
          name: 'avaliacao-desempenho-stub',
          getStatus: () => ({ status: 'online', mode: 'stub' }),
          getAvaliacoes: async () => [],
          getAvaliacao: async (id: any) => null,
          getAvaliacoesByFuncionario: async (funcionarioId: any) => [],
          createAvaliacao: async (data: any) => ({ id: 1, ...data }),
          updateAvaliacao: async (id: any, data: any) => ({ id, ...data }),
          deleteAvaliacao: async (id: any) => true,
          getFuncionarios: async () => [],
          getFuncionario: async (id: any) => null,
          getCriterios: async () => [],
          getCriterio: async (id: any) => null,
          getCriteriosByCategoria: async (categoria: string) => []
        };
      };

      // Verificar se o módulo existe
      if (!avaliacaoDesempenho || typeof avaliacaoDesempenho.init !== 'function') {
        console.warn('Módulo de avaliação não encontrado ou método init não disponível. Usando stub.');
        // Usar o stub básico
        avaliacaoModule = createStub();
        console.log('Stub do módulo de avaliação criado com sucesso!');
        return avaliacaoModule;
      }

      // Tentar inicializar o módulo real
      try {
        avaliacaoModule = await avaliacaoDesempenho.init();
        console.log('Módulo de avaliação de desempenho inicializado com sucesso!');
      } catch (initError) {
        console.error('Erro ao inicializar módulo de avaliação de desempenho:', initError);
        // Em caso de erro, criar um stub básico para o módulo
        console.warn('Criando stub do módulo de avaliação devido a erro de inicialização.');
        avaliacaoModule = createStub();
      }
    } catch (error) {
      console.error('Erro geral ao inicializar módulo de avaliação de desempenho:', error);
      // Em caso de erro, criar um stub básico para o módulo
      avaliacaoModule = {
        version: '0.1.0-stub',
        name: 'avaliacao-desempenho-stub',
        getStatus: () => ({ status: 'online', mode: 'stub' }),
        getAvaliacoes: async () => [],
        getAvaliacao: async (id: any) => null,
        getAvaliacoesByFuncionario: async (funcionarioId: any) => [],
        createAvaliacao: async (data: any) => ({ id: 1, ...data }),
        updateAvaliacao: async (id: any, data: any) => ({ id, ...data }),
        deleteAvaliacao: async (id: any) => true,
        getFuncionarios: async () => [],
        getFuncionario: async (id: any) => null,
        getCriterios: async () => [],
        getCriterio: async (id: any) => null,
        getCriteriosByCategoria: async (categoria: string) => []
      };
    }
  }
  return avaliacaoModule;
}

/**
 * Obtém a instância do módulo de avaliação de desempenho
 * @returns A instância do módulo ou null se não estiver inicializado
 */
export function getAvaliacaoModule() {
  return avaliacaoModule;
}

/**
 * Verifica se o módulo de avaliação de desempenho está inicializado
 * @returns true se o módulo estiver inicializado, false caso contrário
 */
export function isAvaliacaoModuleInitialized() {
  return !!avaliacaoModule;
}

/**
 * Reinicia o módulo de avaliação de desempenho
 * @returns A nova instância inicializada do módulo
 */
export async function restartAvaliacaoModule() {
  avaliacaoModule = null;
  return await initAvaliacaoModule();
}
