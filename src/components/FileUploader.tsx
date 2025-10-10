"use client";

import React, { useState, useRef, useCallback } from 'react';
import { FiUpload, FiX, FiFile, FiImage, FiPaperclip, FiLoader } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { uploadReimbursementAttachment } from '@/services/reimbursementService';


export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  url?: string;
  uploading?: boolean;
  uploadError?: string;
  buffer?: ArrayBuffer | null; // Dados binários do arquivo
  isLocalFile?: boolean; // Indica se o arquivo é local
}

interface FileUploaderProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeInMB?: number;
  acceptedFileTypes?: string[];
}

const FileUploader: React.FC<FileUploaderProps> = ({
  files,
  onFilesChange,
  maxFiles = 5,
  maxSizeInMB = 10,
  acceptedFileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
}) => {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
      setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!acceptedFileTypes.includes(file.type)) {
      return t('fileUploader.unsupportedFileType', `Unsupported file type: ${file.type}`);
    }

    // Check file size
    if (file.size > maxSizeInBytes) {
      return t('fileUploader.fileTooLarge', `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB (maximum: ${maxSizeInMB}MB)`);
    }

    return null;
  }, [acceptedFileTypes, maxSizeInBytes, maxSizeInMB, t]);

  const processFiles = useCallback(async (fileList: FileList) => {
    setError(null);

    // Check if adding these files would exceed the maximum
    if (files.length + fileList.length > maxFiles) {
      setError(t('fileUploader.maxFilesExceeded', `You can upload a maximum of ${maxFiles} files`));
      return;
    }

    const newFiles: UploadedFile[] = [];
    let hasErrors = false;

    // First add all files with uploading status
    Array.from(fileList).forEach(file => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        hasErrors = true;
        return;
      }

      const tempId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Criar um objeto para armazenar os dados binários do arquivo
      const reader = new FileReader();

      // Adicionar o arquivo à lista de novos arquivos
      newFiles.push({
        id: tempId,
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
        uploading: true
      });

      // Ler o arquivo como DataURL para obter os dados binários em base64
      reader.readAsDataURL(file);

      // Quando a leitura for concluída, armazenar os dados binários
      reader.onload = () => {
        const dataUrl = reader.result as string;

        // Atualizar o arquivo com os dados binários
        const fileIndex = newFiles.findIndex(f => f.id === tempId);
        if (fileIndex !== -1) {
          newFiles[fileIndex] = {
            ...newFiles[fileIndex],
            buffer: dataUrl as any, // Armazenar os dados como DataURL
            isLocalFile: true // Marcar como arquivo local
          };

          console.log({t('components.dadosBinariosCapturadosParaFilenameDataurllengthCa')});

          // Atualizar o estado com os dados binários
          onFilesChange([...files, ...newFiles]);
        }
      };

      // Adicionar um handler para erros de leitura
      reader.onerror = (error) => {
        console.error(`Erro ao ler arquivo ${file.name}:`, error);

        // Atualizar o arquivo com o erro
        const fileIndex = newFiles.findIndex(f => f.id === tempId);
        if (fileIndex !== -1) {
          newFiles[fileIndex] = {
            ...newFiles[fileIndex],
            uploadError: t('fileUploader.errorReadingFile', 'Error reading file')
          };

          // Atualizar o estado com o erro
          onFilesChange([...files, ...newFiles]);
        }
      };
    });

    if (!hasErrors) {
      // Add the files to state with uploading status
      onFilesChange([...files, ...newFiles]);

      // Upload each file to Supabase
      for (let i = 0; i < newFiles.length; i++) {
        const fileToUpload = newFiles[i];
        const file = fileToUpload.file;

        if (!file) continue;

        try {
          // Try to upload the file to Supabase
          try {
            const uploadedFile = await uploadReimbursementAttachment(file);

            // Update the file with the upload result
            const updatedFile = {
              ...fileToUpload,
              id: uploadedFile.id,
              url: uploadedFile.url,
              uploading: false
            };

            // Update the file in the array
            newFiles[i] = updatedFile;

            // Update the state with the current progress
            onFilesChange([
              ...files,
              ...newFiles.map((f, index) => index === i ? updatedFile : f)
            ]);
          } catch (uploadError) {
            console.error('Error uploading file to Supabase:', uploadError);

            // If the error is related to the bucket not existing or RLS policies, use a local fallback
            if (uploadError instanceof Error &&
                (uploadError.message.includes('bucket') ||
                 uploadError.message.includes('not found') ||
                 uploadError.message.includes('does not exist') ||
                 uploadError.message.includes('row-level security') ||
                 uploadError.message.includes('RLS') ||
                 uploadError.message.includes('policy') ||
                 uploadError.message.includes('permission denied'))) {

              console.log('Using local file reference as fallback due to storage error:', uploadError.message);

              // Generate a local ID for the file
              const localId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

              // Create a local URL for the file (this will be temporary)
              const localUrl = URL.createObjectURL(file);

              // Update the file with local reference
              const localFile = {
                ...fileToUpload,
                id: localId,
                url: localUrl,
                uploading: false,
                isLocalFile: true, // Mark as local file
                buffer: fileToUpload.buffer // Manter os dados binários
              };

              // Update the file in the array
              newFiles[i] = localFile;

              // Update the state with the local file
              onFilesChange([
                ...files,
                ...newFiles.map((f, index) => index === i ? localFile : f)
              ]);

              // Show warning toast with appropriate message
              const errorType = uploadError.message.includes('row-level security') ||
                                uploadError.message.includes('RLS') ||
                                uploadError.message.includes('policy') ||
                                uploadError.message.includes('permission denied')
                ? 'RLS policy'
                : 'bucket';

              // Use a simple alert instead of toast to avoid any issues
              alert(t('fileUploader.fileStoredLocally', 'File stored locally due to storage issues. The file will be included in your submission, but may not be permanently stored.'));
            } else {
              // For other errors, show the error
              throw uploadError;
            }
          }
        } catch (err) {
          console.error('Error processing file:', err);

          // Update the file with the error
          const errorFile = {
            ...fileToUpload,
            uploading: false,
            uploadError: err instanceof Error ? err.message : t('fileUploader.uploadError', 'Upload error')
          };

          // Update the file in the array
          newFiles[i] = errorFile;

          // Update the state with the error
          onFilesChange([
            ...files,
            ...newFiles.map((f, index) => index === i ? errorFile : f)
          ]);

          // Show error alert with more details
          const errorMessage = err instanceof Error ? err.message : t('common.unknownError', 'Unknown error');
          alert(t('fileUploader.errorUploadingFile', `Error uploading ${fileToUpload.name}: ${errorMessage}`));
        }
      }

      // Final update with all files processed
      onFilesChange([...files, ...newFiles]);
    }
  }, [files, maxFiles, onFilesChange, validateFile, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset the input value so the same file can be selected again if removed
      e.target.value = '';
    }
  }, [processFiles]);

  const handleRemoveFile = useCallback((id: string) => {
    onFilesChange(files.filter(file => file.id !== id));
  }, [files, onFilesChange]);

  const getFileIcon = useCallback((fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FiImage className="w-5 h-5 text-blue-500" />;
    } else if (fileType === 'application/pdf') {
      return <FiFile className="w-5 h-5 text-red-500" />;
    } else {
      return <FiPaperclip className="w-5 h-5 text-gray-500" />;
    }
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) {
      return bytes + ' bytes';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
  }, []);

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('fileUploader.attachments', 'Attachments')} <span className="text-red-500">*</span>
      </label>

      {/* Drag and drop area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <FiUpload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          {t('fileUploader.dragDropText', 'Drag and drop files here, or click to select')}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {t('fileUploader.acceptedFormats', `Accepted formats: PDF, JPG, PNG (max. ${maxSizeInMB}MB per file)`)}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-red-600" style={{ opacity: 1, visibility: 'visible' }}>
          {error}
        </p>
      )}

      {/* File list */}
      <div className="mt-4">
        {files.length > 0 && (
          <div className="bg-gray-50 rounded-md p-3" style={{ opacity: 1, visibility: 'visible' }}>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {t('fileUploader.selectedFiles', `Selected files (${files.length}/${maxFiles})`)}
              </h4>
              <ul className="space-y-2">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className={`flex items-center justify-between bg-white p-2 rounded border ${
                      file.uploadError ? 'border-red-300 bg-red-50' :
                      file.uploading ? 'border-blue-300 bg-blue-50' :
                      'border-gray-200'
                    }`}
                    style={{ opacity: 1, visibility: 'visible' }}
                  >
                    <div className="flex items-center">
                      {file.uploading ? (
                        <div className="animate-spin">
                          <FiLoader className="w-5 h-5 text-blue-500" />
                        </div>
                      ) : file.uploadError ? (
                        <FiX className="w-5 h-5 text-red-500" />
                      ) : (
                        getFileIcon(file.type)
                      )}
                      <div className="ml-2">
                        <p className="text-sm font-medium text-gray-700 truncate max-w-xs">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {file.uploadError ? (
                            <span className="text-red-500">{file.uploadError}</span>
                          ) : file.uploading ? (
                            <span className="text-blue-500">{t('fileUploader.uploading', 'Uploading...')}</span>
                          ) : (
                            formatFileSize(file.size)
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(file.id);
                      }}
                      className="text-gray-400 hover:text-red-500 focus:outline-none"
                      disabled={file.uploading}
                    >
                      <FiX className={`h-5 w-5 ${file.uploading ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </div>
  );
};

export default FileUploader;