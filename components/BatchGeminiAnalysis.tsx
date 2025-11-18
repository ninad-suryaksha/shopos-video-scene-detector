import React, { useState, useEffect } from 'react';
import GeminiLogo from './GeminiLogo';
import type { VideoResult } from '../types';

interface FailedVideo {
  videoName: string;
  reason: string;
}

interface BatchGeminiAnalysisProps {
  results: VideoResult[];
  onAnalysisComplete: (analyses: { resultId: string; vibe: string; imagePrompts: string[]; videoPrompt: string }[]) => void;
  onAutoSaveCSV: (resultsToExport: VideoResult[], filenameSuffix: string) => void;
}

const BatchGeminiAnalysis: React.FC<BatchGeminiAnalysisProps> = ({ results, onAnalysisComplete, onAutoSaveCSV }) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [failedVideos, setFailedVideos] = useState<FailedVideo[]>([]);
  
  // Load API key from environment variable
  useEffect(() => {
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    setApiKey(envApiKey);
  }, []);
  
  // Auto-start analysis when API key is available and results exist
  useEffect(() => {
    if (apiKey && results.length > 0 && !isComplete && !isAnalyzing && !error) {
      // Check if any video has scenes and valid files (not from history)
      const videosWithScenes = results.filter(r => 
        r.jsonData.scenes && 
        r.jsonData.scenes.length > 0 && 
        r.file.size > 0 // Skip history items with empty files
      );
      if (videosWithScenes.length > 0) {
        handleBatchAnalyze();
      } else {
        setIsComplete(true); // No videos with scenes or all from history, mark as complete
        onAnalysisComplete([]); // Pass empty array to signal completion
      }
    }
  }, [apiKey, results]);

  const handleBatchAnalyze = async () => {
    if (!apiKey.trim()) {
      setError('API key not found. Please add VITE_GEMINI_API_KEY to your .env.local file');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setIsComplete(false);
    setProcessedCount(0);
    setProgress(0);
    setCurrentStep('Initializing AI analysis...');
    setFailedVideos([]); // Reset failed videos list

    // Declare outside try block for error recovery access
    let analyzedResults: VideoResult[] = [];
    const failures: FailedVideo[] = [];

    try {
      const videosWithScenes = results.filter(r => 
        r.jsonData.scenes && 
        r.jsonData.scenes.length > 0 && 
        r.file.size > 0 // Skip history items with empty files
      );
      const totalVideos = videosWithScenes.length;
      
      if (totalVideos === 0) {
        setIsComplete(true);
        setIsAnalyzing(false);
        return;
      }

      const allAnalyses: { resultId: string; vibe: string; imagePrompts: string[]; videoPrompt: string }[] = [];

      // Process videos ONE BY ONE (sequential, not parallel)
      // This is more stable and prevents API overload
      for (let i = 0; i < videosWithScenes.length; i++) {
        const videoResult = videosWithScenes[i];
        const videoNumber = i + 1;
        
        try {
          // Step 1: Vibe Extraction (video file only)
          setCurrentStep(`🎨 Video ${videoNumber}/${totalVideos}: Extracting brand vibe from video...`);
          
          const formData = new FormData();
          formData.append('api_key', apiKey);
          formData.append('video', videoResult.file);
          
          const vibeResponse = await fetch('http://localhost:5001/api/gemini/vibe-extraction', {
            method: 'POST',
            body: formData
          });

          if (!vibeResponse.ok) {
            const errorData = await vibeResponse.json().catch(() => ({}));
            throw new Error(`Failed to extract vibe for ${videoResult.videoName}: ${errorData.error || 'Unknown error'}`);
          }

          const vibeData = await vibeResponse.json();

          // Check if vibe extraction failed
          if (vibeData.failed || !vibeData.vibe_extraction) {
            const failureReason = vibeData.error || "API returned no content";
            console.warn(`Skipping ${videoResult.videoName}: ${failureReason}`);
            failures.push({
              videoName: videoResult.videoName,
              reason: failureReason
            });
            setFailedVideos(prev => [...prev, { videoName: videoResult.videoName, reason: failureReason }]);
            setProcessedCount(videoNumber);
            setProgress(Math.floor((videoNumber / totalVideos) * 100));
            continue; // Skip to next video
          }

          // Step 2: Image Prompts (frames from scene detection)
          setCurrentStep(`🖼️ Video ${videoNumber}/${totalVideos}: Generating image prompts from frames...`);
          
          const imagePromptsResponse = await fetch('http://localhost:5001/api/gemini/image-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: apiKey,
              scenes: videoResult.jsonData.scenes!.map(scene => ({
                scene_index: scene.scene_index,
                frame_preview: scene.frame_preview,
                frame_path: (scene as any).frame_path
              }))
            })
          });

          if (!imagePromptsResponse.ok) {
            const errorData = await imagePromptsResponse.json().catch(() => ({}));
            throw new Error(`Failed to generate image prompts for ${videoResult.videoName}: ${errorData.error || 'Unknown error'}`);
          }

          const imagePromptsData = await imagePromptsResponse.json();

          // Step 3: Video Prompt (combines image prompts)
          setCurrentStep(`🎬 Video ${videoNumber}/${totalVideos}: Creating comprehensive video prompt...`);
          
          const videoPromptResponse = await fetch('http://localhost:5001/api/gemini/video-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: apiKey,
              image_prompts: imagePromptsData.image_prompts
            })
          });

          if (!videoPromptResponse.ok) {
            const errorData = await videoPromptResponse.json().catch(() => ({}));
            throw new Error(`Failed to generate video prompt for ${videoResult.videoName}: ${errorData.error || 'Unknown error'}`);
          }

          const videoPromptData = await videoPromptResponse.json();

          // Store analysis
          const analysis = {
            resultId: videoResult.id,
            vibe: vibeData.vibe_extraction,
            imagePrompts: imagePromptsData.image_prompts,
            videoPrompt: videoPromptData.video_prompt
          };

          const updatedResult: VideoResult = {
            ...videoResult,
            jsonData: {
              ...videoResult.jsonData,
              vibe_description: analysis.vibe,
              image_prompts: analysis.imagePrompts,
              video_prompt: analysis.videoPrompt
            }
          };

          allAnalyses.push(analysis);
          analyzedResults.push(updatedResult);
          setProcessedCount(videoNumber);
          setProgress(Math.floor((videoNumber / totalVideos) * 100));

          // Auto-save every 5 videos
          if (videoNumber % 5 === 0 || videoNumber === totalVideos) {
            setCurrentStep(`💾 Auto-saving progress (${videoNumber} videos completed)...`);
            onAutoSaveCSV(analyzedResults, `-progress-${videoNumber}`);
          }

        } catch (videoError) {
          // Log error and skip to next video
          const errorMsg = videoError instanceof Error ? videoError.message : 'Unknown error occurred';
          console.error(`Error processing video ${videoNumber}:`, errorMsg);
          failures.push({
            videoName: videoResult.videoName,
            reason: errorMsg
          });
          setFailedVideos(prev => [...prev, { videoName: videoResult.videoName, reason: errorMsg }]);
          setProcessedCount(videoNumber);
          setProgress(Math.floor((videoNumber / totalVideos) * 100));
          // Continue with next video instead of throwing
          continue;
        }
      }

      setProgress(100);
      
      // Set completion message based on failures
      if (failures.length > 0) {
        setCurrentStep(`⚠️ Completed with ${failures.length} failure(s). ${allAnalyses.length} video(s) analyzed successfully.`);
      } else {
        setCurrentStep('✨ All videos analyzed successfully!');
      }
      
      // Pass all analyses back to parent
      onAnalysisComplete(allAnalyses);
      setIsComplete(true);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Batch analysis error:', errorMessage);
      
      // Even if there's an error, save what we've analyzed so far
      if (analyzedResults.length > 0) {
        try {
          console.log('Attempting to save partial results after error...');
          onAutoSaveCSV(analyzedResults, '-partial-error-recovery');
          console.log(`Saved ${analyzedResults.length} videos before error`);
        } catch (saveError) {
          console.error('Emergency save failed:', saveError);
        }
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const videosWithScenes = results.filter(r => 
    r.jsonData.scenes && 
    r.jsonData.scenes.length > 0 && 
    r.file.size > 0 // Skip history items with empty files
  );
  const totalVideos = videosWithScenes.length;

  if (totalVideos === 0) {
    return null;
  }

  return (
    <div 
      className="w-full h-[600px] rounded-2xl overflow-hidden transition-all duration-500"
      style={{
        background: isAnalyzing 
          ? 'linear-gradient(135deg, rgba(255,107,157,0.08) 0%, rgba(196,69,105,0.08) 25%, rgba(169,67,228,0.08) 50%, rgba(77,157,224,0.08) 75%, rgba(123,201,255,0.08) 100%)'
          : isComplete
          ? 'linear-gradient(135deg, rgba(95,227,161,0.08) 0%, rgba(107,207,127,0.08) 50%, rgba(77,157,224,0.08) 100%)'
          : 'linear-gradient(135deg, rgba(169,67,228,0.05) 0%, rgba(77,157,224,0.05) 100%)',
        border: isAnalyzing 
          ? '2px solid rgba(169,67,228,0.3)'
          : isComplete
          ? '2px solid rgba(95,227,161,0.3)'
          : '2px solid rgba(169,67,228,0.15)',
        boxShadow: isAnalyzing 
          ? '0 20px 60px rgba(169,67,228,0.15), 0 0 40px rgba(77,157,224,0.1)'
          : isComplete
          ? '0 20px 60px rgba(95,227,161,0.15)'
          : '0 10px 40px rgba(0,0,0,0.05)'
      }}
    >
      {/* Header */}
      <div 
        className="px-8 py-6 border-b transition-all duration-300"
        style={{
          background: isAnalyzing
            ? 'linear-gradient(90deg, rgba(255,107,157,0.12) 0%, rgba(169,67,228,0.12) 50%, rgba(77,157,224,0.12) 100%)'
            : isComplete
            ? 'linear-gradient(90deg, rgba(95,227,161,0.12) 0%, rgba(107,207,127,0.12) 100%)'
            : 'rgba(255,255,255,0.6)',
          borderColor: isAnalyzing ? 'rgba(169,67,228,0.2)' : isComplete ? 'rgba(95,227,161,0.2)' : 'rgba(0,0,0,0.05)'
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-3">
              <span className="text-2xl">
                {isAnalyzing ? '⚡' : isComplete ? '✨' : '🎯'}
              </span>
              <span>AI Video Analysis</span>
              {isComplete && (
                <span className="ml-2 px-3 py-1 text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-sm">
                  Complete
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 mt-1 ml-11">
              {isAnalyzing 
                ? `Analyzing ${totalVideos} ${totalVideos === 1 ? 'video' : 'videos'}...` 
                : isComplete
                ? `${totalVideos} ${totalVideos === 1 ? 'video' : 'videos'} analyzed successfully`
                : `Ready to analyze ${totalVideos} ${totalVideos === 1 ? 'video' : 'videos'}`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="h-[calc(100%-88px)] flex flex-col items-center justify-center p-8">
        {error ? (
          <div className="text-center space-y-4">
            <div className="text-6xl">❌</div>
            <p className="text-sm text-red-700 max-w-md">{error}</p>
            <button
              onClick={handleBatchAnalyze}
              className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all duration-200"
            >
              Retry Analysis
            </button>
          </div>
        ) : isAnalyzing ? (
          <div className="text-center space-y-8 w-full max-w-lg">
            {/* Spinning Gemini Logo */}
            <div className="flex justify-center">
              <GeminiLogo size={120} isAnimating={true} />
            </div>

            {/* Status Text */}
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900 animate-pulse">
                {currentStep}
              </p>
              <p className="text-sm text-gray-600">
                {processedCount} of {totalVideos} videos completed
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full">
              <div className="relative w-full h-3 bg-white/60 rounded-full overflow-hidden shadow-inner backdrop-blur-sm">
                <div 
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #FF6B9D 0%, #C44569 25%, #A943E4 50%, #4D9DE0 75%, #7BC9FF 100%)',
                    boxShadow: '0 0 20px rgba(169,67,228,0.5)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">Processing...</span>
                <span className="text-sm font-bold text-gray-700">{progress}%</span>
              </div>
            </div>

            {/* Animated Dots */}
            <div className="flex justify-center space-x-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{
                    background: 'linear-gradient(135deg, #A943E4, #4D9DE0)',
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: '1s'
                  }}
                />
              ))}
            </div>
          </div>
        ) : isComplete ? (
          <div className="text-center space-y-6 max-w-2xl">
            {/* Static Gemini Logo */}
            <div className="flex justify-center">
              <GeminiLogo size={100} isAnimating={false} />
            </div>
            
            <div className="space-y-2">
              <p className="text-2xl font-bold text-gray-900">
                {failedVideos.length > 0 ? 'Analysis Complete with Warnings' : 'Analysis Complete!'}
              </p>
              <p className="text-base text-gray-600">
                {totalVideos - failedVideos.length} of {totalVideos} {totalVideos === 1 ? 'video' : 'videos'} successfully analyzed
              </p>
              {failedVideos.length === 0 && (
                <p className="text-sm text-gray-500 max-w-md mx-auto mt-4">
                  Video analysis has been completed for all videos. Export your CSV to view the complete results.
                </p>
              )}
            </div>

            {/* Success or Warning Icon */}
            {failedVideos.length === 0 ? (
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            )}

            {/* Failed Videos List */}
            {failedVideos.length > 0 && (
              <div className="mt-6 p-6 bg-red-50 border-2 border-red-200 rounded-xl text-left max-h-80 overflow-y-auto">
                <h4 className="text-lg font-bold text-red-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Failed Videos ({failedVideos.length})
                </h4>
                <div className="space-y-3">
                  {failedVideos.map((failed, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-lg border border-red-200 shadow-sm">
                      <p className="font-semibold text-gray-900 mb-1">📹 {failed.videoName}</p>
                      <p className="text-sm text-red-700">
                        <strong>Reason:</strong> {failed.reason}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-700 mt-4 italic">
                  These videos were skipped and won't appear in the exported CSV.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-6">
            {/* Static Gemini Logo */}
            <div className="flex justify-center opacity-60">
              <GeminiLogo size={100} isAnimating={false} />
            </div>
            
            <div className="space-y-2">
              <p className="text-xl font-semibold text-gray-900">
                Waiting to Start...
              </p>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                AI analysis will begin automatically once all videos are loaded.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchGeminiAnalysis;

