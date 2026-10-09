'use client';

import {
  opcoesPrazoContrato,
  prazoContratoExigeProrrogacao,
  prazoContratoExigeVigencia,
} from '@/lib/gestao-tripulantes/prazo-contrato';

type CampoPrazo =
  | 'prazo_contrato_dias'
  | 'prazo_contrato_termino'
  | 'prazo_contrato_prorrog_dias'
  | 'prazo_contrato_prorrog_termino';

export function PrazoContratoFields({
  prazo,
  dias,
  termino,
  prorrogDias,
  prorrogTermino,
  onPrazoChange,
  onCampoChange,
  inputClassName,
  labelClassName,
}: {
  prazo: unknown;
  dias: unknown;
  termino: unknown;
  prorrogDias: unknown;
  prorrogTermino: unknown;
  onPrazoChange: (value: string) => void;
  onCampoChange: (field: CampoPrazo, value: string) => void;
  inputClassName: string;
  labelClassName: string;
}) {
  const prazoTexto = prazo == null ? '' : String(prazo);
  const mostraVigencia = prazoContratoExigeVigencia(prazoTexto);
  const mostraProrrogacao = prazoContratoExigeProrrogacao(prazoTexto);
  const texto = (value: unknown) => (value == null ? '' : String(value));
  const label = (text: string) => <label className={labelClassName}>{text}</label>;

  return (
    <>
      <div>
        {label('Prazo do Contrato')}
        <select
          className={inputClassName}
          value={prazoTexto}
          onChange={e => onPrazoChange(e.target.value)}
        >
          <option value="">Selecione...</option>
          {opcoesPrazoContrato(prazoTexto).map(opcao => (
            <option key={opcao} value={opcao}>{opcao}</option>
          ))}
        </select>
      </div>
      {mostraVigencia && (
        <>
          <div>
            {label('Dias')}
            <input
              type="number"
              min={0}
              step={1}
              className={inputClassName}
              value={texto(dias)}
              onChange={e => onCampoChange('prazo_contrato_dias', e.target.value)}
            />
          </div>
          <div>
            {label('Término')}
            <input
              type="date"
              className={inputClassName}
              value={texto(termino)}
              onChange={e => onCampoChange('prazo_contrato_termino', e.target.value)}
            />
          </div>
        </>
      )}
      {mostraProrrogacao && (
        <>
          <div>
            {label('Prorrogação (dias)')}
            <input
              type="number"
              min={0}
              step={1}
              className={inputClassName}
              value={texto(prorrogDias)}
              onChange={e => onCampoChange('prazo_contrato_prorrog_dias', e.target.value)}
            />
          </div>
          <div>
            {label('Término da prorrogação')}
            <input
              type="date"
              className={inputClassName}
              value={texto(prorrogTermino)}
              onChange={e => onCampoChange('prazo_contrato_prorrog_termino', e.target.value)}
            />
          </div>
        </>
      )}
    </>
  );
}
