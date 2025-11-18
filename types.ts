export enum ProgressStage {
  IDLE,
  UPLOADING,
  ANALYZING,
  DETECTING,
  EXPORTING,
  DONE,
}

export interface Clip {
  index: number;
  duration: number;
  required: boolean;
}

export interface Transition {
  type: string;
  duration: number;
  between_clips: [number, number];
}

export interface SceneData {
  scene_index: number;
  frame_preview: string; // Base64 encoded image (PNG)
}

export interface OutputJson {
  name: string;
  clips: Clip[];
  transitions: Transition[];
  logo_outro: boolean;
  music_file: string;
  fade_in_duration: number;
  fade_out_duration: number;
  scenes?: SceneData[]; // Optional for backward compatibility
  vibe_description?: string; // Gemini AI vibe extraction
  image_prompts?: string[]; // Gemini AI image prompts for each frame
  video_prompt?: string; // Gemini AI video prompt
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  videoName: string;
  jsonData: OutputJson;
}

export interface VideoResult {
  id: string;
  videoName: string;
  jsonData: OutputJson;
  file: File;
}
