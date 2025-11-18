from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
from scenedetect import VideoManager, SceneManager
from scenedetect.detectors import ContentDetector
from werkzeug.utils import secure_filename
import tempfile
import shutil
import base64
from moviepy.editor import VideoFileClip
import time
import random
from functools import wraps
import socket
import ssl
from urllib3.exceptions import ProtocolError
from requests.exceptions import ConnectionError, Timeout, SSLError

app = Flask(__name__)
CORS(app)

# ===== COMPREHENSIVE ERROR HANDLING AND RETRY LOGIC =====

def retry_with_exponential_backoff(
    max_retries=5,
    initial_delay=1.0,
    max_delay=60.0,
    exponential_base=2.0,
    jitter=True,
    retryable_exceptions=(Exception,)
):
    """
    Decorator that retries a function with exponential backoff and jitter.
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        exponential_base: Base for exponential backoff calculation
        jitter: Whether to add random jitter to prevent thundering herd
        retryable_exceptions: Tuple of exceptions that should trigger a retry
    
    Returns:
        Decorated function with retry logic
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e
                    error_msg = str(e).lower()
                    
                    # Check if this is a retryable error
                    is_retryable = (
                        'ssl' in error_msg or
                        'unexpected_eof' in error_msg or
                        'broken pipe' in error_msg or
                        'timed out' in error_msg or
                        'timeout' in error_msg or
                        'connection' in error_msg or
                        'unable to find the server' in error_msg or
                        'eof occurred in violation of protocol' in error_msg or
                        'errno 32' in error_msg or
                        'temporarily unavailable' in error_msg or
                        'service unavailable' in error_msg or
                        'rate limit' in error_msg or
                        'quota' in error_msg
                    )
                    
                    # Don't retry on the last attempt or non-retryable errors
                    if attempt == max_retries or not is_retryable:
                        print(f"❌ Final attempt failed: {str(e)}")
                        raise
                    
                    # Calculate delay with exponential backoff
                    if jitter:
                        # Add random jitter (50-150% of calculated delay)
                        jitter_factor = 0.5 + random.random()
                        actual_delay = min(delay * jitter_factor, max_delay)
                    else:
                        actual_delay = min(delay, max_delay)
                    
                    print(f"⚠️  Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                    print(f"   Retrying in {actual_delay:.2f} seconds...")
                    
                    time.sleep(actual_delay)
                    
                    # Increase delay for next attempt
                    delay *= exponential_base
            
            # This should never be reached, but just in case
            raise last_exception
        
        return wrapper
    return decorator

class RateLimiter:
    """
    Simple rate limiter to prevent overwhelming the API with parallel requests.
    """
    def __init__(self, max_requests_per_second=5):
        self.max_requests_per_second = max_requests_per_second
        self.last_request_time = 0
        self.lock = None  # Will be set in __enter__
    
    def __enter__(self):
        import threading
        if self.lock is None:
            self.lock = threading.Lock()
        
        with self.lock:
            current_time = time.time()
            time_since_last_request = current_time - self.last_request_time
            min_interval = 1.0 / self.max_requests_per_second
            
            if time_since_last_request < min_interval:
                sleep_time = min_interval - time_since_last_request
                time.sleep(sleep_time)
            
            self.last_request_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

# Global rate limiter for Gemini API calls (5 requests per second)
gemini_rate_limiter = RateLimiter(max_requests_per_second=5)

class CircuitBreaker:
    """
    Circuit breaker pattern to prevent overwhelming the API when errors persist.
    States: CLOSED (normal), OPEN (blocking requests), HALF_OPEN (testing recovery)
    """
    def __init__(self, failure_threshold=10, recovery_timeout=60, success_threshold=3):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        
        import threading
        self.lock = threading.Lock()
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        with self.lock:
            # Check if circuit should move from OPEN to HALF_OPEN
            if self.state == "OPEN":
                if time.time() - self.last_failure_time >= self.recovery_timeout:
                    print(f"🔄 Circuit breaker entering HALF_OPEN state (testing recovery)")
                    self.state = "HALF_OPEN"
                    self.success_count = 0
                else:
                    raise Exception(f"Circuit breaker is OPEN. Too many recent failures. Try again in {int(self.recovery_timeout - (time.time() - self.last_failure_time))} seconds.")
        
        try:
            result = func(*args, **kwargs)
            
            with self.lock:
                # Record success
                if self.state == "HALF_OPEN":
                    self.success_count += 1
                    if self.success_count >= self.success_threshold:
                        print(f"✅ Circuit breaker CLOSED (service recovered)")
                        self.state = "CLOSED"
                        self.failure_count = 0
                elif self.state == "CLOSED":
                    self.failure_count = max(0, self.failure_count - 1)  # Slowly reduce failure count on success
            
            return result
            
        except Exception as e:
            with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.failure_count >= self.failure_threshold:
                    if self.state != "OPEN":
                        print(f"⚠️  Circuit breaker OPEN (too many failures: {self.failure_count})")
                    self.state = "OPEN"
                elif self.state == "HALF_OPEN":
                    # Failed during recovery test
                    print(f"⚠️  Circuit breaker back to OPEN (recovery test failed)")
                    self.state = "OPEN"
                    self.success_count = 0
            
            raise

# Global circuit breaker for Gemini API (opens after 10 failures, closes after 3 successes)
gemini_circuit_breaker = CircuitBreaker(
    failure_threshold=10,
    recovery_timeout=120,  # Wait 2 minutes before testing recovery
    success_threshold=3
)

# Configure upload settings
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'mpeg', 'mpg'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def timecode_to_seconds(timecode):
    """Convert timecode object to total seconds as float."""
    return timecode.get_seconds()

def seconds_to_frame_notation(total_seconds, fps=30):
    """
    Convert total seconds to SECONDS.FRAMES notation.
    
    In this format:
    - Integer part = seconds
    - Decimal part = frame number (00-29 for 30fps)
    
    For 30fps:
    - 0.00 = 0 seconds, frame 0
    - 0.29 = 0 seconds, frame 29
    - 1.00 = 1 second, frame 0 (NOT 0.30!)
    - 1.15 = 1 second, frame 15
    - 5.29 = 5 seconds, frame 29
    - 6.00 = 6 seconds, frame 0
    
    Args:
        total_seconds: Time in seconds (float)
        fps: Frames per second (default: 30)
    
    Returns:
        Frame notation as SS.FF (float)
    """
    # Convert seconds to total frame count
    total_frames = round(total_seconds * fps)
    
    # Calculate seconds and remaining frames
    seconds = total_frames // fps
    frames = total_frames % fps
    
    # Combine as SS.FF where FF is the actual frame number (not /100)
    # We divide by 100 to make it display as decimal but preserve the frame number
    frame_notation = seconds + (frames / 100.0)
    
    return round(frame_notation, 2)

def extract_scene_frames(video_path, scene_list, output_dir):
    """
    Extract the first frame of each scene.
    
    Args:
        video_path: Path to the video file
        scene_list: List of (start_time, end_time) tuples from scene detection
        output_dir: Directory to save extracted frames
    
    Returns:
        List of dictionaries containing scene_index, frame_path, and timestamps
    """
    try:
        video = VideoFileClip(video_path)
        extracted_frames = []
        
        for i, (start_time, end_time) in enumerate(scene_list):
            start_seconds = timecode_to_seconds(start_time)
            scene_index = i + 1
            
            # Save frame at start time
            frame_filename = f"scene_{scene_index:03d}_frame.png"
            frame_path = os.path.join(output_dir, frame_filename)
            
            # Extract frame at start timestamp
            video.save_frame(frame_path, t=start_seconds)
            
            # Store frame info with internal timestamps (not for UI display)
            frame_info = {
                "scene_index": scene_index,
                "frame_path": frame_path,
                "start": start_seconds,  # Internal use only
                "end": timecode_to_seconds(end_time)  # Internal use only
            }
            extracted_frames.append(frame_info)
        
        video.close()
        return extracted_frames
        
    except Exception as e:
        raise Exception(f"Error extracting frames: {str(e)}")

# Removed individual ZIP creation - ZIPs are now created client-side

def encode_frame_as_base64(frame_path):
    """
    Encode frame image as base64 for inline display.
    
    Args:
        frame_path: Path to the frame image
    
    Returns:
        Base64 encoded string of the image
    """
    try:
        with open(frame_path, 'rb') as img_file:
            return base64.b64encode(img_file.read()).decode('utf-8')
    except Exception as e:
        raise Exception(f"Error encoding frame as base64: {str(e)}")

def process_video_for_scenes(video_path, video_name, threshold=15.0):
    """
    Process video for scene detection, extract frames, create ZIPs.
    
    Args:
        video_path: Path to the video file
        video_name: Name of the video (without extension)
        threshold: Content detection threshold (default: 15.0, lower = more sensitive)
    
    Returns:
        Dictionary containing the formatted scene detection results with frame data and temp directory path
    """
    temp_output_dir = None
    try:
        # Initialize video and scene managers
        video_manager = VideoManager([video_path])
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=threshold))

        # Start video manager and perform scene detection
        video_manager.start()
        scene_manager.detect_scenes(frame_source=video_manager)

        # Retrieve list of detected scenes
        scene_list = scene_manager.get_scene_list()
        
        # Release video manager resources
        video_manager.release()

        # If no scenes detected, create a single scene for entire video
        if not scene_list:
            # Get video duration
            video_manager_temp = VideoManager([video_path])
            video_manager_temp.start()
            duration = timecode_to_seconds(video_manager_temp.get_duration())
            video_manager_temp.release()
            
            scene_list = [(type('obj', (object,), {'get_seconds': lambda: 0.0})(), 
                          type('obj', (object,), {'get_seconds': lambda: duration})())]

        # Create temporary directory for frames and ZIPs
        temp_output_dir = tempfile.mkdtemp()
        
        # Extract frames
        extracted_frames = extract_scene_frames(video_path, scene_list, temp_output_dir)

        # Format clips with frame data
        clips = []
        transitions = []
        scenes_data = []
        
        for i, (start_time, end_time) in enumerate(scene_list):
            start_seconds = timecode_to_seconds(start_time)
            end_seconds = timecode_to_seconds(end_time)
            duration_seconds = end_seconds - start_seconds
            
            # Convert to SECONDS.FRAMES notation (30fps)
            duration_frame_notation = seconds_to_frame_notation(duration_seconds, fps=30)
            
            # Field order: index → duration → required
            clip = {
                "index": i + 1,
                "duration": duration_frame_notation,
                "required": True
            }
            clips.append(clip)
            
            # Create transition (cut) between consecutive clips
            # Field order: type → duration → between_clips
            if i < len(scene_list) - 1:
                transition = {
                    "type": "cut",
                    "duration": 0.0,
                    "between_clips": [i + 1, i + 2]
                }
                transitions.append(transition)
            
            # Prepare scene data with frame preview (base64 encoded) and file path
            # ZIPs are now created client-side on demand
            frame_info = extracted_frames[i]
            
            scene_data = {
                "scene_index": i + 1,
                "frame_preview": encode_frame_as_base64(frame_info["frame_path"]),
                "frame_path": frame_info["frame_path"]  # Keep path for direct access
            }
            scenes_data.append(scene_data)

        # Build the output JSON structure (field order matters for readability)
        output = {
            "name": video_name,
            "clips": clips,
            "transitions": transitions,
            "logo_outro": False,
            "music_file": "audio/fade_story.mp3",
            "fade_in_duration": seconds_to_frame_notation(0.0, fps=30),
            "fade_out_duration": seconds_to_frame_notation(1.9, fps=30),
            "scenes": scenes_data,  # New field for frame/ZIP data
            "temp_dir": temp_output_dir  # Keep temp dir for frame access
        }

        return output

    except Exception as e:
        # Clean up on error
        if temp_output_dir and os.path.exists(temp_output_dir):
            shutil.rmtree(temp_output_dir)
        raise Exception(f"Error processing video: {str(e)}")

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "message": "Backend server is running"}), 200

@app.route('/api/analyze', methods=['POST'])
def analyze_video():
    """
    Endpoint to analyze uploaded video for scene detection.
    Expects a multipart/form-data POST with a 'video' file.
    Optional 'threshold' parameter for detection sensitivity (default: 30.0).
    """
    try:
        # Check if video file is in request
        if 'video' not in request.files:
            return jsonify({"error": "No video file provided"}), 400
        
        video_file = request.files['video']
        
        # Check if file has a name
        if video_file.filename == '':
            return jsonify({"error": "No video file selected"}), 400
        
        # Validate file extension
        if not allowed_file(video_file.filename):
            return jsonify({"error": f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"}), 400
        
        # Get optional threshold parameter (lower = more sensitive)
        threshold = float(request.form.get('threshold', 15.0))
        
        # Secure the filename and save temporarily
        filename = secure_filename(video_file.filename)
        video_name = os.path.splitext(filename)[0]
        
        # Create a temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1])
        temp_path = temp_file.name
        temp_file.close()
        
        try:
            # Save uploaded file
            video_file.save(temp_path)
            
            # Process video for scene detection
            result = process_video_for_scenes(temp_path, video_name, threshold)
            
            return jsonify(result), 200
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/edit', methods=['POST'])
def edit_json():
    """
    Endpoint to edit JSON based on text instructions.
    For now, this is a placeholder that returns the original JSON.
    You can implement custom editing logic here.
    """
    try:
        data = request.get_json()
        
        if not data or 'json_data' not in data or 'prompt' not in data:
            return jsonify({"error": "Missing required fields: json_data and prompt"}), 400
        
        json_data = data['json_data']
        prompt = data['prompt']
        
        return jsonify(json_data), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@retry_with_exponential_backoff(
    max_retries=5,
    initial_delay=2.0,
    max_delay=60.0,
    exponential_base=2.0,
    jitter=True,
    retryable_exceptions=(Exception,)
)
def upload_and_process_video_with_gemini_internal(temp_video_path, vibe_prompt, api_key):
    """
    Internal function: Upload video to Gemini and generate vibe extraction.
    Wrapped in retry decorator to handle SSL/TLS, timeout, and connection errors.
    """
    import google.generativeai as genai
    
    # Configure Gemini API with timeout settings
    genai.configure(api_key=api_key)
    
    with gemini_rate_limiter:  # Rate limit API calls
        # Upload video to Gemini
        video_file = genai.upload_file(temp_video_path)
        
        # Wait for processing with progressive backoff
        wait_time = 0.5  # Start with shorter wait
        max_wait = 5  # Cap maximum wait time
        while video_file.state.name == "PROCESSING":
            time.sleep(wait_time)
            video_file = genai.get_file(video_file.name)
            # Progressive backoff: increase wait time up to max
            wait_time = min(wait_time * 1.5, max_wait)
        
        if video_file.state.name == "FAILED":
            raise Exception("Video processing failed on Gemini's servers")
        
        # Use Gemini 2.5 Flash with safety settings
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Safety settings to prevent false blocking (for professional video analysis)
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
        
        # Generation config with token limits (increased for better reliability)
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 1024,  # Increased to 1024 for more headroom
        }
        
        # Generate vibe extraction
        response = model.generate_content(
            [video_file, vibe_prompt],
            safety_settings=safety_settings,
            generation_config=generation_config
        )
        
        # Clean up uploaded file from Gemini
        try:
            genai.delete_file(video_file.name)
        except:
            pass  # Don't fail if cleanup fails
        
        # Check if response has valid content
        if not response.candidates or not response.candidates[0].content.parts:
            finish_reason = response.candidates[0].finish_reason if response.candidates else "UNKNOWN"
            
            # Finish reason 2 = MAX_TOKENS (response truncated but may still have content)
            if finish_reason == 2:
                try:
                    if response.text and len(response.text.strip()) > 0:
                        print(f"⚠️  Warning: Response truncated (MAX_TOKENS) but usable")
                        return response.text
                except:
                    pass
            
            # Handle blocking reasons
            error_msg = f"Gemini returned finish_reason {finish_reason} with no content."
            if response.candidates and response.candidates[0].safety_ratings:
                error_msg += f" Safety ratings: {response.candidates[0].safety_ratings}"
            raise Exception(error_msg)
        
        # Check if we have text to return
        if response.text and len(response.text.strip()) > 0:
            return response.text
        
        raise Exception("Gemini response had no text content")

def upload_and_process_video_with_gemini(temp_video_path, vibe_prompt, api_key):
    """
    Wrapper function with circuit breaker protection.
    """
    return gemini_circuit_breaker.call(
        upload_and_process_video_with_gemini_internal,
        temp_video_path, vibe_prompt, api_key
    )

@app.route('/api/gemini/vibe-extraction', methods=['POST'])
def gemini_vibe_extraction():
    """
    Endpoint to extract brand vibe from video using Gemini 2.5 Flash.
    Expects multipart/form-data with api_key and video file.
    Now includes comprehensive retry logic for network errors.
    """
    temp_video_path = None
    try:
        import google.generativeai as genai
        
        # Check for file upload (new method) or fallback to JSON base64 (old method)
        if 'video' in request.files:
            # NEW: Direct file upload
            api_key = request.form.get('api_key')
            video_file_upload = request.files['video']
            
            if not api_key or not video_file_upload:
                return jsonify({"error": "Missing required fields: api_key and video"}), 400
                
            # Save uploaded file temporarily
            temp_video_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
            temp_video_path = temp_video_file.name
            temp_video_file.close()
            video_file_upload.save(temp_video_path)
            
        else:
            # OLD: JSON base64 (fallback for compatibility)
            data = request.get_json()
            
            if not data or 'api_key' not in data or 'video_base64' not in data:
                return jsonify({"error": "Missing required fields: api_key and video"}), 400
            
            api_key = data['api_key']
            video_base64_data = data['video_base64']
            
            # Decode base64 and save video
            temp_video_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
            temp_video_path = temp_video_file.name
            temp_video_file.close()
            video_bytes = base64.b64decode(video_base64_data)
            with open(temp_video_path, 'wb') as f:
                f.write(video_bytes)
        
        # Prompt for vibe extraction
        vibe_prompt = """Analyze this video's visual style and brand identity in one paragraph."""
        
        # Process video with comprehensive retry logic
        vibe_text = upload_and_process_video_with_gemini(temp_video_path, vibe_prompt, api_key)
        
        return jsonify({"vibe_extraction": vibe_text, "failed": False}), 200
            
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Vibe extraction failed: {error_msg}")
        return jsonify({
            "vibe_extraction": None,
            "error": error_msg,
            "failed": True
        }), 200  # Return 200 so frontend can handle gracefully
    
    finally:
        # Clean up temporary file
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.unlink(temp_video_path)
            except:
                pass

