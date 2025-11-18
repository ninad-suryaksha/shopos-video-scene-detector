import React, { useState, useCallback, useRef } from 'react';
import Icon from './Icon';

interface UploadZoneProps {
  onFileUpload: (files: File[]) => void;
  isLoading: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileUpload, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) setIsDragging(true);
  }, [isLoading]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const videoFiles = files.filter(file => file.type.startsWith('video/'));
      
      if (videoFiles.length === 0) {
        alert('Please upload valid video files.');
      } else {
        if (videoFiles.length < files.length) {
          alert(`${files.length - videoFiles.length} non-video file(s) were skipped.`);
        }
        onFileUpload(videoFiles);
      }
      e.dataTransfer.clearData();
    }
  }, [onFileUpload, isLoading]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFileUpload(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-4xl text-center">
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">ShopOS Video Scene Detector</h1>
      <p className="text-lg text-gray-600 mb-12">Upload a video to analyse its scenes with ShopOS Video Workflow</p>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`w-full bg-white border border-gray-200 rounded-2xl p-12 sm:p-20 transition-all duration-300 shadow-sm ${isDragging ? 'border-blue-500 ring-4 ring-blue-500/10' : ''}`}
      >
        <div className="flex flex-col items-center justify-center">
          <Icon type="upload" className="w-20 h-20 text-gray-400 mb-6"/>
          <p className="text-2xl font-semibold text-gray-800 mb-2">Drag & drop your videos here</p>
          <p className="text-gray-500 mb-2">Support for multiple videos</p>
          <p className="text-gray-500 mb-8">or</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            multiple
            className="hidden"
            disabled={isLoading}
          />
          <button
            onClick={handleClick}
            disabled={isLoading}
            className="px-8 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
{isLoading ? 'Processing...' : 'Select file(s)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadZone;