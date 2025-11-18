import React from 'react';
import { OutputJson } from '../types';
import JsonOutput from './JsonOutput';

interface JsonEditorProps {
  jsonData: OutputJson;
}

const JsonEditor: React.FC<JsonEditorProps> = ({ jsonData }) => {
  return (
    <div className="w-full h-full">
      <JsonOutput jsonData={jsonData} />
    </div>
  );
};

export default JsonEditor;