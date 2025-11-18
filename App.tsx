import React, { useState, useCallback, useEffect } from 'react';
import UploadZone from './components/UploadZone';
import ProgressBar from './components/ProgressBar';
import JsonEditor from './components/JsonEditor';
import ResultsCarousel from './components/ResultsCarousel';
import History from './components/History';
import Icon from './components/Icon';
import DownloadAllFramesButton from './components/DownloadAllFramesButton';
import { analyzeVideoForScenes } from './services/sceneDetectionService';
import { ProgressStage } from './types';
import type { OutputJson, HistoryItem, VideoResult } from './types';

const HISTORY_STORAGE_KEY = 'video-scene-detector-history';

const App: React.FC = () => {
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<ProgressStage>(ProgressStage.IDLE);
  const [results, setResults] = useState<VideoResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(15); // Lower = more sensitive
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState<boolean>(false);
  const [isGeminiAnalysisComplete, setIsGeminiAnalysisComplete] = useState<boolean>(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
    setIsHistoryLoaded(true);
  }, []);

  // Save history to localStorage whenever it changes (but only after initial load)
  useEffect(() => {
    if (!isHistoryLoaded) {
      return;
    }
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }, [history, isHistoryLoaded]);

  const addToHistory = useCallback((jsonData: OutputJson, videoName: string) => {
    const newItem: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      videoName,
      jsonData
    };
    setHistory(prev => [newItem, ...prev]);
  }, []);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  const viewHistoryItem = useCallback((jsonData: OutputJson, videoName: string) => {
    // Create a single result from history item
    const singleResult: VideoResult = {
      id: `history-${Date.now()}`,
      videoName,
      jsonData,
      file: new File([], videoName) // Empty file placeholder for history items
    };
    setResults([singleResult]);
    setShowHistory(false);
    setProgressStage(ProgressStage.DONE);
    
    // If history item already has Gemini data, mark as complete
    if (jsonData.vibe_description || jsonData.image_prompts || jsonData.video_prompt) {
      setIsGeminiAnalysisComplete(true);
    } else {
      setIsGeminiAnalysisComplete(false);
    }
  }, []);

  // Helper function to export CSV with current results (used for auto-save)
  const generateAndDownloadCSV = useCallback((resultsToExport: VideoResult[], filenameSuffix: string = '') => {
    if (resultsToExport.length === 0) return;

    // CSV Headers - Only the requested fields
    const headers = [
      'Filename',
      'Clips Count',
      'JSON Output',
      'Vibe Description',
      'Image Prompt',
      'Video Prompt'
    ];

    // Helper to clean markdown formatting (remove ** **)
    const cleanMarkdown = (text: string): string => {
      return text.replace(/\*\*/g, '');
    };

    // Convert results to CSV rows
    const rows = resultsToExport.map(result => {
      // Ensure JSON field order
      const orderedJson = {
        name: result.jsonData.name,
        clips: result.jsonData.clips.map(clip => ({
          index: clip.index,
          duration: clip.duration,
          required: clip.required
        })),
        transitions: result.jsonData.transitions.map(transition => ({
          type: transition.type,
          duration: transition.duration,
          between_clips: transition.between_clips
        })),
        logo_outro: result.jsonData.logo_outro,
        music_file: result.jsonData.music_file,
        fade_in_duration: result.jsonData.fade_in_duration,
        fade_out_duration: result.jsonData.fade_out_duration
      };
      
      // Custom stringifier to ensure numbers show decimal point
      const jsonStringWithDecimals = JSON.stringify(orderedJson, (key, value) => {
        if (typeof value === 'number') {
          return Number.isInteger(value) ? value.toFixed(1) : value;
        }
        return value;
      }).replace(/"(-?\d+\.\d+)"/g, '$1');
      
      // Format image prompts - combine all with frame numbers
      const imagePromptsFormatted = result.jsonData.image_prompts 
        ? result.jsonData.image_prompts
            .map((prompt, idx) => `Frame ${idx + 1}: ${cleanMarkdown(prompt)}`)
            .join('\n\n')
        : '';
      
      // Clean vibe and video prompt
      const cleanedVibe = result.jsonData.vibe_description 
        ? cleanMarkdown(result.jsonData.vibe_description) 
        : '';
      const cleanedVideoPrompt = result.jsonData.video_prompt 
        ? cleanMarkdown(result.jsonData.video_prompt) 
        : '';
      
      return [
        result.videoName,
        result.jsonData.clips.length.toString(),
        jsonStringWithDecimals,
        cleanedVibe,
        imagePromptsFormatted,
        cleanedVideoPrompt
      ];
    });

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV content
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `video-analysis-batch-${timestamp}${filenameSuffix}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleBatchAnalysisComplete = useCallback((analyses: { resultId: string; vibe: string; imagePrompts: string[]; videoPrompt: string }[]) => {
    // Update all results at once with their Gemini analyses
    setResults(prevResults => 
      prevResults.map(result => {
        const analysis = analyses.find(a => a.resultId === result.id);
        if (analysis) {
          return {
            ...result,
            jsonData: {
              ...result.jsonData,
              vibe_description: analysis.vibe,
              image_prompts: analysis.imagePrompts,
              video_prompt: analysis.videoPrompt
            }
          };
        }
        return result;
      })
    );
    
    // Also update history for all analyzed videos
    setHistory(prevHistory =>
      prevHistory.map(item => {
        const result = results.find(r => r.videoName === item.videoName);
        if (result) {
          const analysis = analyses.find(a => a.resultId === result.id);
          if (analysis) {
            return {
              ...item,
              jsonData: {
                ...item.jsonData,
                vibe_description: analysis.vibe,
                image_prompts: analysis.imagePrompts,
                video_prompt: analysis.videoPrompt
              }
            };
          }
        }
        return item;
      })
    );
    
    // Mark Gemini analysis as complete
    setIsGeminiAnalysisComplete(true);
  }, [results]);

  const resetState = () => {
    setVideoFiles([]);
    setCurrentVideoIndex(0);
    setProgressStage(ProgressStage.IDLE);
    setResults([]);
    setIsLoading(false);
    setError(null);
    setThreshold(15); // Reset to default
    setIsGeminiAnalysisComplete(false); // Reset Gemini analysis state
  };

  const handleFileUpload = useCallback(async (files: File[]) => {
    resetState();
    setIsLoading(true);
    setVideoFiles(files);
    
    const newResults: VideoResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentVideoIndex(i);
        const baseName = file.name.split('.').slice(0, -1).join('.');

        setProgressStage(ProgressStage.UPLOADING);
        setProgressStage(ProgressStage.ANALYZING);
        setProgressStage(ProgressStage.DETECTING);
        const result = await analyzeVideoForScenes(file, threshold);
        
        setProgressStage(ProgressStage.EXPORTING);
        
        const videoResult: VideoResult = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          videoName: baseName,
          jsonData: result,
          file
        };
        
        newResults.push(videoResult);
        
        // Add to history
        addToHistory(result, baseName);
      }
      
      setResults(newResults);
      setProgressStage(ProgressStage.DONE);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setProgressStage(ProgressStage.IDLE);
    } finally {
      setIsLoading(false);
    }
  }, [threshold, addToHistory]);

  const exportAllToCSV = useCallback(() => {
    generateAndDownloadCSV(results, '');
  }, [results, generateAndDownloadCSV]);


  const renderContent = () => {
    if (error) {
      return (
        <div className="text-center w-full max-w-2xl">
          <p className="text-2xl font-semibold mb-4 text-gray-800">Analysis Failed</p>
          <p className="text-gray-600 bg-red-50 border border-red-200 p-4 rounded-lg mb-8 whitespace-pre-wrap">{error}</p>
          <button
            onClick={resetState}
            className="px-8 py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-black transition-all duration-300"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (results.length > 0) {
      return (
        <ResultsCarousel 
          results={results} 
          onReset={resetState}
          onBatchAnalysisComplete={handleBatchAnalysisComplete}
          onAutoSaveCSV={generateAndDownloadCSV}
        />
      );
    }

    if (isLoading || videoFiles.length > 0) {
      const currentFile = videoFiles[currentVideoIndex];
      const currentVideoName = currentFile ? currentFile.name.split('.').slice(0, -1).join('.') : '';
      
      return (
        <div className="w-full flex flex-col items-center space-y-10 max-w-3xl">
          <div className="text-center">
            <p className="text-xl font-medium text-gray-700">
              Analyzing {videoFiles.length > 1 ? `Video ${currentVideoIndex + 1} of ${videoFiles.length}` : 'Video'}
            </p>
            <p className="text-lg font-bold mt-1 text-gray-900">{currentVideoName}</p>
          </div>
          <ProgressBar currentStage={progressStage} />
          {isLoading && (
            <p className="text-center text-gray-500 animate-pulse">
              Processing your {videoFiles.length > 1 ? 'videos' : 'video'}... this may take a few moments.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="w-full max-w-3xl space-y-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <label className="block mb-4">
            <span className="text-sm font-semibold text-gray-700 block mb-2">
              Detection Sensitivity: {threshold} 
              <span className="font-normal text-gray-500 ml-2">
                (Lower = More Cuts)
              </span>
            </span>
            <input
              type="range"
              min="5"
              max="40"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-800"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Very Sensitive (5)</span>
              <span>Recommended: 12-20</span>
              <span>Less Sensitive (40)</span>
            </div>
          </label>
          <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
            <strong>Tip:</strong> Start with 15. If cuts are missed, lower to 10-12. If too many false cuts, raise to 20-25.
          </div>
        </div>
        <UploadZone onFileUpload={handleFileUpload} isLoading={isLoading} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-start p-6 sm:p-12 md:p-20 font-['SF_Pro_Display',_'Arial',_'Helvetica',_sans-serif]">
      {/* Analyze More Videos Button - Fixed position top-left */}
      {results.length > 0 && (
        <button
          onClick={resetState}
          className="fixed top-6 left-6 sm:top-8 sm:left-8 flex items-center space-x-2 px-4 py-2.5 bg-white text-gray-800 font-medium rounded-xl shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 border border-gray-200 z-40"
          style={{
            boxShadow: '0 4px 14px 0 rgba(30, 64, 175, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.1)'
          }}
          aria-label="Analyze more videos"
        >
          <Icon type="plus" className="w-5 h-5" />
          <span className="hidden sm:inline">Analyze More</span>
        </button>
      )}

      {/* History Button - Fixed position right (left of Export CSV) */}
      <button
        onClick={() => setShowHistory(true)}
        className="fixed top-6 right-52 sm:top-8 sm:right-64 p-3 bg-white text-gray-800 font-medium rounded-xl shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 border border-gray-200 z-40"
        aria-label="View history"
      >
        <Icon type="history" className="w-5 h-5" />
      </button>

      {/* Export CSV Button - Fixed position right */}
      <button
        onClick={exportAllToCSV}
        disabled={results.length === 0}
        className="fixed top-6 right-6 sm:top-8 sm:right-8 flex items-center justify-center space-x-2 px-4 py-2.5 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-40 w-44 sm:w-48"
        style={{
          backgroundColor: results.length === 0 ? '#1e40af' : '#1e40af',
          opacity: results.length === 0 ? 0.5 : 1
        }}
        onMouseEnter={(e) => {
          if (results.length > 0) {
            e.currentTarget.style.backgroundColor = '#1e3a8a';
          }
        }}
        onMouseLeave={(e) => {
          if (results.length > 0) {
            e.currentTarget.style.backgroundColor = '#1e40af';
          }
        }}
        aria-label="Export all videos to CSV"
        title={!isGeminiAnalysisComplete ? "Export with available data (AI analysis in progress)" : "Export all videos to CSV"}
      >
        <Icon type="download" className="w-5 h-5" />
        <span className="hidden sm:inline">Export CSV</span>
      </button>

      {/* Download All Frames Button - Below Export CSV */}
      {results.length > 0 && <DownloadAllFramesButton results={results} />}

      <main className="w-full flex flex-col items-center justify-center">
        {renderContent()}
      </main>

      {/* History Modal */}
      {showHistory && (
        <History
          historyItems={history}
          onDelete={deleteFromHistory}
          onView={viewHistoryItem}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};

export default App;