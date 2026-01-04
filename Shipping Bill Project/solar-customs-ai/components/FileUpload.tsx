import React, { useRef, useState } from 'react';
import { UploadCloud, ArrowRight, Files, CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface FileStatus {
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    message?: string;
}

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  isLoading: boolean;
  fileStatuses?: FileStatus[];
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  isLoading, 
  fileStatuses = []
}) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalFiles = fileStatuses.length;
  const completedFiles = fileStatuses.filter(f => f.status === 'completed' || f.status === 'error').length;
  const progressPercentage = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;
  
  const currentProcessingFile = fileStatuses.find(f => f.status === 'processing');
  const statusMessage = currentProcessingFile 
    ? `Analyzing: ${currentProcessingFile.name}` 
    : (completedFiles === totalFiles && totalFiles > 0 ? "Matrix Extraction Complete" : "Standby for document upload...");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (isLoading) return;
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (isLoading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) validateAndUpload(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) validateAndUpload(e.target.files);
  };

  const validateAndUpload = (fileList: FileList) => {
    const validFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
        if (fileList[i].type === 'application/pdf') validFiles.push(fileList[i]);
    }
    if (validFiles.length > 0) onFileSelect(validFiles);
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-8 relative z-20">
      <div
        className={`relative group flex flex-col items-center justify-center w-full transition-all duration-500 bg-white rounded-3xl
          ${dragActive 
            ? 'border-[4px] border-brand-primary bg-red-50 shadow-2xl scale-[1.01]' 
            : 'border-2 border-dashed border-brand-secondary/20 hover:border-brand-primary hover:shadow-xl shadow-sm'
          } ${isLoading ? 'opacity-60 pointer-events-none' : ''} h-[20rem]`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input ref={inputRef} type="file" className="hidden" accept=".pdf" multiple onChange={handleChange} disabled={isLoading} />
        <div className="flex flex-col items-center justify-center text-center px-10 w-full h-full">
            <div className={`mb-6 transition-all duration-700 transform ${dragActive ? 'scale-110' : 'group-hover:rotate-12'}`}>
                <div className={`w-20 h-20 flex items-center justify-center rounded-3xl ${dragActive ? 'bg-brand-primary shadow-red-300 shadow-2xl' : 'bg-brand-secondary shadow-lg'} text-white`}>
                    {dragActive ? <Files className="w-10 h-10" /> : <UploadCloud className="w-10 h-10" />}
                </div>
            </div>
            <h3 className="mb-2 text-3xl font-black text-brand-secondary tracking-tighter uppercase">Solar Ingest</h3>
            <p className="mb-8 text-sm text-brand-secondary/60 max-w-sm font-bold uppercase tracking-widest">Analyze Shipping Bills (Navy & Red Edition)</p>
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isLoading}
                className="inline-flex items-center justify-center px-12 py-4 text-xs font-black text-white bg-brand-primary hover:bg-red-700 transition-all rounded-2xl shadow-xl shadow-red-200 tracking-[0.2em] uppercase disabled:opacity-50 active:scale-95"
            >
                {isLoading ? "Analyzing Data..." : "Load Data Source"} <ArrowRight className="ml-4 w-5 h-5" />
            </button>
        </div>
      </div>

      {fileStatuses.length > 0 && (
        <div className="mt-12 animate-propel">
            {isLoading && (
                <div className="w-full mb-8">
                    <div className="flex justify-between items-end mb-3 px-1">
                        <h3 className="text-[10px] font-black text-brand-secondary uppercase tracking-[0.3em]">Processing Pipeline</h3>
                        <span className="text-sm font-black text-brand-primary tracking-tighter">{Math.round(progressPercentage)}%</span>
                    </div>
                    <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden relative border-2 border-slate-300 shadow-inner">
                        <div className="h-full bg-brand-primary transition-all duration-700 ease-out relative" style={{ width: `${progressPercentage}%` }}>
                            <div className="absolute inset-0 bg-white/40 w-full h-full animate-shimmer"></div>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-white rounded-3xl border border-brand-border shadow-2xl overflow-hidden">
                <div className="bg-brand-secondary px-8 py-5 border-b border-brand-border flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em]">Extraction Pipeline Logs</h4>
                    </div>
                    <span className="text-[9px] font-black text-white bg-white/10 px-4 py-1.5 rounded-full border border-white/20 uppercase tracking-widest">
                        {completedFiles} OF {totalFiles} COMPLETE
                    </span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {fileStatuses.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-5 bg-white hover:bg-red-50 transition-colors">
                            <div className="flex items-center gap-4">
                                {file.status === 'processing' ? <Loader2 className="w-5 h-5 text-brand-primary animate-spin" /> : 
                                 file.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-status-success" /> : 
                                 file.status === 'error' ? <XCircle className="w-5 h-5 text-status-error" /> : 
                                 <div className="w-5 h-5 rounded-full border-[3px] border-slate-200" />}
                                <span className={`text-sm font-black tracking-tight ${file.status === 'processing' ? 'text-brand-primary' : 'text-brand-secondary'}`}>{file.name}</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${file.status === 'completed' ? 'text-status-success' : 'text-slate-400'}`}>{file.status}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};