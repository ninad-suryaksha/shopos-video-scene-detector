import React from 'react';
import { ProgressStage } from '../types';

interface ProgressBarProps {
  currentStage: ProgressStage;
}

const STAGES = [
  { id: ProgressStage.UPLOADING, label: 'Upload' },
  { id: ProgressStage.ANALYZING, label: 'Gemini Analysis' },
  { id: ProgressStage.DETECTING, label: 'Scene Detection' },
  { id: ProgressStage.EXPORTING, label: 'JSON Export' },
];

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStage }) => {
  const currentStageIndex = STAGES.findIndex(stage => stage.id === currentStage);
  
  return (
    <div className="w-full">
      <div className="flex items-start justify-between relative px-2">
        <div className="absolute top-2 left-0 w-full h-0.5 bg-gray-200" />
        <div 
          className="absolute top-2 left-0 h-0.5 bg-gray-500 transition-all duration-500"
          style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
        />
        {STAGES.map((stage, index) => {
          const isCompleted = currentStage === ProgressStage.DONE || index < currentStageIndex;
          const isActive = index === currentStageIndex;
          
          return (
            <div key={stage.id} className="z-10 flex flex-col items-center w-24">
              <div
                className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${isCompleted ? 'bg-gray-500 border-gray-500' : 'bg-white border-gray-300'}`}
              />
              <p className={`mt-3 text-xs sm:text-sm text-center font-medium transition-opacity duration-300 ${isActive || isCompleted ? 'text-gray-700' : 'text-gray-400'}`}>
                {stage.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressBar;