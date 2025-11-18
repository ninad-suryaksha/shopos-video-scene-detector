import type { OutputJson } from '../types';

// Backend API URL - Railway deployment
const API_BASE_URL = 'https://shopos-video-scene-detector-production.up.railway.app/api';

export const analyzeVideoForScenes = async (videoFile: File, threshold: number = 15): Promise<OutputJson> => {
  try {
    // Create FormData to send video file
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('threshold', threshold.toString()); // Lower = more sensitive detection

    // Send video to Python backend for scene analysis
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const jsonData = await response.json();
    return jsonData as OutputJson;

  } catch (error) {
    console.error("Error analyzing video:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to analyze video: ${error.message}`);
    }
    throw new Error('An unknown error occurred during video analysis.');
  }
};


export const editJson = async (currentJson: OutputJson, prompt: string): Promise<OutputJson> => {
    try {
        // Send JSON and edit prompt to backend
        const response = await fetch(`${API_BASE_URL}/edit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                json_data: currentJson,
                prompt: prompt,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const jsonData = await response.json();
        return jsonData as OutputJson;

    } catch (error) {
        console.error("Error editing JSON:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to edit JSON: ${error.message}`);
        }
        throw new Error('An unknown error occurred during JSON editing.');
    }
}