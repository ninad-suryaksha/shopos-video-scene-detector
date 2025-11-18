import React from 'react';
import Icon from './Icon';
import type { VideoResult } from '../types';

interface DownloadAllAnalysesButtonProps {
  results: VideoResult[];
  analysesData: Map<string, { vibe: string; imagePrompts: string[]; videoPrompt: string }>;
}

const DownloadAllAnalysesButton: React.FC<DownloadAllAnalysesButtonProps> = ({ results, analysesData }) => {
  const hasAnyAnalysis = results.some(result => analysesData.has(result.id));

  const downloadAllAnalyses = () => {
    if (!hasAnyAnalysis) return;

    let allContent = `GEMINI AI ANALYSIS - BATCH EXPORT
Generated: ${new Date().toLocaleString()}
Total Videos: ${results.length}
Videos with Analysis: ${Array.from(analysesData.keys()).length}

${'='.repeat(100)}
`;

    results.forEach((result, index) => {
      const analysis = analysesData.get(result.id);
      
      allContent += `\n\n${'#'.repeat(100)}
VIDEO ${index + 1}: ${result.videoName}
${'#'.repeat(100)}

`;

      if (analysis) {
        allContent += `
${'='.repeat(80)}
BRAND VIBE EXTRACTION
${'='.repeat(80)}

${analysis.vibe}

${'='.repeat(80)}
FRAME-BY-FRAME IMAGE PROMPTS
${'='.repeat(80)}

${analysis.imagePrompts.map((prompt, idx) => `Scene ${idx + 1}:\n${prompt}`).join('\n\n' + '-'.repeat(80) + '\n\n')}

${'='.repeat(80)}
VIDEO PROMPT
${'='.repeat(80)}

${analysis.videoPrompt}
`;
      } else {
        allContent += `
[No Gemini analysis available for this video]
`;
      }
    });

    const blob = new Blob([allContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    link.href = url;
    link.download = `gemini_analyses_batch_${timestamp}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!hasAnyAnalysis) {
    return null;
  }

  return (
    <button
      onClick={downloadAllAnalyses}
      className="fixed top-[77px] right-6 sm:top-[93px] sm:right-8 flex items-center space-x-2 px-4 py-2.5 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200 z-40 bg-purple-600 hover:bg-purple-700"
      aria-label="Download all Gemini analyses"
    >
      <Icon type="sparkles" className="w-5 h-5" />
      <span className="hidden sm:inline">Export Analyses</span>
    </button>
  );
};

export default DownloadAllAnalysesButton;





