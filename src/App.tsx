import { useState, useRef } from 'react';
import { Film, Download, Loader2, Video, Sparkles, Settings2, Info, Scissors, Crop, Image, Film as FilmIcon, Play, Pause, Plus, X } from 'lucide-react';

// Define the shape of our model configuration
interface ModelConfig {
  id: string;
  name: string;
  description: string;
  version?: string;
  endpoint: string;
  // payloadBuilder now takes advanced options
  payloadBuilder: (
    prompt: string,
    options: { version?: string; guidanceScale: number; enhancePrompt: boolean; duration?: number; aspectRatio?: string }
  ) => { version?: string; input: Record<string, string | number | boolean> };
  defaultGuidance: number;
}

const MODELS: Record<string, ModelConfig> = {
  'ltx-2-fast': {
    id: 'ltx-2-fast',
    name: 'LTX Video 2 Fast',
    description: 'Ultra-fast video generation with high quality',
    version: '36fffd7d35beddbe99e93b52e1a620a4f4ab739d7372e1eac9f040dd3c372b2c',
    endpoint: '/api/replicate/predictions',
    defaultGuidance: 2.5,
    payloadBuilder: (prompt, { version, duration, aspectRatio }) => ({
      version,
      input: {
        prompt,
        resolution: aspectRatio === '16:9' ? '1080p' : '720p',
        duration: duration === 5 ? 6 : duration === 10 ? 8 : 20, // 6, 8, or 20 seconds for ltx-2-fast
        generate_audio: true
      }
    })
  },
  'wan-2.5': {
    id: 'wan-2.5',
    name: 'Wan 2.5 (Alibaba)',
    description: 'Advanced Chinese/English T2V model',
    endpoint: '/api/replicate/models/wan-video/wan-2.5-t2v/predictions',
    defaultGuidance: 5.0,
    payloadBuilder: (prompt, { guidanceScale, enhancePrompt }) => ({
      input: {
        prompt,
        aspect_ratio: "16:9",
        negative_prompt: "low quality, worst quality, deformed, distorted, watermark",
        guidance_scale: guidanceScale,
        enable_prompt_expansion: enhancePrompt
      }
    })
  }
};

