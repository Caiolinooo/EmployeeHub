'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiUpload } from 'react-icons/fi';
import PageHeader from '@/components/PageHeader';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import ImportCSVAdvanced from '@/components/ImportCSV/ImportCSVAdvanced';
import { userFieldDefinitions, avaliacaoFieldDefinitions, criterioFieldDefinitions } from '@/components/ImportCSV/fieldDefinitions';

export default function ImportacaoPage() {
  const { t } = useI18n();
  const { user } = useSupabaseAuth();
  const [importType, setImportType] = useState('funcionarios');
  const [importComplete, setImportComplete] = useState<boolean>(false);

  // Obter as definições de campo com base no tipo de importação
  const getFieldDefinitions = () => {
    switch (importType) {
      case 'funcionarios':
        return userFieldDefinitions;
      case 'avaliacoes':
        return avaliacaoFieldDefinitions;
      case 'criterios':
        return criterioFieldDefinitions;
      default:
        return userFieldDefinitions;
    }
  };

  // Obter o endpoint da API com base no tipo de importação
  const getApiEndpoint = () => {
    switch (importType) {
      case 'funcionarios':
        return '/api/admin/users/import'; // Endpoint correto para importação de usuários
      case 'avaliacoes':
        return '/api/avaliacao-desempenho/importar';
      case 'criterios':
        return '/api/avaliacao-desempenho/criterios/import';
      default:
        return '/api/admin/users/import';
    }
  };

  // Manipular a conclusão da importação
  const handleImportComplete = (data: any[]) => {
    setImportComplete(true);
    // Aqui você pode adicionar lógica adicional após a importação
  };

  return (
    <MainLayout>
      <PageHeader
        title={t('avaliacao.importacao.title', 'Importação')}
        description={t('avaliacao.importacao.description', 'Importe dados de avaliação de desempenho')}
        icon={<FiUpload className="w-8 h-8" />}
      />

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Importação
          </label>
          <select
            value={importType}
            onChange={(e) => {
              setImportType(e.target.value);
              setImportComplete(false);
            }}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm rounded-md"
          >
            <option value="funcionarios">{t('avaliacao.importacao.importFuncionarios', 'Importar Funcionários')}</option>
            <option value="avaliacoes">{t('avaliacao.importacao.importAvaliacoes', 'Importar Avaliações')}</option>
            <option value="criterios">{t('avaliacao.importacao.importCriterios', 'Importar Critérios')}</option>
          </select>
        </div>

        <ImportCSVAdvanced
          onImportComplete={handleImportComplete}
          apiEndpoint={getApiEndpoint()}
          importType={importType}
          fieldDefinitions={getFieldDefinitions()}
        />

        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('importacao.instructions', 'Instruções')}
          </h3>

          <div className="prose prose-sm text-gray-500">
            <p>Para importar dados, siga os passos abaixo:</p>

            <ol className="list-decimal list-inside text-sm mt-2">
              <li>Selecione o tipo de importação (Funcionários, Avaliações ou Critérios)</li>
              <li>Clique no campo de upload ou arraste e solte seu arquivo CSV</li>
              <li>Verifique a pré-visualização dos dados e ajuste o mapeamento de campos se necessário</li>
              <li>Clique em "Importar Dados" para concluir a importação</li>
            </ol>

            <p className="mt-4 text-blue-700 font-medium">Dica: Para importar dados, recomendamos usar os seguintes modelos:</p>
            <ul className="list-disc list-inside mt-2 text-blue-700">
              <li>
                <a href="/templates/import-users-json.json" download className="underline hover:text-blue-900">
                  Modelo para importação de Funcionários (JSON)
                </a>
              </li>
              <li>
                <a href="/templates/import-office365-users.csv" download className="underline hover:text-blue-900">
                  Modelo para importação de Funcionários (Office 365)
                </a>
              </li>
              <li>
                <a href="/templates/import-avaliacoes.csv" download className="underline hover:text-blue-900">
                  Modelo para importação de Avaliações
                </a>
              </li>
              <li>
                <a href="/templates/import-criterios.csv" download className="underline hover:text-blue-900">
                  Modelo para importação de Critérios
                </a>
              </li>
            </ul>

            <p className="mt-4">Formatos esperados para cada tipo de importação:</p>

            <div className="mt-2">
              <h4 className="font-medium text-gray-700">Funcionários:</h4>
              <p><strong>Campos obrigatórios:</strong> Nome (firstName), Sobrenome (lastName)</p>
              <p><strong>Campos opcionais:</strong> Email, Telefone, Cargo (position), Departamento (department)</p>

              <div className="mt-2 p-2 bg-blue-50 rounded-md">
                <p className="text-sm font-medium text-blue-700">Importação de arquivo do Office 365:</p>
                <p className="text-xs text-blue-600">O sistema reconhece automaticamente o formato de exportação do Office 365 com campos como "Nome para exibição", "Nome UPN", "Nome", "Sobrenome", etc.</p>
                <p className="text-xs text-blue-600 mt-1">Para importar usuários do Office 365:</p>
                <ol className="list-decimal list-inside text-xs text-blue-600 mt-1">
                  <li>Exporte a lista de usuários do portal do Office 365 (formato CSV)</li>
                  <li>Importe o arquivo diretamente sem modificações</li>
                  <li>O sistema mapeará automaticamente os campos "Nome" para firstName, "Sobrenome" para lastName, "Nome UPN" para email, etc.</li>
                  <li>Todos os usuários serão importados com a função "USER" por padrão</li>
                </ol>
              </div>
            </div>

            <div className="mt-2">
              <h4 className="font-medium text-gray-700">Avaliações:</h4>
              <p><strong>Campos obrigatórios:</strong> ID do Funcionário, ID do Avaliador, Período, Data da Avaliação</p>
              <p><strong>Campos opcionais:</strong> Pontuação, Status, Observações, Critérios, Nome do Funcionário, Nome do Avaliador</p>
              <p className="text-xs text-gray-500 mt-1">Obs: Os IDs devem corresponder aos IDs dos usuários no sistema.</p>
            </div>

            <div className="mt-2">
              <h4 className="font-medium text-gray-700">Critérios:</h4>
              <p><strong>Campos obrigatórios:</strong> Nome, Descrição, Peso</p>
              <p><strong>Campos opcionais:</strong> Categoria, Status</p>
              <p className="text-xs text-gray-500 mt-1">Obs: O peso deve ser um número entre 1 e 10.</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

