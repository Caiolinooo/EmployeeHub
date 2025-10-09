'use client';

import React from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiPhone, FiMail, FiMapPin, FiClock, FiInstagram } from 'react-icons/fi';

export default function ContatosPage() {
  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-abz-text-black mb-6">Contatos</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-abz-text-black mb-6">Informações de Contato</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contato principal */}
          <div className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold text-abz-blue-dark mb-4">ABZ Group - Sede</h3>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <FiMapPin className="text-abz-blue w-5 h-5 mt-1 mr-3 flex-shrink-0" />
                <p className="text-abz-text-dark">
                  Av. Nossa Sra. da Glória, 2987 - Sala 501 <br />
                  Cavaleiros, Macaé - RJ, 27920-360
                </p>
              </div>
              
              <div className="flex items-center">
                <FiPhone className="text-abz-blue w-5 h-5 mr-3 flex-shrink-0" />
                <p className="text-abz-text-dark">(022) 3717-1170</p>
              </div>
              
              <div className="flex items-center">
                <FiMail className="text-abz-blue w-5 h-5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-abz-text-dark">contato@grupoabz.com.br</p>
                  <p className="text-abz-text-dark">info@groupabz.com</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <FiClock className="text-abz-blue w-5 h-5 mr-3 flex-shrink-0" />
                <p className="text-abz-text-dark">Segunda a Sexta: 8h às 18h (atendimento até 17h)</p>
              </div>
              
              <div className="flex items-center">
                <FiInstagram className="text-abz-blue w-5 h-5 mr-3 flex-shrink-0" />
                <a 
                  href="https://www.instagram.com/groupabz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-abz-blue hover:underline"
                >
                  @groupabz
                </a>
              </div>
            </div>
          </div>
          
          {/* Departamentos */}
          <div className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold text-abz-blue-dark mb-4">Departamentos</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-abz-text-black">Logística</h4>
                <p className="text-abz-text-dark">logistica@grupoabz.com.br</p>
                <p className="text-abz-text-dark">(022) 3717-1171</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-abz-text-black">Recursos Humanos</h4>
                <p className="text-abz-text-dark">rh@grupoabz.com.br</p>
                <p className="text-abz-text-dark">(022) 3717-1172</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-abz-text-black">Financeiro</h4>
                <p className="text-abz-text-dark">financeiro@grupoabz.com.br</p>
                <p className="text-abz-text-dark">(022) 3717-1173</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-abz-text-black">Suporte Técnico</h4>
                <p className="text-abz-text-dark">suporte@grupoabz.com.br</p>
                <p className="text-abz-text-dark">(022) 3717-1174</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mapa da localização (opcional) */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-abz-text-black mb-4">Nossa Localização</h3>
          <div className="aspect-video w-full rounded-lg overflow-hidden shadow-md">
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3681.882773675001!2d-41.78713098503992!3d-22.38258658527818!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x96328c1aad932d%3A0x592264f159a2502!2sAv.%20Nossa%20Sra.%20da%20Gl%C3%B3ria%2C%202987%20-%20Cavaleiros%2C%20Maca%C3%A9%20-%20RJ%2C%2027920-360!5e0!3m2!1spt-BR!2sbr!4v1650984507831!5m2!1spt-BR!2sbr"
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Localização ABZ Group"
            ></iframe>
          </div>
        </div>
      </div>
    </MainLayout>
  );
} 
