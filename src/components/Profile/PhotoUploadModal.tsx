'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/hooks/useToast';
import { FiUpload, FiX, FiLoader, FiCamera } from 'react-icons/fi';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentPhotoUrl: string | null;
}

export function PhotoUploadModal({ isOpen, onClose, userId, currentPhotoUrl }: PhotoUploadModalProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.invalidFileType', 'Tipo de arquivo inválido. Por favor, selecione uma imagem.'));
      return;
    }

    // Verificar tamanho do arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.fileTooLarge', 'Arquivo muito grande. O tamanho máximo é 5MB.'));
      return;
    }

    setSelectedFile(file);
    
    // Criar URL de preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !userId) return;
    
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error(t('common.notAuthorized', 'Não autorizado'));
        return;
      }

      // Criar FormData para upload
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('userId', userId);

      const response = await fetch('/api/users-unified/upload-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t('profile.photoUploaded', 'Foto de perfil atualizada com sucesso'));
        onClose();
        
        // Não recarregar a página, deixar o componente pai atualizar
        // window.location.reload();
      } else {
        const error = await response.json();
        toast.error(error.error || t('profile.photoUploadError', 'Erro ao atualizar foto de perfil'));
      }
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      toast.error(t('profile.photoUploadError', 'Erro ao atualizar foto de perfil'));
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {t('profile.updatePhoto', 'Atualizar foto de perfil')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label={t('common.close', 'Fechar')}
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Área de preview */}
          <div className="flex flex-col items-center">
            <div className="h-40 w-40 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center mb-4">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt={t('profile.preview', 'Preview')}
                  width={160}
                  height={160}
                  className="h-full w-full object-cover"
                />
              ) : currentPhotoUrl ? (
                <Image
                  src={currentPhotoUrl}
                  alt={t('profile.currentPhoto', 'Foto atual')}
                  width={160}
                  height={160}
                  className="h-full w-full object-cover"
                />
              ) : (
                <FiCamera className="h-16 w-16 text-gray-400" />
              )}
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            
            <button
              onClick={triggerFileInput}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <FiUpload className="h-5 w-5 mr-2" />
              {t('profile.selectPhoto', 'Selecionar foto')}
            </button>
            
            {selectedFile && (
              <div className="text-sm text-gray-600 mt-2">
                {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </div>
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            <p>{t('profile.photoRequirements', 'A foto deve ter no máximo 5MB e estar nos formatos JPG, PNG ou GIF.')}</p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isLoading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <FiLoader className="animate-spin h-5 w-5 mr-2" />
                  {t('common.uploading', 'Enviando...')}
                </>
              ) : (
                <>
                  <FiUpload className="h-5 w-5 mr-2" />
                  {t('common.upload', 'Enviar')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
