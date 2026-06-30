/* ==========================================================================
   Thanu's Birthday Surprise - Application Logic
   Features: Quiz System, Canvas Particles (Hearts, Petals, Confetti, Fireworks),
             Cinematic Slideshow Engine, Web Audio Synthesizer, & Speech Fallback.
   ========================================================================== */

// --- 1. CONFIGURATION BLOCK (Customize Answers Here) ---
const CONFIG = {
    // Question 1: "What is your nickname?"
    nickname: "thanu", 
    
    // Question 2: "What date did our relationship begin?"
    anniversaryDate: "01/12/2025", 
    
    // Question 3: "What is my favorite name that I call you?"
    favoriteName: "Maa", 
    
    // Question 4: "Where did we first meet?"
    meetLocation: "Near the library", 
    
    // Question 5: "When is your birthday?"
    saveName: "PRINCESS THANU",
    
    // Slideshow Photos Configuration (Relative to images/ folder)
    slideshow: [
        { url: "images/photo1.png", caption: "Our journey started here... 🌅", effect: "fx-zoom-in" },
        { url: "images/photo2.png", caption: "Every coffee date is special with you ☕", effect: "fx-zoom-out" },
        { url: "images/photo3.jpeg", caption: "Under the stars, thinking of you ✨", effect: "fx-rotate" },
        { url: "images/photo4.jpeg", caption: "Holding your hand is my favorite feeling 🤝", effect: "fx-blur-focus" },
        { url: "images/photo5.jpeg", caption: "You make my world bloom like spring 🌸", effect: "fx-floating-card" }
    ],
    
    // Romantic Quotes shown during slideshow
    quotes: [
        "Every picture tells our story.",
        "You are my happiest place.",
        "Every moment with you is unforgettable.",
        "I would choose you again and again.",
        "Forever starts with you."
    ]
};

// --- 2. GLOBAL STATE ---
const state = {
    currentQuizIndex: 0,
    isAudioPlaying: false,
    audioInitialized: false,
    synthBgmActive: false,
    activeScreen: "welcome-screen",
    canvas: null,
    ctx: null,
    particles: [],
    balloons: [],
    fireworks: [],
    confetti: [],
    activeParticleType: "hearts", // 'hearts', 'celebration' (adds fireworks, confetti, balloons)
    confettiTimer: null,
    fireworkTimer: null,
    slideshowTimer: null,
    voiceDuration: 6.0, // default placeholder duration if file fails
    voicePlaying: false,
    voiceProgressTimer: null,
    synthInterval: null,
    synthNodes: []
};

// Quiz questions structure
const quizQuestions = [
    { title: "What is your nickname?", correct: CONFIG.nickname },
    { title: "What date did our relationship begin? (DD/MM/YYYY)", correct: CONFIG.anniversaryDate },
    { title: "What is my favorite name that I call you?", correct: CONFIG.favoriteName },
    { title: "Where did we first meet?", correct: CONFIG.meetLocation },
    { title: "How i saved your contact", correct: CONFIG.saveName }
];

// --- 3. AUDIO ENGINE & AUTOPLAY FALLBACKS ---
class AudioEngine {
    constructor() {
        this.bgm = document.getElementById("bgm-audio");
        this.birthdayVoice = document.getElementById("birthday-audio");
        this.audioCtx = null;
        this.hasBgmError = false;
        
        // Handle load errors gracefully to avoid console crashes
        if (this.bgm) {
            const source = this.bgm.querySelector("source");
            if (source) {
                source.addEventListener("error", () => {
                    console.warn("BGM source error. Fallback synth enabled.");
                    this.hasBgmError = true;
                    document.getElementById("music-toggle").classList.remove("audio-loading");
                });
            }
            this.bgm.addEventListener("error", () => {
                console.warn("BGM error. Fallback synth enabled.");
                this.hasBgmError = true;
                document.getElementById("music-toggle").classList.remove("audio-loading");
            });
            this.bgm.addEventListener("canplaythrough", () => {
                document.getElementById("music-toggle").classList.remove("audio-loading");
            });
        }
        
        if (this.birthdayVoice) {
            this.birthdayVoice.addEventListener("error", () => {
                console.warn("Voice file 'happy-birthday.mp3' not found. Speech synthesis fallback will be used.");
            });
            this.birthdayVoice.addEventListener("loadedmetadata", () => {
                state.voiceDuration = this.birthdayVoice.duration || 6.0;
                updateVoiceTimeDisplay(0, state.voiceDuration);
            });
        }
    }

