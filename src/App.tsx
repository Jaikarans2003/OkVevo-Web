import { useState } from 'react';
import { Film, Loader2, Video, Settings2, Info, ArrowRight, CheckCircle } from 'lucide-react';
import { MODELS } from './config/models';
import { useVideoGeneration } from './hooks/useVideoGeneration';
import VideoPlayer from './components/VideoPlayer';

export default function TextToVideoGenerator() {
  const {
    analyzedScenes,
    videoUrls,
    loading,
    error,
    status,
    analyzePrompt,
    generateVideosFromScenes,
    resetAnalysis
  } = useVideoGeneration();

  // UI State
  const [inputText, setInputText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [guidanceScale, setGuidanceScale] = useState(MODELS['tunetales'].defaultGuidance);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const handleInitialGenerate = () => {
    analyzePrompt(inputText);
  };

  const handleProceedClick = () => {
    if (analyzedScenes) {
      generateVideosFromScenes(analyzedScenes, guidanceScale);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Film className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Text to Video</h1>
          <p className="text-gray-400">Transform your words into motion</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Input Section (Hidden if reviewing or generated) */}
        {!analyzedScenes && videoUrls.length === 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Model Info */}
            <div className="w-full p-4 rounded-lg border border-gray-800 bg-gray-900/50 text-left">
              <div className="flex items-center gap-3 mb-2">
                <Video className="w-5 h-5 text-blue-400" />
                <span className="font-semibold text-xl">{MODELS['tunetales'].name}</span>
              </div>
              <p className="text-sm text-gray-400">{MODELS['tunetales'].description}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Describe the video you want ${MODELS['tunetales'].name} to create...`}
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

                    {/* Fixed Settings Information */}
                    <div className="text-sm text-gray-400 p-2">
                      <p>Settings are optimized for TuneTales cinematic output.</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Duration: 60s (3 scenes x 20s)</li>
                        <li>Aspect Ratio: 16:9</li>
                        <li>Audio: Generated</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleInitialGenerate}
              disabled={loading}
              className="w-full bg-white text-black py-4 rounded-lg font-semibold text-lg hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing Scenes...
                </>
              ) : (
                'Generate Scenarios'
              )}
            </button>
          </div>
        )}

        {/* Scene Review Section */}
        {analyzedScenes && videoUrls.length === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Scene Analysis</h2>
              <button
                onClick={resetAnalysis}
                className="text-sm text-gray-400 hover:text-white underline"
              >
                Edit Prompt
              </button>
            </div>

            <div className="grid gap-6">
              {analyzedScenes.map((scene, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-blue-400">{scene.scene}</h3>
                    <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">20s</span>
                  </div>

                  <div className="space-y-4 text-sm text-gray-300">
                    <div>
                      <strong className="text-white block mb-1">Objective:</strong>
                      {scene.scene_objective}
                    </div>
                    <div>
                      <strong className="text-white block mb-1">Visuals:</strong>
                      {scene.primary_visuals}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong className="text-white block mb-1">Tone:</strong>
                        <span className="text-purple-400">{scene.emotional_tone}</span>
                      </div>
                      <div>
                        <strong className="text-white block mb-1">Transition:</strong>
                        <span className="text-gray-400 italic">{scene.transition_logic}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleProceedClick}
              disabled={loading}
              className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-500 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Video...
                </>
              ) : (
                <>
                  Proceed to Generation
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Video Player/Editor Section */}
        {videoUrls.length > 0 && (
          <div className="animate-in fade-in zoom-in duration-500 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Generation Complete</span>
              </div>
              <button
                onClick={resetAnalysis}
                className="text-sm text-gray-400 hover:text-white underline"
              >
                Create New Video
              </button>
            </div>

            <VideoPlayer
              videoUrls={videoUrls}
              currentVideoIndex={currentVideoIndex}
              setCurrentVideoIndex={setCurrentVideoIndex}
            />
          </div>
        )}

        {/* Loading Overlay for Status */}
        {loading && (
          <div className="fixed bottom-8 right-8 bg-black/80 backdrop-blur border border-gray-800 rounded-lg p-4 flex items-center gap-3 animate-pulse z-50">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span className="text-sm">{status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
