import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import type { SceneData } from '../types';

interface GeminiAnalysisProps {
  scenes: SceneData[];
  videoFile: File;
  videoName: string;
  onAnalysisComplete?: (vibe: string, imagePrompts: string[], videoPrompt: string) => void;
}

interface AnalysisResults {
  vibeExtraction: string;
  imagePrompts: string[];
  videoPrompt: string;
}

const GeminiAnalysis: React.FC<GeminiAnalysisProps> = ({ scenes, videoFile, videoName, onAnalysisComplete }) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [expandedContainer, setExpandedContainer] = useState<number | null>(null);
  
  // Load API key from environment variable
  useEffect(() => {
    // In a real Vite app, use import.meta.env.VITE_GEMINI_API_KEY
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    setApiKey(envApiKey);
  }, []);
  
  // Auto-start analysis when API key is available and scenes exist
  useEffect(() => {
    if (apiKey && scenes.length > 0 && !analysisResults && !isAnalyzing && !error) {
      handleAnalyze();
    }
  }, [apiKey, scenes]);

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
      setError('Gemini API key not found. Please add VITE_GEMINI_API_KEY to your .env.local file');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResults(null);
    setCurrentStep('Step 1/4: Preparing video for AI analysis...');

    try {
      // Process ONE BY ONE (sequential, not parallel)
      
      // Step 1: Vibe Extraction (video file only)
      setCurrentStep('Step 1/3: Extracting brand vibe from video... 🎨');
      
      const formData = new FormData();
      formData.append('api_key', apiKey);
      formData.append('video', videoFile);
      
      const vibeResponse = await fetch('http://localhost:5001/api/gemini/vibe-extraction', {
        method: 'POST',
        body: formData
      });

      if (!vibeResponse.ok) {
        const errorData = await vibeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract vibe');
      }

      const vibeData = await vibeResponse.json();

      // Step 2: Image Prompts (frames from scene detection)
      setCurrentStep('Step 2/3: Generating image prompts for each frame... 🖼️');
      
      const imagePromptsResponse = await fetch('http://localhost:5001/api/gemini/image-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          scenes: scenes.map(scene => ({
            scene_index: scene.scene_index,
            frame_preview: scene.frame_preview,
            frame_path: (scene as any).frame_path
          }))
        })
      });

      if (!imagePromptsResponse.ok) {
        const errorData = await imagePromptsResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate image prompts');
      }

      const imagePromptsData = await imagePromptsResponse.json();

      // Step 3: Video Prompt (combines image prompts)
      setCurrentStep('Step 3/3: Synthesizing comprehensive video prompt... 🎬');
      
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
        throw new Error(errorData.error || 'Failed to generate video prompt');
      }

      const videoPromptData = await videoPromptResponse.json();

      setCurrentStep('✨ Analysis complete!');
      
      const results = {
        vibeExtraction: vibeData.vibe_extraction,
        imagePrompts: imagePromptsData.image_prompts,
        videoPrompt: videoPromptData.video_prompt
      };
      
      setAnalysisResults(results);
      
      // Pass results to parent
      if (onAnalysisComplete) {
        onAnalysisComplete(results.vibeExtraction, results.imagePrompts, results.videoPrompt);
      }
      
      // Auto-expand the first section
      setExpandedContainer(1);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Analysis error:', errorMessage);
    } finally {
      setIsAnalyzing(false);
      setCurrentStep('');
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
      console.log(`${type} copied to clipboard`);
    });
  };

  const downloadAsText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  // Helper to clean markdown formatting (remove ** **)
  const cleanMarkdown = (text: string): string => {
    return text.replace(/\*\*/g, '');
  };

  const toggleContainer = (index: number) => {
    setExpandedContainer(expandedContainer === index ? null : index);
  };

  if (!scenes || scenes.length === 0) {
    return null;
  }

  return (
    <div className={`w-full bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-300 ${
      isAnalyzing ? 'border-purple-400 shadow-lg shadow-purple-100' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b transition-all duration-300 ${
        isAnalyzing 
          ? 'bg-gradient-to-r from-purple-100 via-pink-50 to-blue-100 border-purple-200' 
          : analysisResults
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
          : 'bg-gradient-to-r from-purple-50 to-blue-50 border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <span className={`text-2xl ${isAnalyzing ? 'animate-pulse' : ''}`}>
                {isAnalyzing ? '⚡' : analysisResults ? '✅' : '✨'}
              </span>
              <span>Gemini 2.5 Flash Analysis</span>
              {analysisResults && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-600 text-white rounded-full">
                  Complete
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 mt-0.5">
              {isAnalyzing 
                ? '🔄 AI analysis in progress...' 
                : analysisResults
                ? 'Analysis complete • Expand sections below to view results'
                : 'AI-powered video analysis and generation'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Progress Indicator - Enhanced */}
      {isAnalyzing && (
        <div className="px-6 py-6 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 border-b border-purple-200 animate-in fade-in slide-in-from-top-4">
          <div className="space-y-4">
            {/* Main Status with Spinner */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-200"></div>
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-transparent border-t-purple-600 absolute top-0 left-0"></div>
                </div>
                <div>
                  <p className="text-base font-semibold text-purple-900">{currentStep || 'Processing...'}</p>
                  <p className="text-xs text-purple-600 mt-0.5">AI analysis in progress</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-700">
                  {currentStep.includes('complete') ? '100%' :
                   currentStep.includes('Step 1') ? '33%' : 
                   currentStep.includes('Step 2') ? '66%' : 
                   currentStep.includes('Step 3') ? '90%' : '0%'}
                </p>
                <p className="text-xs text-purple-600">Complete</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-3 bg-purple-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out shadow-lg ${
                  currentStep.includes('complete') 
                    ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600' 
                    : 'bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600'
                }`}
                style={{
                  width: currentStep.includes('complete') ? '100%' :
                         currentStep.includes('Step 1') ? '33%' : 
                         currentStep.includes('Step 2') ? '66%' : 
                         currentStep.includes('Step 3') ? '90%' : '5%'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
              </div>
            </div>

            {/* Steps Indicator */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { step: 1, label: 'Vibe', icon: '🎨' },
                { step: 2, label: 'Images', icon: '🖼️' },
                { step: 3, label: 'Video', icon: '🎬' }
              ].map((item) => {
                const isComplete = currentStep.includes('complete') || 
                                   (currentStep.includes('Step 3') && item.step <= 2) ||
                                   (currentStep.includes('Step 2') && item.step === 1);
                const isActive = currentStep.includes(`Step ${item.step}`) && !currentStep.includes('complete');
                
                return (
                  <div
                    key={item.step}
                    className={`flex flex-col items-center p-2 rounded-lg transition-all duration-300 ${
                      isActive 
                        ? 'bg-purple-600 text-white scale-105 shadow-lg' 
                        : isComplete
                        ? 'bg-green-100 text-green-700'
                        : 'bg-white text-gray-400'
                    }`}
                  >
                    <span className="text-xl mb-1">{isComplete ? '✓' : item.icon}</span>
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && !isAnalyzing && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-100">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700">❌ {error}</p>
            <button
              onClick={() => {
                setError(null);
                handleAnalyze();
              }}
              className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResults && (
        <div className="p-6 space-y-4">
          {/* Container 1: Vibe Extraction */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div 
              className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-pink-50 to-purple-50 cursor-pointer hover:from-pink-100 hover:to-purple-100 transition-colors"
              onClick={() => toggleContainer(1)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🎨</span>
                <div>
                  <h4 className="text-md font-semibold text-gray-900">Vibe Description</h4>
                  <p className="text-xs text-gray-600">Brand identity analysis</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(cleanMarkdown(analysisResults.vibeExtraction), 'Vibe Description');
                  }}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  <Icon type="copy" className="w-4 h-4 text-gray-600" />
                </button>
                <Icon 
                  type={expandedContainer === 1 ? "chevronUp" : "chevronDown"} 
                  className="w-5 h-5 text-gray-600" 
                />
              </div>
            </div>
            {expandedContainer === 1 && (
              <div className="p-4 bg-gray-900 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-100 whitespace-pre-wrap font-mono leading-relaxed">
                  {cleanMarkdown(analysisResults.vibeExtraction)}
                </pre>
              </div>
            )}
          </div>

          {/* Container 2: Image Prompts */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div 
              className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 cursor-pointer hover:from-blue-100 hover:to-cyan-100 transition-colors"
              onClick={() => toggleContainer(2)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🖼️</span>
                <div>
                  <h4 className="text-md font-semibold text-gray-900">Image Prompts</h4>
                  <p className="text-xs text-gray-600">{analysisResults.imagePrompts.length} frames</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const allPrompts = analysisResults.imagePrompts
                      .map((prompt, idx) => `Frame ${idx + 1}:\n${cleanMarkdown(prompt)}`)
                      .join('\n\n');
                    copyToClipboard(allPrompts, 'Image Prompts');
                  }}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                  title="Copy all prompts"
                >
                  <Icon type="copy" className="w-4 h-4 text-gray-600" />
                </button>
                <Icon 
                  type={expandedContainer === 2 ? "chevronUp" : "chevronDown"} 
                  className="w-5 h-5 text-gray-600" 
                />
              </div>
            </div>
            {expandedContainer === 2 && (
              <div className="p-4 bg-gray-900 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-100 whitespace-pre-wrap font-mono leading-relaxed">
                  {analysisResults.imagePrompts.map((prompt, idx) => 
                    `Image prompt - Frame ${idx + 1}:\n${cleanMarkdown(prompt)}`
                  ).join('\n\n' + '-'.repeat(60) + '\n\n')}
                </pre>
              </div>
            )}
          </div>

          {/* Container 3: Video Prompt */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div 
              className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 cursor-pointer hover:from-green-100 hover:to-emerald-100 transition-colors"
              onClick={() => toggleContainer(3)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🎬</span>
                <div>
                  <h4 className="text-md font-semibold text-gray-900">Video Prompt</h4>
                  <p className="text-xs text-gray-600">Complete video guide</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(cleanMarkdown(analysisResults.videoPrompt), 'Video Prompt');
                  }}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  <Icon type="copy" className="w-4 h-4 text-gray-600" />
                </button>
                <Icon 
                  type={expandedContainer === 3 ? "chevronUp" : "chevronDown"} 
                  className="w-5 h-5 text-gray-600" 
                />
              </div>
            </div>
            {expandedContainer === 3 && (
              <div className="p-4 bg-gray-900 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-100 whitespace-pre-wrap font-mono leading-relaxed">
                  {cleanMarkdown(analysisResults.videoPrompt)}
                </pre>
              </div>
            )}
          </div>

          {/* Analyze Again Button */}
          <div className="flex justify-center">
            <button
              onClick={() => {
                setAnalysisResults(null);
                setError(null);
                handleAnalyze();
              }}
              className="px-6 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Re-analyze
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeminiAnalysis;