    initCtx() {
        if (this.audioCtx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            this.audioCtx = new AudioContextClass();
        }
    }

    playBgm() {
        state.isAudioPlaying = true;
        document.getElementById("music-toggle").classList.add("playing");
        document.getElementById("music-toggle").querySelector(".mute-line").style.display = "none";
        
        this.initCtx();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        
        // If we already detected a loading error, go straight to synth
        if (this.hasBgmError) {
            this.startSynthBgm();
            return;
        }
        
        // Setup a 1.5 second timeout race in case fetch hangs or gets stuck
        let synthFallbackTimeout = setTimeout(() => {
            if (state.isAudioPlaying && !state.synthBgmActive && (!this.bgm || this.bgm.paused)) {
                console.log("MP3 play timed out, launching fallback synth.");
                this.startSynthBgm();
            }
        }, 1500);
        
        // Try playing native MP3 first
        if (this.bgm) {
            this.bgm.play()
                .then(() => {
                    clearTimeout(synthFallbackTimeout);
                    state.synthBgmActive = false;
                })
                .catch(err => {
                    clearTimeout(synthFallbackTimeout);
                    console.log("MP3 autoplay blocked or failed, launching fallback synth: ", err);
                    this.startSynthBgm();
                });
        } else {
            clearTimeout(synthFallbackTimeout);
            this.startSynthBgm();
        }
    }

    stopBgm() {
        state.isAudioPlaying = false;
        document.getElementById("music-toggle").classList.remove("playing");
        document.getElementById("music-toggle").querySelector(".mute-line").style.display = "block";
        
        if (this.bgm) {
            this.bgm.pause();
        }
        this.stopSynthBgm();
    }

    toggleBgm() {
        this.initCtx();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        
        if (state.isAudioPlaying) {
            this.stopBgm();
        } else {
            this.playBgm();
        }
    }

    // Procedural Piano / Harp Synthesizer for Romantic BGM Fallback
    startSynthBgm() {
        if (state.synthBgmActive) return;
        this.initCtx();
        if (!this.audioCtx) return;
        
        const runSynth = () => {
            state.synthBgmActive = true;
            console.log("Playing fallback procedural romantic melody...");
            
            // Chord progression: Cmaj7 - Am9 - Fmaj7 - G7
            const chords = [
                [48, 52, 55, 59, 64], // Cmaj7
                [45, 48, 52, 55, 59], // Am9
                [41, 45, 48, 52, 57], // Fmaj7
                [43, 47, 50, 53, 59]  // G7
            ];
            
            let chordIndex = 0;
            let noteStep = 0;

            const playNote = (midiNote, delay, duration, volume) => {
                if (!state.synthBgmActive) return;
                const freq = Math.pow(2, (midiNote - 69) / 12) * 440;
                
                const osc = this.audioCtx.createOscillator();
                const gainNode = this.audioCtx.createGain();
                
                // Soft romantic tone: blend of triangle and sine wave
                osc.type = midiNote < 50 ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + delay);
                
                // Gain envelope for smooth fade-in and long ring out
                gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime + delay);
                gainNode.gain.linearRampToValueAtTime(volume, this.audioCtx.currentTime + delay + 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + delay + duration);
                
                // Low-pass filter to keep sound warm and soft
                const filter = this.audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(midiNote < 50 ? 250 : 800, this.audioCtx.currentTime);
                
                osc.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);
                
                osc.start(this.audioCtx.currentTime + delay);
                osc.stop(this.audioCtx.currentTime + delay + duration);
                
