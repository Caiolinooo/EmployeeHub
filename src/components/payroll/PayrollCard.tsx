'use client';

import React from 'react';
import Link from 'next/link';
import { Calculator, Users, FileText, TrendingUp } from 'lucide-react';

/**
 * Card principal do módulo de folha de pagamento para o dashboard
 * Mantém o design system do Painel ABZ
 */
export default function PayrollCard() {
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200">
      {/* Header do Card */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-abz-blue/10 rounded-lg">
              <Calculator className="h-6 w-6 text-abz-blue" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-abz-text-dark">
                Folha de Pagamento
              </h3>
              <p className="text-sm text-gray-600">
                Gestão completa de folha de pagamento
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-abz-blue">
              R$ 0,00
            </div>
            <div className="text-xs text-gray-500">
              Total mensal
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 bg-abz-green/10 rounded-lg mx-auto mb-2">
              <Users className="h-5 w-5 text-abz-green" />
            </div>
            <div className="text-lg font-semibold text-abz-text-dark">0</div>
            <div className="text-xs text-gray-500">Funcionários</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 bg-abz-purple/10 rounded-lg mx-auto mb-2">
              <FileText className="h-5 w-5 text-abz-purple" />
            </div>
            <div className="text-lg font-semibold text-abz-text-dark">0</div>
            <div className="text-xs text-gray-500">Folhas</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 bg-abz-orange/10 rounded-lg mx-auto mb-2">
              <TrendingUp className="h-5 w-5 text-abz-orange" />
            </div>
            <div className="text-lg font-semibold text-abz-text-dark">0</div>
            <div className="text-xs text-gray-500">Empresas</div>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="space-y-3">
          <Link
            href="/folha-pagamento"
            className="block w-full"
          >
            <button className="w-full bg-abz-blue text-white rounded-md px-4 py-2 font-medium hover:bg-abz-blue-dark transition-colors duration-200 flex items-center justify-center space-x-2">
              <Calculator className="h-4 w-4" />
              <span>Acessar Módulo</span>
            </button>
          </Link>
          
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/folha-pagamento/folhas/nova"
              className="block"
            >
              <button className="w-full bg-gray-100 text-gray-700 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors duration-200">
                Nova Folha
              </button>
            </Link>
            <Link
              href="/folha-pagamento/funcionarios"
              className="block"
            >
              <button className="w-full bg-gray-100 text-gray-700 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors duration-200">
                Funcionários
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer com informações adicionais */}
      <div className="px-6 py-3 bg-gray-50 rounded-b-lg border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Última atualização: Hoje</span>
          <Link
            href="/folha-pagamento/relatorios"
            className="text-abz-blue hover:text-abz-blue-dark transition-colors"
          >
            Ver relatórios →
          </Link>
        </div>
      </div>
    </div>
  );
}
