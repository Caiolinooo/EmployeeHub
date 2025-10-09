'use client';

import React from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiAlertTriangle, FiPhone } from 'react-icons/fi';

export default function EmergenciaPage() {
  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-red-600 mb-6 flex items-center">
        <FiAlertTriangle className="mr-3" /> Emergência
      </h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-abz-text-black mb-4">Contatos Importantes</h2>
        <ul className="space-y-3 text-abz-text-dark">
          <li className="flex items-center">
            <FiPhone className="mr-2 text-red-500" /> 
            <strong>Bombeiros:</strong> <span className="ml-2">193</span>
          </li>
          <li className="flex items-center">
            <FiPhone className="mr-2 text-red-500" /> 
            <strong>Polícia Militar:</strong> <span className="ml-2">190</span>
          </li>
          <li className="flex items-center">
            <FiPhone className="mr-2 text-red-500" /> 
            <strong>SAMU (Ambulância):</strong> <span className="ml-2">192</span>
          </li>
          <li className="flex items-center">
            <FiPhone className="mr-2 text-red-500" /> 
            <strong>Segurança ABZ (Plantão):</strong> <span className="ml-2">[Inserir Número Plantão ABZ]</span>
          </li>
           {/* Adicionar outros contatos relevantes */}
        </ul>

        <h2 className="text-xl font-semibold text-abz-text-black mt-8 mb-4">Procedimentos Básicos</h2>
        <div className="prose max-w-none text-abz-text-dark">
            <p>Em caso de emergência, mantenha a calma e siga os procedimentos estabelecidos.</p>
            <ul>
                <li>Acione o contato de emergência apropriado.</li>
                <li>Informe sua localização e a natureza da emergência.</li>
                <li>Siga as instruções do profissional de emergência.</li>
                <li>Comunique a liderança imediata assim que possível.</li>
                 {/* Adicionar outros procedimentos */}
            </ul>
             {/* TODO: Detalhar procedimentos específicos */}
        </div>
      </div>
    </MainLayout>
  );
}