export default function TextToVideoGenerator() {
  const [selectedModelId, setSelectedModelId] = useState<keyof typeof MODELS>('ltx-2-fast');
  const [inputText, setInputText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // Advanced Settings State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [guidanceScale, setGuidanceScale] = useState(MODELS['ltx-2-fast'].defaultGuidance);
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [duration, setDuration] = useState(5); // Duration in seconds (5, 10, or 20)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');

  // Video Editing State
  const [showEditor, setShowEditor] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [cropSettings, setCropSettings] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [timelineItems, setTimelineItems] = useState<Array<{
    id: string;
    type: 'video' | 'image';
    url: string;
    startTime: number;
    duration: number;
    name: string;
    position: number; // Position on timeline (in seconds)
  }>>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [timelineDuration, setTimelineDuration] = useState(30); // Default 30 seconds
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update default guidance when model changes
  const handleModelChange = (modelId: keyof typeof MODELS) => {
    setSelectedModelId(modelId);
    setGuidanceScale(MODELS[modelId].defaultGuidance);
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setError('Please enter a description for your video');
      return;
    }

    setLoading(true);
    setError('');
    setVideoUrl('');
    setStatus('Starting generation...');

    const modelConfig = MODELS[selectedModelId];

    try {
      const payload = modelConfig.payloadBuilder(inputText, {
        version: modelConfig.version,
        guidanceScale,
        enhancePrompt,
        duration: selectedModelId === 'ltx-2-fast' ? duration : undefined,
        aspectRatio: selectedModelId === 'ltx-2-fast' ? aspectRatio : undefined
      });

      console.log('Making API request:', {
        endpoint: modelConfig.endpoint,
        model: selectedModelId,
        payload: payload
      });

      const response = await fetch(modelConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_REPLICATE_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        let errorMessage = errorData.detail || errorData.error || 'Failed to start video generation';
        
        // Handle specific Replicate API errors
        if (errorMessage.includes('throttled')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again. This usually happens when you have low account credits.';
        } else if (errorMessage.includes('version does not exist')) {
          errorMessage = 'Model version issue detected. This may be due to API access restrictions or incorrect model configuration.';
        } else if (errorMessage.includes('permission')) {
          errorMessage = 'Permission denied. You may need to request access to this model or check your API token.';
        } else if (errorMessage.includes('401')) {
          errorMessage = 'Authentication failed. Please check your API token configuration.';
        } else if (errorMessage.includes('404')) {
          errorMessage = 'API endpoint not found. The model may not be available or the endpoint is incorrect.';
        }
        
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          endpoint: modelConfig.endpoint,
          payload
        });
        
        throw new Error(errorMessage);
      }

      let prediction = await response.json();
      setStatus(`Generation ${prediction.status}...`);

      while (
        prediction.status !== 'succeeded' &&
        prediction.status !== 'failed' &&
        prediction.status !== 'canceled'
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const pollResponse = await fetch(`/api/replicate/predictions/${prediction.id}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_REPLICATE_API_TOKEN}`,
          },
        });

        if (!pollResponse.ok) {
          const err = await pollResponse.json();
          throw new Error(err.detail || 'Failed to poll status');
        }

        prediction = await pollResponse.json();
        setStatus(`Generation ${prediction.status}...`);
      }

      if (prediction.status === 'succeeded' && prediction.output) {
        const output = prediction.output;
        const url = Array.isArray(output) ? output[0] : output;
        setVideoUrl(url);
      } else {
        throw new Error(`Generation failed with status: ${prediction.status}`);
      }

    } catch (err: unknown) {
      console.error('Generation error:', err);
      
      if (err instanceof Error) {
        let errorMessage = err.message || 'An error occurred while generating the video';
        
        // Enhance error messages for common issues
        if (errorMessage.includes('throttled')) {
          errorMessage = '⚠️ Rate limit exceeded. This usually happens when you have low account credits. Please wait a moment and try again, or consider adding credits to your Replicate account.';
        } else if (errorMessage.includes('version does not exist')) {
          errorMessage = '🔧 Model version issue. The LTX-2-Fast model may require special access or the version may have changed. Please check your Replicate account permissions or contact support.';
        } else if (errorMessage.includes('permission')) {
          errorMessage = '🔒 Permission denied. You may need to request access to this model. Visit the Replicate model page to request access.';
        } else if (errorMessage.includes('Failed to start')) {
          errorMessage = '🚀 Generation failed to start. This could be due to API limits or model availability. Please try again in a few moments.';
        } else if (errorMessage.includes('Failed to fetch')) {
          errorMessage = '🌐 Network error: Failed to connect to the API. This could be due to:\n\n• CORS issues (try using the Firebase Functions proxy)\n• Network connectivity problems\n• API server being down\n\nTry refreshing the page or check your internet connection.';
        } else if (errorMessage.includes('401')) {
          errorMessage = '🔑 Authentication failed. Please check that your REPLICATE_API_TOKEN is correctly configured in the .env file.';
        } else if (errorMessage.includes('404')) {
          errorMessage = '🔍 API endpoint not found. The model may not be available or the endpoint configuration is incorrect.';
        } else if (errorMessage.includes('CORS')) {
          errorMessage = '🔗 CORS error: The API is blocking cross-origin requests. Make sure you\'re using the Firebase Functions proxy endpoint.';
        }
        
        setError(errorMessage);
      } else {
        setError('❌ An unknown error occurred. Please try again later.');
      }
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const handleDownload = () => {
    if (videoUrl) {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `generated-${selectedModelId}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Video Editing Functions
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);
        const newItem = {
          id: Date.now().toString() + Math.random(),
          type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
          url,
          startTime: 0,
          duration: 5, // Default duration for images, will be updated for videos
          name: file.name,
          position: 0 // Default position at start
        };
        setTimelineItems(prev => [...prev, newItem]);
      });
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      setTrimEnd(videoRef.current.duration);
    }
  };

  const handleTrimChange = (start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
  };

  const handleCropChange = (settings: typeof cropSettings) => {
    setCropSettings(settings);
  };

  const removeTimelineItem = (id: string) => {
    setTimelineItems(prev => prev.filter(item => item.id !== id));
  };

  // Drag and Drop Functions
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTimelineDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = (x / rect.width) * timelineDuration;
    
    if (draggedItem) {
      setTimelineItems(prev => 
        prev.map(item => 
          item.id === draggedItem 
            ? { ...item, position: Math.max(0, Math.min(timelineDuration - item.duration, position)) }
            : item
        )
      );
    }
  };

  const handleTimelineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedItem(null);
  };

  // Download edited video function
  const handleDownloadEdited = () => {
    // For now, we'll download the original generated video
    // In a full implementation, this would merge timeline items
    if (videoUrl) {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `edited-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Film className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Text to Video</h1>
          <p className="text-gray-400">Transform your words into motion</p>
        </div>

        {/* Model Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Model
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(MODELS).map((model) => (
              <div key={model.id} className="space-y-3">
                <button
                  onClick={() => handleModelChange(model.id as keyof typeof MODELS)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${selectedModelId === model.id
                      ? 'border-white bg-gray-900'
                      : 'border-gray-800 bg-gray-950 hover:border-gray-600'
                    }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {model.id === 'ltx-2-fast' ? <Video className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                    <span className="font-semibold">{model.name}</span>
                  </div>
                  <p className="text-sm text-gray-400">{model.description}</p>
                </button>
                
                {/* LTX-2-Fast specific controls */}
                {model.id === 'ltx-2-fast' && selectedModelId === 'ltx-2-fast' && (
                  <div className="space-y-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
                    {/* Duration Controls */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Duration
                      </label>
                      <div className="flex gap-2">
                        {[5, 10, 20].map((sec) => (
                          <button
                            key={sec}
                            onClick={() => setDuration(sec)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              duration === sec
                                ? 'bg-white text-black'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Aspect Ratio Controls */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Aspect Ratio
                      </label>
                      <div className="flex gap-2">
                        {[
                          { value: '16:9', label: '16:9 (Landscape)' },
                          { value: '9:16', label: '9:16 (Portrait)' }
                        ].map((ratio) => (
                          <button
                            key={ratio.value}
                            onClick={() => setAspectRatio(ratio.value as '16:9' | '9:16')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              aspectRatio === ratio.value
                                ? 'bg-white text-black'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {ratio.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Input Section */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Describe the video you want ${MODELS[selectedModelId].name} to create...`}
            className="w-full h-40 bg-white text-black p-4 rounded-lg border-2 border-gray-300 focus:border-gray-500 focus:outline-none resize-none placeholder-gray-400 transition-colors"
            disabled={loading}
          />

          {/* Advanced Settings Toggle */}
          <div className="mt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-800 space-y-4">
                {/* Guidance Scale */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      Guidance Scale
                      <div className="group relative">
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-xs text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          How closely to follow the prompt
                        </div>
                      </div>
                    </label>
                    <span className="text-sm text-gray-400">{guidanceScale}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={guidanceScale}
                    onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Creative (1)</span>
                    <span>Strict (10)</span>
                  </div>
                </div>

                {/* Duration Selection (ltx-2-fast only) */}
                {selectedModelId === 'ltx-2-fast' && (
                  <div>
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                      Duration
                      <div className="group relative">
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-xs text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Video duration in seconds
                        </div>
                      </div>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDuration(5)}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          duration === 5 
                            ? 'bg-white text-black' 
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        5 seconds
                      </button>
                      <button
                        onClick={() => setDuration(10)}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          duration === 10 
                            ? 'bg-white text-black' 
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        10 seconds
                      </button>
                    </div>
                  </div>
                )}

                {/* Aspect Ratio Selection (ltx-2-fast only) */}
                {selectedModelId === 'ltx-2-fast' && (
                  <div>
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                      Aspect Ratio
                      <div className="group relative">
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-xs text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Video aspect ratio
                        </div>
                      </div>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAspectRatio('16:9')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          aspectRatio === '16:9' 
                            ? 'bg-white text-black' 
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        16:9 (Landscape)
                      </button>
                      <button
                        onClick={() => setAspectRatio('9:16')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          aspectRatio === '9:16' 
                            ? 'bg-white text-black' 
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        9:16 (Portrait)
                      </button>
                    </div>
                  </div>
                )}

                {/* Prompt Enhancement (Wan only) */}
                {selectedModelId === 'wan-2.5' && (
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      Enhance Prompt
                      <div className="group relative">
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-xs text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Automatically rewrite prompt for better details
                        </div>
                      </div>
                    </label>
                    <button
                      onClick={() => setEnhancePrompt(!enhancePrompt)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${enhancePrompt ? 'bg-white' : 'bg-gray-700'
                        }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${enhancePrompt ? 'bg-black translate-x-6' : 'bg-gray-400 translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-500 mt-2 text-sm">{error}</p>
          )}
          {status && (
            <p className="text-blue-400 mt-2 text-sm text-center animate-pulse">{status}</p>
          )}
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-white text-black py-4 rounded-lg font-semibold text-lg hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Video'
          )}
        </button>

        {/* Video Player/Editor Section */}
        {videoUrl && (
          <div className="mt-12 space-y-6">
            {/* Editor Toggle */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowEditor(!showEditor)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  showEditor 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <FilmIcon className="w-4 h-4" />
                {showEditor ? 'Simple View' : 'Edit Video'}
              </button>
              
              {/* Import Media Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Import Media
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,image/*"
                onChange={handleFileImport}
                className="hidden"
              />
            </div>

            {showEditor ? (
              /* Video Editor Interface */
              <div className="space-y-6">
                {/* Video Preview */}
                <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full h-full object-contain"
                    style={{
                      clipPath: `inset(${cropSettings.y}% ${100 - cropSettings.x - cropSettings.width}% ${100 - cropSettings.y - cropSettings.height}% ${cropSettings.x}%)`
                    }}
                  />
                  
                  {/* Video Controls Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-lg p-4">
                    <div className="flex items-center gap-4 mb-2">
                      <button
                        onClick={handlePlayPause}
                        className="bg-white text-black p-2 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      
                      <div className="flex-1 text-white text-sm">
                        {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')} / 
                        {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toFixed(1).padStart(4, '0')}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-600 rounded-full h-1">
                      <div 
                        className="bg-white h-1 rounded-full transition-all"
                        style={{ width: `${(currentTime / videoDuration) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Editing Tools */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Trim Controls */}
                  <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Scissors className="w-5 h-5" />
                      Trim Video
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Start Time (seconds)</label>
                        <input
                          type="range"
                          min="0"
                          max={videoDuration - 1}
                          step="0.1"
                          value={trimStart}
                          onChange={(e) => handleTrimChange(parseFloat(e.target.value), trimEnd)}
                          className="w-full"
                        />
                        <div className="text-sm text-gray-300 mt-1">{trimStart.toFixed(1)}s</div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">End Time (seconds)</label>
                        <input
                          type="range"
                          min={trimStart + 1}
                          max={videoDuration}
                          step="0.1"
                          value={trimEnd}
                          onChange={(e) => handleTrimChange(trimStart, parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <div className="text-sm text-gray-300 mt-1">{trimEnd.toFixed(1)}s</div>
                      </div>
                    </div>
                  </div>

                  {/* Crop Controls */}
                  <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Crop className="w-5 h-5" />
                      Crop Video
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">X (%)</label>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={cropSettings.x}
                          onChange={(e) => handleCropChange({...cropSettings, x: parseInt(e.target.value)})}
                          className="w-full"
                        />
                        <div className="text-sm text-gray-300 mt-1">{cropSettings.x}%</div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Y (%)</label>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={cropSettings.y}
                          onChange={(e) => handleCropChange({...cropSettings, y: parseInt(e.target.value)})}
                          className="w-full"
                        />
                        <div className="text-sm text-gray-300 mt-1">{cropSettings.y}%</div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Width (%)</label>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          value={cropSettings.width}
                          onChange={(e) => handleCropChange({...cropSettings, width: parseInt(e.target.value)})}
                          className="w-full"
                        />
                        <div className="text-sm text-gray-300 mt-1">{cropSettings.width}%</div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Height (%)</label>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          value={cropSettings.height}
                          onChange={(e) => handleCropChange({...cropSettings, height: parseInt(e.target.value)})}
                          className="w-full"
                        />
                        <div className="text-sm text-gray-300 mt-1">{cropSettings.height}%</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                {timelineItems.length > 0 && (
                  <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FilmIcon className="w-5 h-5" />
                        Timeline
                      </h3>
                      <button
                        onClick={handleDownloadEdited}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export Video
                      </button>
                    </div>
                    
                    {/* Timeline Controls */}
                    <div className="flex items-center gap-4 mb-4">
                      <label className="text-sm text-gray-400">Duration:</label>
                      <select 
                        value={timelineDuration} 
                        onChange={(e) => setTimelineDuration(parseInt(e.target.value))}
                        className="bg-gray-800 text-white px-3 py-1 rounded text-sm"
                      >
                        <option value={30}>30 seconds</option>
                        <option value={60}>1 minute</option>
                        <option value={120}>2 minutes</option>
                      </select>
                    </div>

                    {/* Horizontal Timeline Bar */}
                    <div 
                      className="relative bg-gray-800 rounded-lg p-4 min-h-24 mb-4"
                      onDragOver={handleTimelineDragOver}
                      onDrop={handleTimelineDrop}
                    >
                      {/* Time markers */}
                      <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span>0s</span>
                        <span>{Math.floor(timelineDuration/2)}s</span>
                        <span>{timelineDuration}s</span>
                      </div>
                      
                      {/* Timeline track */}
                      <div className="relative h-16 bg-gray-700 rounded border-2 border-dashed border-gray-600">
                        {timelineItems.map((item) => {
                          const leftPosition = (item.position / timelineDuration) * 100;
                          const width = (item.duration / timelineDuration) * 100;
                          
                          return (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, item.id)}
                              className={`absolute top-2 h-12 bg-blue-600 rounded border-2 border-blue-400 cursor-move flex items-center px-2 group ${
                                draggedItem === item.id ? 'opacity-50' : ''
                              }`}
                              style={{
                                left: `${leftPosition}%`,
                                width: `${Math.max(width, 8)}%`,
                                minWidth: '60px'
                              }}
                            >
                              <div className="flex items-center gap-2 text-white text-xs overflow-hidden">
                                {item.type === 'video' ? <Video className="w-3 h-3 flex-shrink-0" /> : <Image className="w-3 h-3 flex-shrink-0" />}
                                <span className="truncate">{item.name}</span>
                              </div>
                              
                              {/* Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeTimelineItem(item.id);
                                }}
                                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              
                              {/* Duration indicator */}
                              <div className="absolute -bottom-1 left-0 right-0 text-center text-[10px] text-gray-300">
                                {item.duration}s
                              </div>
                            </div>
                          );
                        })}
                        
                        {timelineItems.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                            Drag and drop files here to add to timeline
                          </div>
                        )}
                      </div>
                    </div>

                    {/* File Import Area */}
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="video/*,image/*"
                        onChange={handleFileImport}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors mx-auto"
                      >
                        <Plus className="w-8 h-8" />
                        <span className="text-sm">Click to add videos or photos</span>
                        <span className="text-xs text-gray-500">or drag and drop files</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Simple Video Player */
              <div className="border-2 border-gray-700 rounded-lg overflow-hidden">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full"
                  style={{ maxHeight: '500px' }}
                >
                  Your browser does not support the video tag.
                </video>

                {/* Download Button */}
                <div className="bg-gray-900 p-4">
                  <button
                    onClick={handleDownload}
                    className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Save Video
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && !videoUrl && (
          <div className="mt-8 text-center">
            <div className="inline-block">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
            <p className="text-gray-400 mt-4">This may take a few minutes...</p>
          </div>
        )}
      </div>
    </div>
  );
}
