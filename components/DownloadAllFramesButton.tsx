import React from 'react';
import JSZip from 'jszip';
import Icon from './Icon';
import type { VideoResult } from '../types';

interface DownloadAllFramesButtonProps {
  results: VideoResult[];
}

const DownloadAllFramesButton: React.FC<DownloadAllFramesButtonProps> = ({ results }) => {
  const downloadAllVideosFrames = async () => {
    try {
      // Create master ZIP
      const masterZip = new JSZip();

      // Process each video result
      for (const result of results) {
        // Skip if no scenes data
        if (!result.jsonData.scenes || result.jsonData.scenes.length === 0) {
          continue;
        }

        // Create a folder for this video (use video name)
        const videoFolder = masterZip.folder(result.videoName);
        
        if (!videoFolder) {
          console.error(`Failed to create folder for ${result.videoName}`);
          continue;
        }

        // Add each scene frame to the video's folder
        for (const scene of result.jsonData.scenes) {
          try {
            // Decode base64 image data
            const base64Data = scene.frame_preview.split(',')[1] || scene.frame_preview;
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Add frame to video folder with proper naming
            const fileName = `scene_${scene.scene_index.toString().padStart(3, '0')}_frame.png`;
            videoFolder.file(fileName, bytes);
          } catch (error) {
            console.error(`Error processing scene ${scene.scene_index} for ${result.videoName}:`, error);
          }
        }
      }

      // Generate master ZIP file
      const blob = await masterZip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.download = `all-video-frames-${timestamp}.zip`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating master ZIP:', error);
    }
  };

  // Check if any results have scenes
  const hasAnyScenes = results.some(
    result => result.jsonData.scenes && result.jsonData.scenes.length > 0
  );

  if (!hasAnyScenes) {
    return null;
  }

  return (
    <button
      onClick={downloadAllVideosFrames}
      className="fixed top-[68px] right-6 sm:top-[84px] sm:right-8 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-800 text-white font-medium rounded-xl shadow-md hover:shadow-lg hover:bg-black transition-all duration-200 z-40 w-44 sm:w-48"
      aria-label="Download all video frames as ZIP"
      title="Download all frames from all videos"
    >
      <Icon type="download" className="w-5 h-5" />
      <span className="hidden sm:inline">Export Frames</span>
    </button>
  );
};

export default DownloadAllFramesButton;

