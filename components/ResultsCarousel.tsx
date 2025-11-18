import React, { useState } from 'react';
import Icon from './Icon';
import JsonEditor from './JsonEditor';
import SceneFramesPreview from './SceneFramesPreview';
import BatchGeminiAnalysis from './BatchGeminiAnalysis';
import type { VideoResult } from '../types';

interface ResultsCarouselProps {
  results: VideoResult[];
  onReset: () => void;
  onBatchAnalysisComplete: (analyses: { resultId: string; vibe: string; imagePrompts: string[]; videoPrompt: string }[]) => void;
  onAutoSaveCSV: (resultsToExport: VideoResult[], filenameSuffix: string) => void;
}

const ResultsCarousel: React.FC<ResultsCarouselProps> = ({ results, onReset, onBatchAnalysisComplete, onAutoSaveCSV }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
  };

  if (results.length === 0) {
    return null;
  }

  const currentResult = results[currentIndex];

  return (
    <div className="w-full max-w-[1800px] mx-auto flex flex-col items-center space-y-10 px-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          Analysis Complete
        </h1>
        <p className="text-lg mt-2 text-gray-500">
          {results.length} {results.length === 1 ? 'video' : 'videos'} analyzed
        </p>
      </div>

      {/* Video Counter & Navigation */}
      <div className="flex flex-col items-center space-y-4">
        {/* Video Title */}
        <p className="text-xl font-semibold text-gray-900 truncate max-w-3xl" title={currentResult.videoName}>
          {currentResult.videoName}
        </p>
        
        {/* Counter and Dots */}
        <div className="flex items-center justify-center space-x-4">
          <div className="px-5 py-2.5 bg-gray-100 rounded-full">
            <span className="text-sm font-medium text-gray-700">
              Video {currentIndex + 1} of {results.length}
            </span>
          </div>
          {results.length > 1 && (
            <div className="relative max-w-[200px] overflow-hidden">
              {/* Fade gradients on sides */}
              {results.length > 8 && (
                <>
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none" />
                </>
              )}
              {/* Dots container with scroll */}
              <div className="flex space-x-2 overflow-x-auto scrollbar-hide px-1 py-1">
                {results.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 flex-shrink-0 ${
                      index === currentIndex
                        ? 'bg-gray-900 w-10'
                        : 'bg-gray-300 hover:bg-gray-400 w-2'
                    }`}
                    aria-label={`Go to video ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Layout: JSON, Scene Frames, and Gemini AI in 3 columns */}
      {currentResult.jsonData.scenes && currentResult.jsonData.scenes.length > 0 ? (
        <div className="w-full flex flex-col xl:flex-row gap-6">
          {/* Left Side: JSON Editor (35%) */}
          <div className="w-full xl:w-[35%] h-[600px]">
            <JsonEditor jsonData={currentResult.jsonData} />
          </div>

          {/* Middle: Scene Frames Preview (30%) with Navigation */}
          <div className="w-full xl:w-[30%] h-[600px] relative">
            {/* Navigation Arrows - Absolute positioned in top-right corner */}
            {results.length > 1 && (
              <div className="absolute -top-14 right-0 flex items-center space-x-2 z-10">
                <button
                  onClick={handlePrevious}
                  className="p-3 bg-white text-gray-800 font-medium rounded-xl shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 border border-gray-200"
                  aria-label="Previous video"
                >
                  <Icon type="chevronLeft" className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNext}
                  className="p-3 bg-white text-gray-800 font-medium rounded-xl shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 border border-gray-200"
                  aria-label="Next video"
                >
                  <Icon type="chevronRight" className="w-5 h-5" />
                </button>
              </div>
            )}
            
            {/* Scene Frames Container */}
            <SceneFramesPreview 
              scenes={currentResult.jsonData.scenes} 
              videoName={currentResult.videoName}
            />
          </div>

          {/* Right Side: Batch Gemini AI Analysis (35%) */}
          <div className="w-full xl:w-[35%]">
            <BatchGeminiAnalysis 
              results={results}
              onAnalysisComplete={onBatchAnalysisComplete}
              onAutoSaveCSV={onAutoSaveCSV}
            />
          </div>
        </div>
      ) : (
        /* If no scenes, show JSON and Gemini side by side */
        <div className="w-full flex flex-col xl:flex-row gap-6">
          <div className="w-full xl:w-[50%] h-[600px]">
            <JsonEditor jsonData={currentResult.jsonData} />
          </div>
          <div className="w-full xl:w-[50%]">
            <BatchGeminiAnalysis 
              results={results}
              onAnalysisComplete={onBatchAnalysisComplete}
              onAutoSaveCSV={onAutoSaveCSV}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default ResultsCarousel;

