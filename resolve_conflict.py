import sys

with open(r"c:\Users\hrudh\OneDrive\Desktop\OkvevoProd\OKVEVO\src\app\workspace\ai-influencer\page.tsx", "r", encoding='utf-8') as f:
    lines = f.readlines()

new_content = """                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="file"
                                                            ref={scriptFileInputRef}
                                                            onChange={handleScriptFileUpload}
                                                            accept=".txt,.md"
                                                            className="hidden"
                                                        />
                                                        <button
                                                            onClick={() => scriptFileInputRef.current?.click()}
                                                            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-[10px] font-black uppercase tracking-[0.15em] text-white/50 transition-all active:scale-95"
                                                        >
                                                            <Upload size={12} strokeWidth={2.5} /> Import Source
                                                        </button>
                                                        <button
                                                            onClick={handleScriptSubmit}
                                                            disabled={!rawScript.trim()}
                                                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:from-orange-500 hover:shadow-[0_0_25px_rgba(234,88,12,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-20 disabled:cursor-not-allowed shadow-xl active:scale-95"
                                                        >
                                                            Initialise Protocol <ChevronRight size={14} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* STEP 2: Duration */}
                                            {chatStep === 'duration' && (
                                                <motion.div
                                                    key="duration"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-4"
                                                >
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Temporal Calibration
                                                    </p>
                                                    <div className="flex gap-3">
                                                        {([15, 30, 60] as const).map((d) => (
                                                            <button
                                                                key={d}
                                                                onClick={() => handleDurationSelect(d)}
                                                                disabled={isGenerating}
                                                                className="flex-1 py-4 rounded-2xl font-black text-[12px] tracking-[0.1em] border transition-all flex flex-col items-center gap-2 disabled:opacity-20 bg-white/[0.02] border-white/5 text-white/60 hover:border-orange-500/50 hover:bg-orange-600/10 hover:text-white hover:shadow-[0_0_20px_rgba(234,88,12,0.1)] active:scale-95"
                                                            >
                                                                <Clock size={16} className="text-orange-500" strokeWidth={2.5} />
                                                                <span>{d} Seconds</span>
                                                                <span className="text-[8px] text-white/20 font-black tracking-widest uppercase">~{Math.floor(d * 2.5)} Tokens / {d === 15 ? '3' : d === 30 ? '5' : '8'} Images</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* STEP 3: Pacing */}
                                            {chatStep === 'tts-pacing' && (
                                                <motion.div
                                                    key="tts-pacing"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-4"
                                                >
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Pacing Calibration
                                                    </p>
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => handlePacingSelect('calm')}
                                                            disabled={isGenerating}
                                                            className="flex-1 py-4 rounded-2xl font-black text-[12px] tracking-[0.1em] border transition-all flex flex-col items-center gap-2 disabled:opacity-20 bg-white/[0.02] border-white/5 text-white/60 hover:border-orange-500/50 hover:bg-orange-600/10 hover:text-white hover:shadow-[0_0_20px_rgba(234,88,12,0.1)] active:scale-95"
                                                        >
                                                            <span>Calm & Steady</span>
                                                            <span className="text-[8px] text-white/20 font-black tracking-widest uppercase">Slower</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handlePacingSelect('fast')}
                                                            disabled={isGenerating}
                                                            className="flex-1 py-4 rounded-2xl font-black text-[12px] tracking-[0.1em] border transition-all flex flex-col items-center gap-2 disabled:opacity-20 bg-white/[0.02] border-white/5 text-white/60 hover:border-orange-500/50 hover:bg-orange-600/10 hover:text-white hover:shadow-[0_0_20px_rgba(234,88,12,0.1)] active:scale-95"
                                                        >
                                                            <span>Fast & Punchy</span>
                                                            <span className="text-[8px] text-white/20 font-black tracking-widest uppercase">Aggressive</span>
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* STEP 4: Edit Script */}
                                            {chatStep === 'edit-script' && (
                                                <motion.div
                                                    key="edit-script"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-4"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                            <span className="w-1 h-1 rounded-full bg-orange-500" /> Refined Narrative
                                                        </p>
                                                        <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">{editableScript.trim().split(/\s+/).length} Words</span>
                                                    </div>
                                                    <textarea
                                                        value={editableScript}
                                                        onChange={(e) => setEditableScript(e.target.value)}
                                                        className="w-full h-32 p-5 rounded-2xl border border-orange-500/30 bg-black/40 text-[13px] text-white leading-relaxed focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 outline-none resize-none shadow-inner"
                                                    />\n"""

lines[706:865] = [new_content]

with open(r"c:\Users\hrudh\OneDrive\Desktop\OkvevoProd\OKVEVO\src\app\workspace\ai-influencer\page.tsx", "w", encoding='utf-8') as f:
    f.writelines(lines)