                state.synthNodes.push({ osc, gainNode, filter });
            };

            const tick = () => {
                if (!state.synthBgmActive) return;
                const currentChord = chords[chordIndex];
                
                // Play a note from the chord
                const note = currentChord[noteStep % currentChord.length];
                const volume = noteStep % 4 === 0 ? 0.15 : 0.08; // emphasize downbeat
                playNote(note, 0, 1.8, volume);
                
                noteStep++;
                if (noteStep % 8 === 0) {
                    chordIndex = (chordIndex + 1) % chords.length;
                }
                
                // Schedule next tick
                state.synthInterval = setTimeout(tick, 350);
            };
            
            tick();
        };

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().then(runSynth);
        } else {
            runSynth();
        }
    }

    stopSynthBgm() {
        state.synthBgmActive = false;
        if (state.synthInterval) {
            clearTimeout(state.synthInterval);
            state.synthInterval = null;
        }
        // Safely disconnect synthesizer nodes
        state.synthNodes.forEach(node => {
            try {
                node.osc.stop();
                node.osc.disconnect();
                node.gainNode.disconnect();
                node.filter.disconnect();
            } catch (e) {}
        });
        state.synthNodes = [];
    }

    // Play Voice MP3 with speech synthesis fallback
    playVoiceMessage() {
        this.initCtx();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const voiceBtn = document.getElementById("voice-play-btn");
        const playIcon = voiceBtn.querySelector(".play-svg");
        const pauseIcon = voiceBtn.querySelector(".pause-svg");
        
        state.voicePlaying = true;
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
        
        // Lower background music during speech voiceover
        if (this.bgm && state.isAudioPlaying && !state.synthBgmActive) {
            this.bgm.volume = 0.2;
        }
        
        // 1. Play Native File
        if (this.birthdayVoice && this.birthdayVoice.readyState >= 2) {
            this.birthdayVoice.currentTime = 0;
            this.birthdayVoice.play()
                .then(() => {
                    this.trackVoiceProgress(false);
                })
                .catch(err => {
                    console.log("Bday voice playback failed, falling back to speech synth.", err);
                    this.playSpeechSynth();
                });
        } else {
            // 2. Play Speech Synthesis Fallback
            this.playSpeechSynth();
        }
    }

    playSpeechSynth() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // clear queue
            
            const text = "Happy Birthday Thanu! I love you so much. May all your dreams come true.";
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Try to find a warm, romantic female or gentle English voice
            const voices = window.speechSynthesis.getVoices();
            // Look for Google UK English Female, Google US English, etc.
            const preferredVoice = voices.find(v => v.lang.includes('en-GB') || v.lang.includes('en-US')) || voices[0];
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            
            utterance.rate = 0.85; // slightly slower for emotional warmth
            utterance.pitch = 1.05;
            
            utterance.onend = () => {
                this.stopVoiceMessage();
            };
            
            utterance.onerror = () => {
                this.stopVoiceMessage();
            };

            window.speechSynthesis.speak(utterance);
            
            // Fake progression since Speech API doesn't provide precise progress ticking
            state.voiceDuration = 6.5;
            this.trackVoiceProgress(true);
        } else {
            // Web Speech API completely unavailable
            console.error("Speech Synthesis not supported in this browser.");
            setTimeout(() => this.stopVoiceMessage(), 3000);
        }
    }

    trackVoiceProgress(isSpeechSynth) {
        const start = Date.now();
        const fill = document.getElementById("voice-progress");
        
        if (state.voiceProgressTimer) clearInterval(state.voiceProgressTimer);
        
        state.voiceProgressTimer = setInterval(() => {
            let current = 0;
            
            if (isSpeechSynth) {
                current = (Date.now() - start) / 1000;
            } else if (this.birthdayVoice) {
                current = this.birthdayVoice.currentTime;
            }
            
            const percent = Math.min((current / state.voiceDuration) * 100, 100);
            fill.style.width = percent + "%";
            updateVoiceTimeDisplay(current, state.voiceDuration);
            
            if (percent >= 100 || (!isSpeechSynth && this.birthdayVoice && this.birthdayVoice.ended)) {
                this.stopVoiceMessage();
            }
        }, 100);
    }

    stopVoiceMessage() {
        state.voicePlaying = false;
        const voiceBtn = document.getElementById("voice-play-btn");
        const playIcon = voiceBtn.querySelector(".play-svg");
        const pauseIcon = voiceBtn.querySelector(".pause-svg");
        
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
        
        if (this.birthdayVoice) {
            this.birthdayVoice.pause();
        }
        
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        
        if (state.voiceProgressTimer) {
            clearInterval(state.voiceProgressTimer);
            state.voiceProgressTimer = null;
        }
        
        document.getElementById("voice-progress").style.width = "0%";
        updateVoiceTimeDisplay(0, state.voiceDuration);
        
        // Restore background music volume
        if (this.bgm && state.isAudioPlaying && !state.synthBgmActive) {
            this.bgm.volume = 1.0;
        }
    }
}

const audio = new AudioEngine();

function updateVoiceTimeDisplay(current, duration) {
    const formatTime = (time) => {
        if (isNaN(time) || time === Infinity) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    document.getElementById("voice-time").textContent = formatTime(current);
}

// Ensure speech voices are loaded for Speech Synthesis
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
}

