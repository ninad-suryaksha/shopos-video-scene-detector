import React from 'react';

interface AnalysisInsightsProps {
  title: string;
  summary: string;
}

const AnalysisInsights: React.FC<AnalysisInsightsProps> = ({ title, summary }) => {
  return (
    <div className="w-full bg-white border-2 border-black rounded-lg p-6 space-y-6">
      <h2 className="text-2xl font-bold text-center mb-4">Video Insights</h2>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-black">Suggested Title</h3>
        <p className="bg-black/5 p-3 rounded-md text-black italic">"{title}"</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-black">Content Summary</h3>
        <p className="bg-black/5 p-3 rounded-md text-black text-justify">{summary}</p>
      </div>
    </div>
  );
};

export default AnalysisInsights;