@app.route('/api/gemini/image-prompts', methods=['POST'])
def gemini_image_prompts():
    """
    Endpoint to generate image prompts for each scene frame using Gemini 2.5 Flash.
    Expects JSON with api_key and either:
    - scenes (array with frame_path): reads frames from disk directly
    - scenes (array with frame_preview base64): fallback to base64
    """
    try:
        import google.generativeai as genai
        import PIL.Image
        import io
        
        data = request.get_json()
        
        if not data or 'api_key' not in data or 'scenes' not in data:
            return jsonify({"error": "Missing required fields: api_key and scenes"}), 400
        
        api_key = data['api_key']
        scenes = data['scenes']
        
        # Configure Gemini API
        genai.configure(api_key=api_key)
        
        # Image prompt instruction
        image_prompt_instruction = """Create a detailed image generation prompt describing this frame for AI systems."""

        # Special instruction for last frame (black image)
        black_frame_instruction = """Generate a prompt for a completely black image."""
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Safety settings to prevent false blocking (for professional image analysis)
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
        
        # Generation config with token limits
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 450,  # Limit output tokens (300 words ~= 400-450 tokens)
        }
        
        image_prompts = []
        
        import concurrent.futures
        from functools import partial
        
        @retry_with_exponential_backoff(
            max_retries=5,
            initial_delay=1.0,
            max_delay=30.0,
            exponential_base=2.0,
            jitter=True,
            retryable_exceptions=(Exception,)
        )
        def process_single_frame_with_retry(i, scene, is_last, model, image_prompt_instruction, safety_settings, generation_config):
            """Process a single frame with retry logic"""
            if is_last:
                return "A completely solid black frame with no elements, text, logos, or features. Pure pitch-black image from edge to edge, suitable for video ending."
            
            if 'frame_path' in scene and os.path.exists(scene['frame_path']):
                image = PIL.Image.open(scene['frame_path'])
            else:
                # Fallback: Decode base64 image
                frame_base64 = scene['frame_preview']
                if ',' in frame_base64:
                    frame_base64 = frame_base64.split(',')[1]
                
                image_bytes = base64.b64decode(frame_base64)
                image = PIL.Image.open(io.BytesIO(image_bytes))
            
            # Use rate limiter to prevent overwhelming the API
            with gemini_rate_limiter:
                # Generate image prompt with safety settings and token limits
                response = model.generate_content(
                    [image, image_prompt_instruction],
                    safety_settings=safety_settings,
                    generation_config=generation_config
                )
            
            # Check if response was blocked
            if not response.candidates or not response.candidates[0].content.parts:
                return f"Frame {i+1}: Professional video frame with cinematic composition and lighting."
            else:
                return response.text
        
        def process_single_frame(i, scene, is_last, model, image_prompt_instruction, safety_settings, generation_config):
            """Wrapper for process_single_frame_with_retry with circuit breaker and fallback"""
            try:
                # Use circuit breaker to protect against persistent API failures
                return gemini_circuit_breaker.call(
                    process_single_frame_with_retry,
                    i, scene, is_last, model, image_prompt_instruction, safety_settings, generation_config
                )
            except Exception as e:
                error_msg = str(e)
                if "Circuit breaker is OPEN" in error_msg:
                    print(f"⚠️  Frame {i+1} skipped due to circuit breaker")
                else:
                    print(f"❌ Frame {i+1} failed after all retries: {error_msg}")
                return f"Frame {i+1}: Professional video frame with cinematic composition and lighting."
        
        # Process all frames in parallel (reduced to 3 concurrent threads to reduce API load)
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = []
            for i, scene in enumerate(scenes):
                is_last_frame = (i == len(scenes) - 1)
                future = executor.submit(
                    process_single_frame, 
                    i, scene, is_last_frame, 
                    model, image_prompt_instruction, 
                    safety_settings, generation_config
                )
                futures.append(future)
            
            # Collect results in order
            for future in futures:
                image_prompts.append(future.result())
        
        return jsonify({"image_prompts": image_prompts}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@retry_with_exponential_backoff(
    max_retries=5,
    initial_delay=2.0,
    max_delay=60.0,
    exponential_base=2.0,
    jitter=True,
    retryable_exceptions=(Exception,)
)
def generate_video_prompt_with_retry_internal(video_prompt_instruction, model, safety_settings, generation_config):
    """Internal function: Generate video prompt with retry logic"""
    with gemini_rate_limiter:
        # Generate video prompt with safety settings and generation config
        response = model.generate_content(
            video_prompt_instruction,
            safety_settings=safety_settings,
            generation_config=generation_config
        )
    
    # Check if response was blocked
    if not response.candidates or not response.candidates[0].content.parts:
        finish_reason = response.candidates[0].finish_reason if response.candidates else "UNKNOWN"
        raise Exception(f"Gemini returned finish_reason {finish_reason} with no content")
    
    return response.text

def generate_video_prompt_with_retry(video_prompt_instruction, model, safety_settings, generation_config):
    """Wrapper with circuit breaker protection"""
    return gemini_circuit_breaker.call(
        generate_video_prompt_with_retry_internal,
        video_prompt_instruction, model, safety_settings, generation_config
    )

@app.route('/api/gemini/video-prompt', methods=['POST'])
def gemini_video_prompt():
    """
    Endpoint to generate a comprehensive video prompt from image prompts using Gemini 2.5 Flash.
    Expects JSON with api_key and image_prompts (array of strings).
    Now includes comprehensive retry logic for network errors.
    """
    try:
        import google.generativeai as genai
        
        data = request.get_json()
        
        if not data or 'api_key' not in data or 'image_prompts' not in data:
            return jsonify({"error": "Missing required fields: api_key and image_prompts"}), 400
        
        api_key = data['api_key']
        image_prompts = data['image_prompts']
        
        # Configure Gemini API
        genai.configure(api_key=api_key)
        
        # Video prompt instruction
        video_prompt_instruction = """Create a video generation prompt from these image prompts:\n\n"""
        
        # Add all image prompts with frame numbers
        for i, prompt in enumerate(image_prompts):
            video_prompt_instruction += f"Frame {i + 1}: {prompt}\n\n"
        
        video_prompt_instruction += "Generate a comprehensive video prompt with transitions."""
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Safety settings to prevent false blocking (for professional video prompt generation)
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
        
        # Generation config with token limits
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 750,  # Limit output tokens (500 words ~= 650-750 tokens)
        }
        
        try:
            # Generate video prompt with comprehensive retry logic
            video_prompt_text = generate_video_prompt_with_retry(
                video_prompt_instruction, 
                model, 
                safety_settings, 
                generation_config
            )
            return jsonify({"video_prompt": video_prompt_text}), 200
        
        except Exception as e:
            # Create a fallback video prompt based on the image prompts provided
            print(f"⚠️  Video prompt generation failed, using fallback: {str(e)}")
            fallback_prompt = "Video sequence: "
            for i, img_prompt in enumerate(image_prompts):
                fallback_prompt += f"Frame {i+1}: {img_prompt[:100]}... "
                if i < len(image_prompts) - 1:
                    fallback_prompt += "Smooth transition. "
            
            return jsonify({"video_prompt": fallback_prompt, "warning": "Generated using fallback due to API error"}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting backend server...")
    print("Server will be available at http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=True)


