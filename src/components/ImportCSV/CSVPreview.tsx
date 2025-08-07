'use client';

import React, { useState, useEffect } from 'react';
import { FiCheck, FiSquare } from 'react-icons/fi';

interface CSVPreviewProps {
  data: Record<string, string | number>[];
  selectedRows?: number[];
  onSelectedRowsChange?: (selectedRows: number[]) => void;
}

export default function CSVPreview({
  data,
  selectedRows = [],
  onSelectedRowsChange
}: CSVPreviewProps) {
  const [selected, setSelected] = useState<number[]>(selectedRows);
  const [selectAll, setSelectAll] = useState<boolean>(false);

  // Sincronizar estado interno com props
  useEffect(() => {
    setSelected(selectedRows);
    setSelectAll(selectedRows.length === data.length);
  }, [selectedRows, data.length]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-md text-center text-gray-500">
        Nenhum dado para exibir
      </div>
    );
  }

  // Obter todas as colunas únicas
  const allColumns = Array.from(
    new Set(
      data.flatMap(row => Object.keys(row))
    )
  );

  // Alternar seleção de uma linha
  const toggleRowSelection = (rowIndex: number) => {
    const newSelected = selected.includes(rowIndex)
      ? selected.filter(i => i !== rowIndex)
      : [...selected, rowIndex];

    setSelected(newSelected);
    setSelectAll(newSelected.length === data.length);

    if (onSelectedRowsChange) {
      onSelectedRowsChange(newSelected);
    }
  };

  // Alternar seleção de todas as linhas
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    const newSelected = newSelectAll
      ? Array.from({ length: data.length }, (_, i) => i)
      : [];

    setSelected(newSelected);
    setSelectAll(newSelectAll);

    if (onSelectedRowsChange) {
      onSelectedRowsChange(newSelected);
    }
  };

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {selected.length} de {data.length} linhas selecionadas
        </div>
        <button
          type="button"
          onClick={toggleSelectAll}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
        >
          {selectAll ? <FiCheck className="mr-1" /> : <FiSquare className="mr-1" />}
          {selectAll ? 'Desmarcar todas' : 'Selecionar todas'}
        </button>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Selecionar
            </th>
            {allColumns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${selected.includes(rowIndex) ? 'bg-blue-50' : ''}`}
            >
              <td className="px-3 py-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleRowSelection(rowIndex)}
                  className="text-gray-400 hover:text-blue-600 focus:outline-none"
                >
                  {selected.includes(rowIndex) ? (
                    <FiCheck className="h-5 w-5 text-blue-600" />
                  ) : (
                    <FiSquare className="h-5 w-5" />
                  )}
                </button>
              </td>
              {allColumns.map((column, colIndex) => (
                <td
                  key={colIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {row[column] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
