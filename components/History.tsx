import React, { useState, useMemo } from 'react';
import { HistoryItem, OutputJson } from '../types';
import Icon from './Icon';

interface HistoryProps {
  historyItems: HistoryItem[];
  onDelete: (id: string) => void;
  onView: (jsonData: OutputJson, videoName: string) => void;
  onClose: () => void;
}

type SortOrder = 'ascending' | 'descending';

const History: React.FC<HistoryProps> = ({ historyItems, onDelete, onView, onClose }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('descending');

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Sort history items based on sort order
  const sortedHistoryItems = useMemo(() => {
    const items = [...historyItems];
    if (sortOrder === 'ascending') {
      return items.sort((a, b) => a.timestamp - b.timestamp);
    } else {
      return items.sort((a, b) => b.timestamp - a.timestamp);
    }
  }, [historyItems, sortOrder]);

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'ascending' ? 'descending' : 'ascending');
  };

  // Export history to CSV
  const exportToCSV = () => {
    if (sortedHistoryItems.length === 0) return;

    // CSV Headers
    const headers = [
      'Filename',
      'Date',
      'Time',
      'Clips Count',
      'Total Duration (s)',
      'Transitions Count',
      'Logo/Outro',
      'Music File',
      'JSON Data'
    ];

    // Convert items to CSV rows
    const rows = sortedHistoryItems.map(item => {
      const date = new Date(item.timestamp);
      const totalDuration = item.jsonData.clips.reduce((acc, clip) => acc + clip.duration, 0);
      
      // Ensure JSON field order
      // Clips: index → duration → required
      // Transitions: type → duration → between_clips
      // Main: name → clips → transitions → logo_outro → music_file → fade_in_duration → fade_out_duration
      const orderedJson = {
        name: item.jsonData.name,
        clips: item.jsonData.clips.map(clip => ({
          index: clip.index,
          duration: clip.duration,
          required: clip.required
        })),
        transitions: item.jsonData.transitions.map(transition => ({
          type: transition.type,
          duration: transition.duration,
          between_clips: transition.between_clips
        })),
        logo_outro: item.jsonData.logo_outro,
        music_file: item.jsonData.music_file,
        fade_in_duration: item.jsonData.fade_in_duration,
        fade_out_duration: item.jsonData.fade_out_duration
      };
      
      // Custom stringifier to ensure numbers show decimal point (e.g., 0 becomes 0.0)
      const jsonStringWithDecimals = JSON.stringify(orderedJson, (key, value) => {
        if (typeof value === 'number') {
          return Number.isInteger(value) ? value.toFixed(1) : value;
        }
        return value;
      }).replace(/"(-?\d+\.\d+)"/g, '$1');
      
      return [
        item.videoName,
        date.toLocaleDateString('en-US'),
        date.toLocaleTimeString('en-US'),
        item.jsonData.clips.length.toString(),
        totalDuration.toFixed(2),
        item.jsonData.transitions.length.toString(),
        item.jsonData.logo_outro ? 'Yes' : 'No',
        item.jsonData.music_file || 'None',
        jsonStringWithDecimals
      ];
    });

    // Escape CSV values (handle commas, quotes, newlines)
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
    link.setAttribute('download', `video-scene-detector-history-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6">
      <div className="relative w-full max-w-3xl h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">History</h2>
            <p className="text-sm text-gray-500 mt-0.5">{historyItems.length} {historyItems.length === 1 ? 'item' : 'items'}</p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Sort Button */}
            <button
              onClick={toggleSortOrder}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition-colors duration-200 border border-gray-300 shadow-sm"
              aria-label={`Sort ${sortOrder === 'ascending' ? 'descending' : 'ascending'}`}
              title={`Currently: ${sortOrder === 'ascending' ? 'Oldest first' : 'Newest first'}`}
            >
              <Icon type={sortOrder === 'ascending' ? 'sortAscending' : 'sortDescending'} className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">
                {sortOrder === 'ascending' ? 'Oldest First' : 'Newest First'}
              </span>
            </button>
            
            {/* Export CSV Button */}
            <button
              onClick={exportToCSV}
              disabled={historyItems.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-black transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
              aria-label="Export to CSV"
            >
              <Icon type="download" className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Export CSV</span>
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              aria-label="Close history"
            >
              <Icon type="close" className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {historyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Icon type="history" className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900">No history yet</p>
              <p className="text-sm text-gray-500 mt-1">Your generated JSONs will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedHistoryItems.map((item) => (
                <div
                  key={item.id}
                  className="group bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {item.videoName}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500">
                        <span>{formatDate(item.timestamp)}</span>
                        <span>•</span>
                        <span>{formatTime(item.timestamp)}</span>
                        <span>•</span>
                        <span>{item.jsonData.clips.length} clips</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                        aria-label="Toggle preview"
                      >
                        <Icon 
                          type={expandedId === item.id ? "chevronUp" : "chevronDown"} 
                          className="w-5 h-5 text-gray-600" 
                        />
                      </button>
                      <button
                        onClick={() => onView(item.jsonData, item.videoName)}
                        className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors duration-200"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
                        aria-label="Delete"
                      >
                        <Icon type="trash" className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Preview */}
                  {expandedId === item.id && (
                    <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 font-medium mb-1">Duration</p>
                          <p className="text-gray-900">
                            {item.jsonData.clips.reduce((acc, clip) => acc + clip.duration, 0).toFixed(2)}s
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium mb-1">Transitions</p>
                          <p className="text-gray-900">{item.jsonData.transitions.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium mb-1">Logo/Outro</p>
                          <p className="text-gray-900">{item.jsonData.logo_outro ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium mb-1">Music</p>
                          <p className="text-gray-900 truncate">{item.jsonData.music_file || 'None'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;

