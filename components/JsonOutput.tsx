import React, { useState, useEffect } from 'react';
import { OutputJson } from '../types';
import Icon from './Icon';

interface JsonOutputProps {
  jsonData: OutputJson;
}

const JsonOutput: React.FC<JsonOutputProps> = ({ jsonData }) => {
  const [copied, setCopied] = useState(false);
  
  // Ensure field order matches specification
  // Clips: index → duration → required
  // Transitions: type → duration → between_clips
  // Main: name → clips → transitions → logo_outro → music_file → fade_in_duration → fade_out_duration
  const orderedJson = {
    name: jsonData.name,
    clips: jsonData.clips.map(clip => ({
      index: clip.index,
      duration: clip.duration,
      required: clip.required
    })),
    transitions: jsonData.transitions.map(transition => ({
      type: transition.type,
      duration: transition.duration,
      between_clips: transition.between_clips
    })),
    logo_outro: jsonData.logo_outro,
    music_file: jsonData.music_file,
    fade_in_duration: jsonData.fade_in_duration,
    fade_out_duration: jsonData.fade_out_duration
  };
  
  // Custom replacer to ensure numbers are displayed with at least one decimal place
  const jsonString = JSON.stringify(orderedJson, (key, value) => {
    // Format numbers to always show decimal point (e.g., 0 becomes 0.0)
    if (typeof value === 'number') {
      // If it's a whole number, add .0, otherwise keep as is
      return Number.isInteger(value) ? value.toFixed(1) : value;
    }
    return value;
  }, 2)
    // Remove quotes around numeric strings to make them proper numbers in JSON
    .replace(/"(-?\d+\.\d+)"/g, '$1');

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
    });
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">JSON Output</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {jsonData.clips.length} clips • {jsonData.transitions.length} transitions
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors duration-200 shadow-sm"
          aria-label="Copy JSON"
        >
          {copied ? (
            <>
              <Icon type="check" className="w-4 h-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Icon type="copy" className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* JSON Content - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
        <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
};

export default JsonOutput;