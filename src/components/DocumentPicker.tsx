"use client";

import React from "react";
import { FiX } from "react-icons/fi";
import FileExplorer from "./FileExplorer";
import { useI18n } from "@/contexts/I18nContext";

export interface DocumentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (relativePath: string) => void;
  basePath?: string; // default: public/documentos
  fileFilter?: string[]; // default: ['.pdf']
  allowUpload?: boolean; // default: true
  allowCreateFolder?: boolean; // default: true
  initialPath?: string; // default: ''
  title?: string; // optional custom title
}

const DocumentPicker: React.FC<DocumentPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  basePath = "public/documentos",
  fileFilter = [".pdf"],
  allowUpload = true,
  allowCreateFolder = true,
  initialPath = "",
  title,
}) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {title || (t("admin.documents.pickFile", "Selecionar Arquivo") as string)}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <FileExplorer
            basePath={basePath}
            initialPath={initialPath}
            onFileSelect={(p: string) => {
              try {
                onSelect(p);
              } finally {
                onClose();
              }
            }}
            allowUpload={allowUpload}
            allowCreateFolder={allowCreateFolder}
            fileFilter={fileFilter}
            showFullPath={false}
          />
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
            {t("common.cancel", "Cancelar")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentPicker;