// --- 4. HIGH-PERFORMANCE CANVAS ANIMATION SYSTEM ---
class CanvasEngine {
    constructor() {
        state.canvas = document.getElementById("animation-canvas");
        state.ctx = state.canvas.getContext("2d");
        this.resize();
        window.addEventListener("resize", () => this.resize());
        
        this.active = true;
        this.loop();
    }

    resize() {
        state.canvas.width = window.innerWidth;
        state.canvas.height = window.innerHeight;
    }

    spawnHeart(x, y) {
        state.particles.push({
            x: x || Math.random() * state.canvas.width,
            y: y || state.canvas.height + 20,
            size: Math.random() * 15 + 10,
            speedY: Math.random() * 1.5 + 0.8,
            speedX: Math.sin(Math.random() * Math.PI) * 0.5,
            opacity: Math.random() * 0.6 + 0.3,
            color: `hsl(${Math.random() * 30 + 335}, 100%, 75%)`, // Romantic pinks & magentas
            wobble: Math.random() * 100,
            wobbleSpeed: Math.random() * 0.02 + 0.01,
            type: "heart"
        });
    }

    spawnRosePetal() {
        state.particles.push({
            x: Math.random() * state.canvas.width,
            y: -20,
            size: Math.random() * 12 + 8,
            speedY: Math.random() * 1.2 + 1.0,
            speedX: Math.random() * 1.5 - 0.5,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: Math.random() * 0.02 - 0.01,
            opacity: Math.random() * 0.5 + 0.4,
            color: `hsl(${Math.random() * 15 + 345}, 90%, 65%)`,
            wobble: Math.random() * 100,
            type: "petal"
        });
    }

    spawnSparkle() {
        state.particles.push({
            x: Math.random() * state.canvas.width,
            y: Math.random() * state.canvas.height,
            size: Math.random() * 4 + 2,
            opacity: Math.random() * 0.8 + 0.2,
            opacitySpeed: Math.random() * 0.02 + 0.01,
            color: `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`,
            type: "sparkle"
        });
    }

    spawnBalloon() {
        const colors = [
            'rgba(244, 63, 94, 0.75)',  // Rose Pink
            'rgba(236, 72, 153, 0.75)',  // Light Pink
            'rgba(217, 70, 239, 0.75)',  // Purple/Magenta
            'rgba(168, 85, 247, 0.75)',  // Deep Purple
            'rgba(251, 113, 133, 0.75)'  // Peach Pink
        ];
        
        state.balloons.push({
            x: Math.random() * (state.canvas.width - 60) + 30,
            y: state.canvas.height + 100,
            r: Math.random() * 20 + 25,
            speedY: Math.random() * 1.2 + 0.8,
            wobble: Math.random() * 100,
            wobbleSpeed: Math.random() * 0.01 + 0.005,
            color: colors[Math.floor(Math.random() * colors.length)],
            stringLen: Math.random() * 30 + 40
        });
    }

    spawnFirework() {
        const startX = Math.random() * (state.canvas.width - 200) + 100;
        const targetY = Math.random() * (state.canvas.height * 0.4) + 80;
        
        state.fireworks.push({
            x: startX,
            y: state.canvas.height,
            targetY: targetY,
            speed: Math.random() * 3 + 4,
            exploded: false,
            color: `hsl(${Math.random() * 360}, 100%, 65%)`,
            particles: []
        });
    }

