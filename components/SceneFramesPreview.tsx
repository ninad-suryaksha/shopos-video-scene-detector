import React, { useState } from 'react';
import JSZip from 'jszip';
import Icon from './Icon';
import type { SceneData } from '../types';

interface SceneFramesPreviewProps {
  scenes: SceneData[];
  videoName: string;
}

const SceneFramesPreview: React.FC<SceneFramesPreviewProps> = ({ scenes, videoName }) => {
  const [expandedSceneIndex, setExpandedSceneIndex] = useState<number | null>(null);

  const toggleExpand = (sceneIndex: number) => {
    setExpandedSceneIndex(expandedSceneIndex === sceneIndex ? null : sceneIndex);
  };

  const downloadAllFramesAsZip = async () => {
    try {
      // Create a new JSZip instance
      const zip = new JSZip();

      // Add each frame to the ZIP
      for (const scene of scenes) {
        // Decode base64 image data
        const base64Data = scene.frame_preview.split(',')[1] || scene.frame_preview;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Add frame to ZIP with proper naming
        const fileName = `scene_${scene.scene_index.toString().padStart(3, '0')}_frame.png`;
        zip.file(fileName, bytes);
      }

      // Generate ZIP file
      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${videoName}_scenes.zip`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating ZIP:', error);
    }
  };

  if (!scenes || scenes.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Scene Frames</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'} detected
          </p>
        </div>
        <button
          onClick={downloadAllFramesAsZip}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors duration-200 shadow-sm"
          aria-label="Download all frames as ZIP"
        >
          <Icon type="download" className="w-4 h-4" />
          <span>Download All</span>
        </button>
      </div>

      {/* Scenes Grid - Scrollable - Fixed 2 Columns Vertical Layout */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
        <div className="grid grid-cols-2 gap-4 auto-rows-max">
          {scenes.map((scene) => (
            <div
              key={scene.scene_index}
              className="group relative bg-gray-50 rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200"
            >
              {/* Frame Preview */}
              <div 
                className="aspect-video bg-gray-100 cursor-pointer relative overflow-hidden"
                onClick={() => toggleExpand(scene.scene_index)}
              >
                <img
                  src={`data:image/png;base64,${scene.frame_preview}`}
                  alt={`Scene ${scene.scene_index} frame`}
                  className="w-full h-full object-cover"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Icon type="search" className="w-6 h-6 text-white drop-shadow-lg" />
                  </div>
                </div>
              </div>

              {/* Scene Info */}
              <div className="p-3 bg-white">
                <p className="text-xs font-semibold text-gray-900 text-center">
                  Scene {scene.scene_index}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded Frame Modal */}
      {expandedSceneIndex !== null && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setExpandedSceneIndex(null)}
        >
          <div 
            className="relative max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setExpandedSceneIndex(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors duration-200"
              aria-label="Close preview"
            >
              <Icon type="close" className="w-6 h-6 text-gray-600" />
            </button>

            {/* Image */}
            <div className="p-6">
              <img
                src={`data:image/png;base64,${scenes.find(s => s.scene_index === expandedSceneIndex)?.frame_preview}`}
                alt={`Scene ${expandedSceneIndex} expanded`}
                className="w-full h-auto rounded-lg"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm font-semibold text-gray-900">
                Scene {expandedSceneIndex}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneFramesPreview;

