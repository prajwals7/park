'use client';

import React, { useState, useRef } from 'react';
import { Camera, UploadCloud, X, CheckCircle2, AlertCircle } from 'lucide-react';

export interface FileUploadProps {
  label: string;
  accept?: string;
  maxSizeBytes?: number;
  onFileSelect?: (file: File | null) => void;
  required?: boolean;
  disabled?: boolean;
}

export function FileUpload({
  label,
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeBytes = 5 * 1024 * 1024, // 5MB
  onFileSelect,
  required = false,
  disabled = false,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);

    // Validate size
    if (file.size > maxSizeBytes) {
      setError(`File size exceeds ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB limit.`);
      return;
    }

    // Validate type
    const allowed = accept.split(',').map((t) => t.trim().toLowerCase());
    if (!allowed.includes(file.type.toLowerCase())) {
      setError('Invalid file format. Allowed: JPEG, PNG, WEBP.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (onFileSelect) {
      onFileSelect(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      {/* Hidden inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />

      {!previewUrl ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
            isDragging
              ? 'border-park-700 bg-park-50/50 dark:bg-park-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-900/40'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <UploadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Drag and drop document, or browse
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition"
              >
                Choose File
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => cameraInputRef.current?.click()}
                className="px-3 py-1.5 bg-park-100 hover:bg-park-200 dark:bg-park-900/60 dark:hover:bg-park-800 text-park-900 dark:text-park-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <Camera className="w-3.5 h-3.5" />
                Capture with Camera
              </button>
            </div>
            <div className="text-[10px] text-slate-400">Allowed: JPEG, PNG, WEBP (Max 5MB)</div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 border border-slate-300 dark:border-slate-600">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              {selectedFile?.name || 'Captured Document'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {((selectedFile?.size || 0) / 1024).toFixed(0)} KB • Ready for upload
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Remove uploaded file"
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