    explodeFirework(fw) {
        fw.exploded = true;
        const count = Math.random() * 50 + 60;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 4 + 1.5;
            fw.particles.push({
                x: fw.x,
                y: fw.y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                alpha: 1,
                decay: Math.random() * 0.015 + 0.01,
                color: fw.color
            });
        }
    }

    spawnConfetti() {
        const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#6366f1', '#3b82f6', '#10b981', '#f59e0b'];
        state.confetti.push({
            x: Math.random() * state.canvas.width,
            y: -10,
            w: Math.random() * 6 + 5,
            h: Math.random() * 10 + 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            vy: Math.random() * 2 + 1.5,
            vx: Math.random() * 1.5 - 0.75,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 4 - 2
        });
    }

    drawHeartShape(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y + size / 4);
        ctx.quadraticCurveTo(x, y, x + size / 2, y);
        ctx.quadraticCurveTo(x + size, y, x + size, y + size / 3);
        ctx.quadraticCurveTo(x + size, y + size * 0.6, x + size / 2, y + size);
        ctx.quadraticCurveTo(x, y + size * 0.6, x, y + size / 3);
        ctx.quadraticCurveTo(x, y, x, y + size / 4);
        ctx.closePath();
    }

    loop() {
        if (!this.active) return;
        requestAnimationFrame(() => this.loop());
        
        const ctx = state.ctx;
        const canvas = state.canvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // --- Continuous Spawning ---
        // Spawn sparks & hearts continuously
        if (Math.random() < 0.04) this.spawnHeart();
        if (Math.random() < 0.05) this.spawnRosePetal();
        if (Math.random() < 0.03) this.spawnSparkle();
        
        // Celebration Layer spawning
        if (state.activeParticleType === "celebration") {
            if (state.confetti.length < 120 && Math.random() < 0.3) {
                this.spawnConfetti();
            }
            if (state.balloons.length < 8 && Math.random() < 0.01) {
                this.spawnBalloon();
            }
        }

        // --- Render & Update Hearts, Petals, Sparkles ---
        for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            ctx.save();
            
            if (p.type === "heart") {
                p.wobble += p.wobbleSpeed;
                p.x += Math.sin(p.wobble) * 0.5;
                p.y -= p.speedY;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                this.drawHeartShape(ctx, p.x, p.y, p.size);
                ctx.fill();
                
                if (p.y < -p.size) state.particles.splice(i, 1);
                
            } else if (p.type === "petal") {
                p.wobble += 0.02;
                p.x += Math.sin(p.wobble) * 0.6 + p.speedX;
                p.y += p.speedY;
                p.rotation += p.rotationSpeed;
                
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                
                // Draw leaf/petal oval shape
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
                
                if (p.y > canvas.height + 20) state.particles.splice(i, 1);
                
            } else if (p.type === "sparkle") {
                p.opacity -= p.opacitySpeed;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                
                if (p.opacity <= 0) state.particles.splice(i, 1);
            }
            
            ctx.restore();
        }

        // --- Render & Update Confetti ---
        for (let i = state.confetti.length - 1; i >= 0; i--) {
            const c = state.confetti[i];
            c.y += c.vy;
            c.x += c.vx;
            c.rotation += c.rotationSpeed;
            
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rotation * Math.PI / 180);
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h);
            ctx.restore();
            
            if (c.y > canvas.height + 20) state.confetti.splice(i, 1);
        }

        // --- Render & Update Balloons ---
        for (let i = state.balloons.length - 1; i >= 0; i--) {
            const b = state.balloons[i];
            b.wobble += b.wobbleSpeed;
            b.x += Math.sin(b.wobble) * 0.8;
            b.y -= b.speedY;
            
            ctx.save();
            ctx.fillStyle = b.color;
            
            // Draw balloon body
            ctx.beginPath();
            ctx.ellipse(b.x, b.y, b.r * 0.85, b.r, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw balloon tie triangle
            ctx.beginPath();
            ctx.moveTo(b.x, b.y + b.r);
            ctx.lineTo(b.x - 6, b.y + b.r + 8);
            ctx.lineTo(b.x + 6, b.y + b.r + 8);
            ctx.closePath();
            ctx.fill();
            
            // Draw string
            ctx.beginPath();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
            ctx.lineWidth = 1.5;
            ctx.moveTo(b.x, b.y + b.r + 8);
            // wavy string
            ctx.bezierCurveTo(
                b.x - 5, b.y + b.r + 20, 
                b.x + 5, b.y + b.r + 30, 
                b.x - 2, b.y + b.r + b.stringLen
            );
            ctx.stroke();
            ctx.restore();
            
            if (b.y < -b.r - b.stringLen) state.balloons.splice(i, 1);
        }

        // --- Render & Update Fireworks ---
        for (let i = state.fireworks.length - 1; i >= 0; i--) {
            const fw = state.fireworks[i];
            
            if (!fw.exploded) {
                fw.y -= fw.speed;
                // Draw rocket trail
                ctx.save();
                ctx.fillStyle = fw.color;
                ctx.beginPath();
                ctx.arc(fw.x, fw.y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                
                if (fw.y <= fw.targetY) {
                    this.explodeFirework(fw);
                }
            } else {
                // Update debris particles
                let activeDebris = false;
                for (let j = fw.particles.length - 1; j >= 0; j--) {
                    const p = fw.particles[j];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.05; // gravity pull
                    p.alpha -= p.decay;
                    
                    if (p.alpha > 0) {
                        activeDebris = true;
                        ctx.save();
                        ctx.globalAlpha = p.alpha;
                        ctx.fillStyle = p.color;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, Math.max(0.5, p.alpha * 2.5), 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
                if (!activeDebris) {
                    state.fireworks.splice(i, 1);
                }
            }
        }
    }
}

let canvasEngine;

// --- 5. SYSTEM COORDINATOR & SCREEN SEQUENCER ---
function transitionScreenTo(targetScreenId) {
    const currentActive = document.querySelector('section.active');
    const targetSection = document.getElementById(targetScreenId);
    
    if (currentActive) {
        currentActive.classList.remove('active');
        // Delay to allow fade animation to complete
        setTimeout(() => {
            targetSection.classList.add('active');
            state.activeScreen = targetScreenId;
            onScreenFocus(targetScreenId);
        }, 1000);
    } else {
        targetSection.classList.add('active');
        state.activeScreen = targetScreenId;
        onScreenFocus(targetScreenId);
    }
}

// Lifecycle hook when a screen becomes visible
function onScreenFocus(screenId) {
    if (screenId === "quiz-screen") {
        state.currentQuizIndex = 0;
        loadQuizQuestion();
    } else if (screenId === "transition-screen") {
        // Automatically advance transition page after 4 seconds (allows 4s animation to finish)
        setTimeout(() => {
            transitionScreenTo("slideshow-screen");
        }, 4500);
    } else if (screenId === "slideshow-screen") {
        startCinematicSlideshow();
    } else if (screenId === "celebration-screen") {
        startGrandCelebration();
    }
}

// --- 6. QUIZ SCREEN CONTROLLER ---
function loadQuizQuestion() {
    const q = quizQuestions[state.currentQuizIndex];
    document.getElementById("quiz-step-text").textContent = `Question ${state.currentQuizIndex + 1} of ${quizQuestions.length}`;
    
    // Update progress bar
    const progressPercent = ((state.currentQuizIndex) / quizQuestions.length) * 100;
    document.getElementById("quiz-progress-fill").style.width = progressPercent + "%";
    
    // Question Title
    document.getElementById("quiz-question-title").textContent = q.title;
    
    // Clear Input and status
    const input = document.getElementById("quiz-input");
    input.value = "";
    input.focus();
    
    document.getElementById("error-msg").classList.remove("visible");
    
    // Reset Hint
    const hintMsg = document.getElementById("hint-msg");
    hintMsg.classList.remove("visible");
    hintMsg.textContent = "";
}

function handleQuizSubmit() {
    const input = document.getElementById("quiz-input").value.trim().toLowerCase();
    const correctVal = quizQuestions[state.currentQuizIndex].correct.trim().toLowerCase();
    const errorMsg = document.getElementById("error-msg");
    const hintMsg = document.getElementById("hint-msg");
    const quizCard = document.getElementById("quiz-card");
    const overlay = document.getElementById("quiz-overlay");
    
    // Check answer equivalence
    if (isAnswerCorrect(input, correctVal, state.currentQuizIndex)) {
        // Play success check animation
        overlay.classList.add("active");
        
        setTimeout(() => {
            overlay.classList.remove("active");
            state.currentQuizIndex++;
            
            if (state.currentQuizIndex < quizQuestions.length) {
                loadQuizQuestion();
            } else {
                // Quiz completed! Update final progress bar fill and advance
                document.getElementById("quiz-progress-fill").style.width = "100%";
                setTimeout(() => {
                    transitionScreenTo("transition-screen");
                }, 400);
            }
        }, 1800); // Overlay visible for 1.8 seconds
    } else {
        // Shake card and show error
        quizCard.classList.add("shake-card");
        errorMsg.classList.add("visible");
        
        // Show hint if it is Question 4 (index 3)
        if (state.currentQuizIndex === 3) {
            hintMsg.textContent = `Near the (place)`;
            hintMsg.classList.add("visible");
        }
        
        // Remove shake class after animation completes
        setTimeout(() => {
            quizCard.classList.remove("shake-card");
        }, 500);
    }
}

// Custom normalization helper for dates and names
function isAnswerCorrect(userAns, targetAns, index) {
    if (userAns === targetAns) return true;
    
    // Normalize string: remove special chars, extra space, case
    const clean = str => str.replace(/[^a-zA-Z0-9]/g, "").trim();
    if (clean(userAns) === clean(targetAns)) return true;
    
    // Date flexible checking (For Anniversary Q2 & Birthday Q5)
    // Targets: "15/08/2024" or "12 July"
    if (index === 1 || index === 4) {
        // Convert both into date tokens and check matches
        // e.g. "12 july" -> ["12", "july"]
        // "12/07/1998" -> ["12", "7", "1998"] or ["12", "07"]
        const userTokens = userAns.match(/[a-zA-Z]+|[0-9]+/g) || [];
        const targetTokens = targetAns.match(/[a-zA-Z]+|[0-9]+/g) || [];
        
        if (userTokens.length > 0 && targetTokens.length > 0) {
            // Check if month matches (either string or number like '08' and '8')
            const monthsMap = {
                'jan': ['1', '01', 'january'], 'feb': ['2', '02', 'february'],
                'mar': ['3', '03', 'march'], 'apr': ['4', '04', 'april'],
                'may': ['5', '05', 'may'], 'jun': ['6', '06', 'june'],
                'jul': ['7', '07', 'july'], 'aug': ['8', '08', 'august'],
                'sep': ['9', '09', 'september', 'sept'], 'oct': ['10', 'october'],
                'nov': ['11', 'november'], 'dec': ['12', 'december']
            };
            
            // Check matching month codes or numbers
            let userMonth = null;
            let targetMonth = null;
            let userDay = null;
            let targetDay = null;
            
            userTokens.forEach(t => {
                if (isNaN(t)) {
                    const short = t.substring(0, 3);
                    if (monthsMap[short]) userMonth = short;
                } else {
                    const num = parseInt(t);
                    if (num > 0 && num <= 31) userDay = num;
                    else if (num > 0 && num <= 12) userMonth = num.toString();
                }
            });
            
            targetTokens.forEach(t => {
                if (isNaN(t)) {
                    const short = t.substring(0, 3);
                    if (monthsMap[short]) targetMonth = short;
                } else {
                    const num = parseInt(t);
                    if (num > 0 && num <= 31) targetDay = num;
                    else if (num > 0 && num <= 12) targetMonth = num.toString();
                }
            });

            // Map numeric months to codes for comparison
            const getMonthCode = (val) => {
                if (!val) return null;
                if (isNaN(val)) return val;
                for (let key in monthsMap) {
                    if (monthsMap[key].includes(val) || monthsMap[key].includes(val.padStart(2, '0'))) {
                        return key;
                    }
                }
                return null;
            };

            const uMCode = getMonthCode(userMonth);
            const tMCode = getMonthCode(targetMonth);

            if (userDay === targetDay && uMCode === tMCode && uMCode !== null) {
                return true;
            }
        }
    }
    
    return false;
}

// --- 7. CINEMATIC SLIDESHOW CONTROLLER ---
function startCinematicSlideshow() {
    const slideshowCard = document.getElementById("slideshow-card");
    const slideshowImg = document.getElementById("slideshow-img");
    const slideshowCaption = document.getElementById("slideshow-caption");
    const quoteOverlay = document.getElementById("slideshow-quote-overlay");
    const quoteText = document.getElementById("slideshow-quote-text");
    
    let slideIdx = 0;
    let quoteIdx = 0;
    
    // Clear elements
    slideshowCard.className = "polaroid-card";
    
    const showNextSlide = () => {
        if (slideIdx >= CONFIG.slideshow.length) {
            // Slideshow complete, transition to grand celebration
            clearInterval(state.slideshowTimer);
            setTimeout(() => {
                transitionScreenTo("celebration-screen");
            }, 1000);
            return;
        }
        
        const slide = CONFIG.slideshow[slideIdx];
        
        // Hide card for transition
        slideshowCard.classList.remove("active");
        
        // Hide quote panel
        quoteOverlay.classList.remove("visible");
        
        setTimeout(() => {
            // Load Image
            slideshowImg.src = slide.url;
            slideshowCaption.textContent = slide.caption;
            
            // Set transition effect class
            slideshowCard.className = `polaroid-card active ${slide.effect}`;
            
            // Show romantic quote every alternate slide
            if (slideIdx % 2 === 0 && quoteIdx < CONFIG.quotes.length) {
                quoteText.textContent = CONFIG.quotes[quoteIdx];
                quoteOverlay.classList.add("visible");
                quoteIdx++;
            }
            
            slideIdx++;
        }, 800);
    };

    // Show initial slide immediately
    showNextSlide();
    
    // Change slide every 4 seconds (allowing 3.2s view + 0.8s slide transition)
    state.slideshowTimer = setInterval(showNextSlide, 4500);
}

// --- 8. GRAND CELEBRATION CONTROLLER ---
function startGrandCelebration() {
    state.activeParticleType = "celebration";
    
    // Trigger letter paragraph animations by adding active-reveal class
    const celebCard = document.querySelector(".celebration-card");
    celebCard.classList.add("active-reveal");
    
    // 1. Spawning continuous fireworks every 2 seconds
    if (state.fireworkTimer) clearInterval(state.fireworkTimer);
    state.fireworkTimer = setInterval(() => {
        canvasEngine.spawnFirework();
        // Occasionally double burst
        if (Math.random() < 0.3) {
            setTimeout(() => canvasEngine.spawnFirework(), 400);
        }
    }, 2000);

    // 2. Play Birthday audio voice recording (with synth speech fallback)
    setTimeout(() => {
        audio.playVoiceMessage();
    }, 1500);

    // 3. Stop Confetti rain after 10 seconds (restricting continuous frame load)
    if (state.confettiTimer) clearTimeout(state.confettiTimer);
    state.confettiTimer = setTimeout(() => {
        // Clear confetti generation, let existing confetti drop out
        console.log("Confetti burst complete.");
    }, 10000);
}

// Resets state back to starting screen
function resetSurpriseState() {
    // Stop audio players
    audio.stopVoiceMessage();
    audio.stopBgm();
    
    // Reset state variables
    state.currentQuizIndex = 0;
    state.activeParticleType = "hearts";
    state.balloons = [];
    state.fireworks = [];
    state.confetti = [];
    state.particles = [];
    
    // Clear timers
    if (state.fireworkTimer) clearInterval(state.fireworkTimer);
    if (state.confettiTimer) clearTimeout(state.confettiTimer);
    if (state.slideshowTimer) clearInterval(state.slideshowTimer);
    
    // Clear styling classes
    const celebCard = document.querySelector(".celebration-card");
    celebCard.classList.remove("active-reveal");
    
    // Return to welcome page
    transitionScreenTo("welcome-screen");
}

// --- 9. DOM INITIALIZATION & EVENT LISTENERS ---
document.addEventListener("DOMContentLoaded", () => {
    // Launch Canvas Particles
    canvasEngine = new CanvasEngine();
    
    // Preload slideshow images in background for instant transitions
    preloadSlideshowImages();
    
    // Welcome screen start button
    document.getElementById("start-btn").addEventListener("click", () => {
        // Initialize Audio context on user gesture
        audio.initCtx();
        audio.playBgm();
        
        // Go to Quiz Screen
        transitionScreenTo("quiz-screen");
    });
    
    // Music floating action button
    document.getElementById("music-toggle").addEventListener("click", () => {
        audio.toggleBgm();
    });
    
    // Quiz submission handlers
    document.getElementById("quiz-submit-btn").addEventListener("click", () => {
        handleQuizSubmit();
    });
    
    document.getElementById("quiz-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleQuizSubmit();
        }
    });
    
    // Voice playback panel buttons
    document.getElementById("voice-play-btn").addEventListener("click", () => {
        if (state.voicePlaying) {
            audio.stopVoiceMessage();
        } else {
            audio.playVoiceMessage();
        }
    });
    
    // Replay/Reset surprise flow button
    document.getElementById("play-again-btn").addEventListener("click", () => {
        resetSurpriseState();
    });
});

// Image preloader helper
function preloadSlideshowImages() {
    console.log("Preloading slideshow images...");
    CONFIG.slideshow.forEach(slide => {
        const img = new Image();
        img.src = slide.url;
    });
}

// Image fallback helper if file is missing/broken
function handleImageError(img) {
    console.error("Failed to load image at: " + img.src);
    // Render a high-quality SVG heart vector placeholder so the Polaroid frame is never blank
    img.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 100 100%22%3E%3Crect width%3D%22100%22 height%3D%22100%22 fill%3D%22%23fff1f2%22%2F%3E%3Cpath d%3D%22M50,30 C35,10 10,25 10,50 C10,75 50,95 50,95 C50,95 90,75 90,50 C90,25 65,10 50,30 Z%22 fill%3D%22%23f43f5e%22%2F%3E%3C%2Fsvg%3E";
}
