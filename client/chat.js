// SafeSpace AI Chat Interface JavaScript

class ChatInterface {
    constructor() {
        this.chatContainer = document.getElementById('chatContainer');
        this.dashboardContainer = document.getElementById('dashboardContainer');
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.micBtn = document.getElementById('micBtn');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.sendBtn = document.getElementById('sendBtn');
        this.backBtn = document.getElementById('backBtn');
        this.startChatBtn = document.getElementById('startChatBtn');
        this.chatPreviewCard = document.getElementById('chatPreviewCard');
        this.breathingExerciseBtn = document.getElementById('breathingExerciseBtn');
        this.breathingModal = document.getElementById('breathingModal');
        this.breathingCloseBtn = document.getElementById('breathingCloseBtn');
        this.breathingToggleBtn = document.getElementById('breathingToggleBtn');
        this.breathingResetBtn = document.getElementById('breathingResetBtn');
        this.breathingVisualizer = document.getElementById('breathingVisualizer');
        this.breathingPhaseLabel = document.getElementById('breathingPhaseLabel');
        this.breathingCount = document.getElementById('breathingCount');
        this.breathingCycle = document.getElementById('breathingCycle');
        this.breathingDot = document.getElementById('breathingDot');
        this.phaseCards = document.querySelectorAll('[data-phase-card]');
        this.isTyping = false;
        this.isListening = false;
        this.speechRecognition = null;
        this.speechBaseText = '';
        this.messageHistory = [];
        this.breathingState = {
            phases: [
                { key: 'inhale', label: 'Inhale', seconds: 4, progress: 0 },
                { key: 'hold-1', label: 'Hold', seconds: 4, progress: 0.26 },
                { key: 'exhale', label: 'Exhale', seconds: 4, progress: 0.5 },
                { key: 'hold-2', label: 'Hold', seconds: 4, progress: 0.75 }
            ],
            cycleTarget: 4,
            currentPhaseIndex: 0,
            remaining: 4,      // countdown display (whole seconds)
            cycle: 1,
            intervalId: null,  // legacy — no longer used
            rafId: null,       // requestAnimationFrame handle
            phaseStartTime: null,  // performance.now() when current phase began
            phaseElapsed: 0,       // seconds elapsed when paused (for seamless resume)
            isRunning: false
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupAutoResize();
        this.setupSpeechRecognition();
        this.loadWelcomeMessage();
        this.updateBreathingUI();
        this.updateVoiceUI();
    }
    
    setupEventListeners() {
        // Start Chat button
        if (this.startChatBtn) {
            this.startChatBtn.addEventListener('click', () => {
                this.openChat();
            });
        }

        if (this.chatPreviewCard) {
            this.chatPreviewCard.setAttribute('role', 'button');
            this.chatPreviewCard.setAttribute('tabindex', '0');
            this.chatPreviewCard.addEventListener('click', (event) => {
                if (event.target.closest('button, input, textarea, a')) return;
                this.openChat();
            });
            this.chatPreviewCard.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.openChat();
                }
            });
        }

        if (this.breathingExerciseBtn) {
            this.breathingExerciseBtn.addEventListener('click', () => {
                this.openBreathingExercise();
            });
        }
        
        // Back button
        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => {
                this.closeChat();
            });
        }

        if (this.breathingCloseBtn) {
            this.breathingCloseBtn.addEventListener('click', () => {
                this.closeBreathingExercise();
            });
        }

        if (this.breathingModal) {
            this.breathingModal.addEventListener('click', (e) => {
                if (e.target === this.breathingModal) {
                    this.closeBreathingExercise();
                }
            });
        }

        if (this.breathingToggleBtn) {
            this.breathingToggleBtn.addEventListener('click', () => {
                this.toggleBreathingExercise();
            });
        }

        if (this.breathingResetBtn) {
            this.breathingResetBtn.addEventListener('click', () => {
                this.resetBreathingExercise();
                this.startBreathingExercise();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.breathingModal?.classList.contains('active')) {
                this.closeBreathingExercise();
            }
        });
        
        // Send button
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        if (this.micBtn) {
            this.micBtn.addEventListener('click', () => {
                this.toggleVoiceInput();
            });
        }
        
        // Enter key to send
        if (this.messageInput) {
            this.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        // Quick response buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-response-btn')) {
                const response = e.target.dataset.response;
                this.sendQuickResponse(response);
            }
        });
        
        // Auto-hide quick responses after first message
        if (this.messageInput) {
            this.messageInput.addEventListener('input', () => {
                this.hideQuickResponses();
            });
        }
    }
    
    setupAutoResize() {
        if (!this.messageInput) return;
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
        });
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            this.updateVoiceUI('Voice input is not supported in this browser.', true);
            return;
        }

        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.lang = 'en-US';
        this.speechRecognition.interimResults = true;
        this.speechRecognition.continuous = false;

        this.speechRecognition.onstart = () => {
            this.isListening = true;
            this.speechBaseText = this.messageInput.value.trim();
            this.updateVoiceUI('Listening...');
        };

        this.speechRecognition.onresult = (event) => {
            let transcript = '';

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                transcript += event.results[i][0].transcript;
            }

            const baseText = this.speechBaseText ? `${this.speechBaseText} ` : '';
            this.messageInput.value = `${baseText}${transcript}`.trimStart();
            this.messageInput.dispatchEvent(new Event('input'));
            this.updateVoiceUI(event.results[event.results.length - 1].isFinal ? 'Voice captured.' : 'Listening...');
        };

        this.speechRecognition.onerror = (event) => {
            this.isListening = false;

            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                this.updateVoiceUI('Microphone permission is blocked.', true);
            } else if (event.error === 'no-speech') {
                this.updateVoiceUI('No speech detected. Try again.');
            } else {
                this.updateVoiceUI('Voice input is unavailable right now.', true);
            }

            this.updateMicButton();
        };

        this.speechRecognition.onend = () => {
            this.isListening = false;
            this.updateMicButton();

            if (this.voiceStatus && this.voiceStatus.dataset.error !== 'true') {
                this.updateVoiceUI(this.messageInput.value.trim() ? 'Voice input ready.' : '');
            }
        };
    }
    
    openChat() {
        if (!this.chatContainer || !this.dashboardContainer) return;
        this.dashboardContainer.style.display = 'none';
        this.chatContainer.classList.add('active');
        this.messageInput?.focus();
        
        this.chatContainer.style.animation = 'fadeIn 0.3s ease';
    }

    openChatWithMessage(message = '') {
        this.openChat();
        const text = message.trim();
        if (!text || !this.messageInput) return;

        window.setTimeout(() => {
            this.messageInput.value = text;
            this.messageInput.dispatchEvent(new Event('input'));
            this.sendMessage();
        }, 80);
    }
    
    closeChat() {
        this.stopVoiceInput();
        this.chatContainer?.classList.remove('active');
        if (this.dashboardContainer) {
            this.dashboardContainer.style.display = '';
        }
    }

    openBreathingExercise() {
        if (!this.breathingModal) return;

        this.breathingModal.classList.add('active');
        this.breathingModal.setAttribute('aria-hidden', 'false');
        this.resetBreathingExercise();
        this.startBreathingExercise();
    }

    closeBreathingExercise() {
        if (!this.breathingModal) return;

        this.stopBreathingTimer();
        this.breathingModal.classList.remove('active');
        this.breathingModal.setAttribute('aria-hidden', 'true');
    }

    toggleBreathingExercise() {
        if (!this.breathingState.isRunning && this.breathingState.remaining === 0) {
            this.resetBreathingExercise();
        }

        if (this.breathingState.isRunning) {
            this.stopBreathingTimer();
            this.breathingToggleBtn.textContent = 'Resume';
            return;
        }

        this.startBreathingExercise();
    }

    startBreathingExercise() {
        this.stopBreathingTimer();
        this.breathingState.isRunning = true;
        // Resume from wherever the phase was paused (phaseElapsed = 0 for a fresh start).
        this.breathingState.phaseStartTime =
            performance.now() - this.breathingState.phaseElapsed * 1000;
        if (this.breathingToggleBtn) {
            this.breathingToggleBtn.textContent = 'Pause';
        }
        this.updateBreathingUI();
        this.breathingState.rafId = requestAnimationFrame(() => this._tickBreathing());
    }

    stopBreathingTimer() {
        if (this.breathingState.rafId) {
            cancelAnimationFrame(this.breathingState.rafId);
            this.breathingState.rafId = null;
        }
        // Legacy interval guard (should never fire, but safe to keep)
        if (this.breathingState.intervalId) {
            clearInterval(this.breathingState.intervalId);
            this.breathingState.intervalId = null;
        }
        // Snapshot elapsed so we can resume from the exact same spot.
        if (this.breathingState.phaseStartTime !== null) {
            const phase = this.getCurrentBreathingPhase();
            this.breathingState.phaseElapsed = Math.min(
                (performance.now() - this.breathingState.phaseStartTime) / 1000,
                phase.seconds
            );
        }
        this.breathingState.isRunning = false;
    }

    resetBreathingExercise() {
        this.stopBreathingTimer();
        this.breathingState.currentPhaseIndex = 0;
        this.breathingState.cycle = 1;
        this.breathingState.remaining = this.breathingState.phases[0].seconds;
        this.breathingState.phaseStartTime = null;
        this.breathingState.phaseElapsed = 0;
        if (this.breathingToggleBtn) {
            this.breathingToggleBtn.textContent = 'Pause';
        }
        this.updateBreathingUI();
    }

    // ---- rAF-based breathing engine ----

    /** Called every animation frame while the exercise is running. */
    _tickBreathing() {
        if (!this.breathingState.isRunning) return;

        const phase = this.getCurrentBreathingPhase();
        const elapsed = (performance.now() - this.breathingState.phaseStartTime) / 1000;
        const phaseDuration = phase.seconds;

        // Move dot continuously using real elapsed time.
        const fraction = Math.min(elapsed / phaseDuration, 1);
        this._updateDotFromFraction(fraction, phase);

        // Countdown display: only re-render when the whole-second value changes.
        const newRemaining = Math.max(0, Math.ceil(phaseDuration - elapsed));
        if (newRemaining !== this.breathingState.remaining) {
            this.breathingState.remaining = newRemaining;
            if (this.breathingCount) {
                this.breathingCount.textContent = newRemaining;
            }
        }

        // Phase complete — advance.
        if (elapsed >= phaseDuration) {
            this._advanceToNextPhase();
            return;
        }

        this.breathingState.rafId = requestAnimationFrame(() => this._tickBreathing());
    }

    /** Transition to the next phase (or complete the session). */
    _advanceToNextPhase() {
        const phaseCount = this.breathingState.phases.length;
        const completedCycle = this.breathingState.currentPhaseIndex === phaseCount - 1;

        if (completedCycle) {
            if (this.breathingState.cycle >= this.breathingState.cycleTarget) {
                this.stopBreathingTimer();
                this.breathingState.remaining = 0;
                this.breathingState.currentPhaseIndex = phaseCount - 1;
                this.updateBreathingUI(true);
                if (this.breathingToggleBtn) {
                    this.breathingToggleBtn.textContent = 'Start Again';
                }
                return;
            }
            this.breathingState.cycle += 1;
        }

        this.breathingState.currentPhaseIndex =
            (this.breathingState.currentPhaseIndex + 1) % phaseCount;
        const newPhase = this.getCurrentBreathingPhase();
        this.breathingState.remaining = newPhase.seconds;
        this.breathingState.phaseElapsed = 0;
        this.breathingState.phaseStartTime = performance.now();
        this.updateBreathingUI();
        this.breathingState.rafId = requestAnimationFrame(() => this._tickBreathing());
    }

    /** Compute and apply dot (x, y) from a 0–1 fraction through the given phase. */
    _updateDotFromFraction(fraction, phase) {
        if (!this.breathingDot || !this.breathingVisualizer) return;

        const size = this.breathingVisualizer.clientWidth;
        const dotSize = this.breathingDot.offsetWidth || 22;
        const travel = Math.max(size - dotSize, 0);

        let x = 0;
        let y = 0;
        if (phase.key === 'inhale') {
            x = travel * fraction;
        } else if (phase.key === 'hold-1') {
            x = travel;
            y = travel * fraction;
        } else if (phase.key === 'exhale') {
            x = travel * (1 - fraction);
            y = travel;
        } else if (phase.key === 'hold-2') {
            y = travel * (1 - fraction);
        }

        this.breathingDot.style.left = `${x}px`;
        this.breathingDot.style.top  = `${y}px`;
    }

    getCurrentBreathingPhase() {
        return this.breathingState.phases[this.breathingState.currentPhaseIndex];
    }

    updateBreathingUI(isComplete = false) {
        const phase = this.getCurrentBreathingPhase();
        if (!phase) return;

        if (this.breathingPhaseLabel) {
            this.breathingPhaseLabel.textContent = isComplete ? 'Complete' : phase.label;
        }

        if (this.breathingCount) {
            this.breathingCount.textContent = isComplete ? 'Done' : this.breathingState.remaining;
        }

        if (this.breathingCycle) {
            this.breathingCycle.textContent = isComplete
                ? 'Four calming cycles completed'
                : `Cycle ${this.breathingState.cycle} of ${this.breathingState.cycleTarget}`;
        }

        if (this.breathingVisualizer) {
            this.breathingVisualizer.dataset.phase = phase.key;
            this.breathingVisualizer.dataset.complete = isComplete ? 'true' : 'false';
            this.breathingVisualizer.style.setProperty('--breathing-progress', String(phase.progress));
        }

        this.updateBreathingDot(isComplete);

        this.phaseCards.forEach((card) => {
            const isActive = !isComplete && card.dataset.phaseCard === phase.key;
            card.classList.toggle('active', isActive);
        });
    }

    updateBreathingDot(isComplete = false) {
        if (!this.breathingDot || !this.breathingVisualizer) return;

        if (isComplete) {
            this.breathingDot.style.left = '0px';
            this.breathingDot.style.top  = '0px';
            return;
        }

        // Static snapshot: used when paused or at reset (rAF handles the running case).
        const phase    = this.getCurrentBreathingPhase();
        const fraction = Math.min(this.breathingState.phaseElapsed / phase.seconds, 1);
        this._updateDotFromFraction(fraction, phase);
    }
    
    sendMessage() {
        if (this.isTyping) return;
        const message = this.messageInput.value.trim();
        if (!message) return;

        this.stopVoiceInput();
        
        // Add user message
        this.addMessage(message, 'user');
        
        // Clear input
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        
        // Hide quick responses
        this.hideQuickResponses();
        
        // Show typing indicator
        this.showTypingIndicator();
        this.setSendingState(true);
        
        this.callRagApi(message);
    }

    toggleVoiceInput() {
        if (!this.speechRecognition) {
            this.updateVoiceUI('Voice input is not supported in this browser.', true);
            return;
        }

        if (this.isListening) {
            this.stopVoiceInput();
            this.updateVoiceUI(this.messageInput.value.trim() ? 'Voice input paused.' : '');
            return;
        }

        this.voiceStatus?.removeAttribute('data-error');

        try {
            this.speechRecognition.start();
        } catch (error) {
            this.updateVoiceUI('Voice input could not start.', true);
        }
    }

    stopVoiceInput() {
        if (!this.speechRecognition || !this.isListening) return;
        this.speechRecognition.stop();
    }

    updateVoiceUI(message = '', isError = false) {
        if (this.voiceStatus) {
            this.voiceStatus.textContent = message;
            this.voiceStatus.dataset.error = isError ? 'true' : 'false';
        }

        this.updateMicButton();
    }

    updateMicButton() {
        if (!this.micBtn) return;

        const unsupported = !this.speechRecognition;
        this.micBtn.disabled = unsupported;
        this.micBtn.classList.toggle('active', this.isListening);
        this.micBtn.classList.toggle('unsupported', unsupported);
        this.micBtn.setAttribute(
            'aria-label',
            unsupported ? 'Voice input unavailable' : this.isListening ? 'Stop voice input' : 'Start voice input'
        );
    }
      
    async callRagApi(userMessage) {
        try {
            const response = await fetch(`${APP_CONFIG.apiBaseUrl}/rag`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ 
                    userMessage,
                    conversationHistory: this.messageHistory.slice(-6).map(m => ({
                        role: m.sender === 'user' ? 'user' : 'assistant',
                        content: m.content
                    }))
                })
            });

            let data = {};
            try {
                data = await response.json();
            } catch {
                /* non-JSON body */
            }

            this.hideTypingIndicator();
            this.setSendingState(false);

            if (!response.ok) {
                let detail = `Something went wrong (${response.status}).`;
                if (typeof data.detail === 'string') {
                    detail = data.detail;
                } else if (Array.isArray(data.detail)) {
                    detail = data.detail.map((d) => d.msg || d.message || JSON.stringify(d)).join(' ');
                }
                this.addMessage(detail, 'bot');
                console.error('RAG API Error:', response.status, data);
                return;
            }

            const safetyLevel = data.safety_level ?? 'safe';
            if (data.sections) {
                this.addBotMessage(data.sections, safetyLevel);
            } else {
                this.addMessage(data.reply ?? 'No reply from the assistant.', 'bot');
            }
        } catch (err) {
            this.hideTypingIndicator();
            this.setSendingState(false);
            const reason = err && err.message ? err.message : String(err);
            const isNetwork =
                /failed to fetch|networkerror|load failed|aborted/i.test(reason) ||
                err.name === "TypeError";
            const hint = isNetwork
                ? `Cannot reach the API at ${APP_CONFIG.apiBaseUrl}. Start the backend (e.g. python server.py in the server folder), ensure client/config.js matches your PORT in server/.env, and open the site over http://localhost (not as a file:// page).`
                : reason;
            this.addMessage(
                isNetwork
                    ? "I’m having a little trouble connecting right now. Please try again in a moment — I’m here for you."
                    : "Something went wrong on my end. Please try sending your message again.",
                "bot"
            );
            console.error("RAG API Error:", err);
        }
    }

    setSendingState(isSending) {
        if (this.sendBtn) {
            this.sendBtn.disabled = isSending;
            this.sendBtn.setAttribute('aria-busy', isSending ? 'true' : 'false');
        }
        if (this.messageInput) {
            this.messageInput.disabled = isSending;
        }
    }

    
    sendQuickResponse(response) {
        this.messageInput.value = response;
        this.sendMessage();
    }
    
    addBotMessage(sections, safetyLevel = 'safe') {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        const avatarIcon = document.createElement('div');
        avatarIcon.className = 'avatar-icon';
        avatarIcon.textContent = '🤖';
        avatarDiv.appendChild(avatarIcon);

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble response-harness'
            + (safetyLevel === 'crisis'  ? ' response-harness--crisis'  : '')
            + (safetyLevel === 'support' ? ' response-harness--support' : '');

        const sectionDefs = [
            { key: 'acknowledge', cls: 'harness-acknowledge', prefix: '🌿 ' },
            { key: 'explore',     cls: 'harness-explore' },
            { key: 'reframe',     cls: 'harness-reframe' },
            { key: 'try_this',    cls: safetyLevel === 'crisis' ? 'harness-try harness-try--crisis' : 'harness-try', label: safetyLevel === 'crisis' ? '🆘 Please do this now' : '✨ Try this' },
            { key: 'question',    cls: 'harness-question',   prefix: '💬 ' },
        ];

        let hasContent = false;
        for (const def of sectionDefs) {
            const text = sections[def.key];
            if (!text) continue;
            hasContent = true;

            const section = document.createElement('div');
            section.className = `harness-section ${def.cls}`;

            const p = document.createElement('p');

            if (def.label) {
                const label = document.createElement('span');
                label.className = 'harness-label';
                label.textContent = def.label + ' ';
                p.appendChild(label);
                p.appendChild(document.createTextNode(text));
            } else {
                p.textContent = def.prefix ? `${def.prefix}${text}` : text;
            }

            section.appendChild(p);

            bubble.appendChild(section);
        }

        if (!hasContent) {
            const p = document.createElement('p');
            p.textContent = "I'm here for you.";
            bubble.appendChild(p);
        }

        // Tool suggestion buttons (breathing / music) when model recommends them
        const suggest = Array.isArray(sections.suggest) ? sections.suggest : [];
        if (suggest.length > 0 && safetyLevel !== 'crisis') {
            bubble.appendChild(this._buildToolSuggestions(suggest));
        }

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.getCurrentTime();

        messageContent.appendChild(bubble);
        messageContent.appendChild(messageTime);
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(messageContent);

        this.chatMessages.appendChild(messageDiv);

        if (safetyLevel === 'crisis')  this.addCrisisCard();
        if (safetyLevel === 'support') this.addSupportNudge();

        this.messageHistory.push({
            content: Object.values(sections).filter(Boolean).join(' '),
            sender: 'bot',
            timestamp: new Date().toISOString()
        });
    }

    addCrisisCard() {
        const card = document.createElement('div');
        card.className = 'crisis-resource-card';
        card.setAttribute('role', 'alert');
        card.innerHTML = `
            <div class="crisis-card-header">
                <span class="crisis-card-icon">❤️</span>
                <span class="crisis-card-title">Real support is available right now</span>
            </div>
            <div class="crisis-card-contacts">
                <a href="tel:988" class="crisis-contact-btn crisis-contact-btn--primary">
                    <span class="crisis-contact-num">988</span>
                    <span class="crisis-contact-label">Suicide &amp; Crisis Lifeline · Call or Text · 24/7</span>
                </a>
                <a href="sms:741741?body=HELLO" class="crisis-contact-btn crisis-contact-btn--secondary">
                    <span class="crisis-contact-num">741741</span>
                    <span class="crisis-contact-label">Crisis Text Line · Text HELLO · Free &amp; Confidential</span>
                </a>
                <a href="tel:911" class="crisis-contact-btn crisis-contact-btn--urgent">
                    <span class="crisis-contact-num">911</span>
                    <span class="crisis-contact-label">Emergency Services · If you are in immediate danger</span>
                </a>
            </div>
            <p class="crisis-card-note">These are real people trained to help. You deserve that support.</p>
        `;
        this.chatMessages.appendChild(card);
    }

    addSupportNudge() {
        const nudge = document.createElement('div');
        nudge.className = 'support-nudge';
        nudge.innerHTML = `
            <span class="support-nudge-icon">💙</span>
            <span>If things feel heavier than usual, you can always reach a counsellor at
                <a href="tel:988" class="support-nudge-link">988</a> — free and confidential.
            </span>
        `;
        this.chatMessages.appendChild(nudge);
    }

    /** Builds the tool-suggestion strip shown inside a bot bubble. */
    _buildToolSuggestions(suggest) {
        const TOOLS = {
            breathing: {
                icon:  '🫁',
                label: 'Try Breathing Exercise',
                action: () => {
                    // Open the breathing modal — works whether we're in chat or dashboard
                    if (typeof window.chatInterface?.openBreathingExercise === 'function') {
                        window.chatInterface.openBreathingExercise();
                    } else {
                        document.getElementById('breathingExerciseBtn')?.click();
                    }
                },
            },
            music: {
                icon:  '🎵',
                label: 'Open Music Player',
                action: () => {
                    if (typeof window.toggleSoundCloudWidget === 'function') {
                        window.toggleSoundCloudWidget();
                    }
                },
            },
        };

        const strip = document.createElement('div');
        strip.className = 'harness-tool-suggest';

        const intro = document.createElement('span');
        intro.className = 'harness-tool-suggest-intro';
        intro.textContent = 'Helpful right now:';
        strip.appendChild(intro);

        suggest.forEach(key => {
            const tool = TOOLS[key];
            if (!tool) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'harness-tool-btn';
            btn.innerHTML = `<span class="harness-tool-icon">${tool.icon}</span>${tool.label}`;
            btn.addEventListener('click', tool.action);
            strip.appendChild(btn);
        });

        return strip;
    }

    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        
        const avatarIcon = document.createElement('div');
        avatarIcon.className = 'avatar-icon';
        avatarIcon.textContent = sender === 'user' ? '👤' : '🤖';
        
        avatarDiv.appendChild(avatarIcon);
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        
        const messageText = document.createElement('p');
        messageText.textContent = content;
        
        messageBubble.appendChild(messageText);
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.getCurrentTime();
        
        messageContent.appendChild(messageBubble);
        messageContent.appendChild(messageTime);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(messageContent);
        
        this.chatMessages.appendChild(messageDiv);
        if (sender === 'user') {
            this.scrollToBottom();
        }
        
        // Store message in history
        this.messageHistory.push({
            content: content,
            sender: sender,
            timestamp: new Date().toISOString()
        });
    }
    
    showTypingIndicator() {
        if (this.isTyping) return;
        
        this.isTyping = true;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator active';
        typingDiv.id = 'typingIndicator';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        
        const avatarIcon = document.createElement('div');
        avatarIcon.className = 'avatar-icon';
        avatarIcon.textContent = '🤖';
        
        avatarDiv.appendChild(avatarIcon);
        
        const typingDots = document.createElement('div');
        typingDots.className = 'typing-dots';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typingDots.appendChild(dot);
        }
        
        typingDiv.appendChild(avatarDiv);
        typingDiv.appendChild(typingDots);
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        this.isTyping = false;
    }
    
    hideQuickResponses() {
        const quickResponses = document.querySelectorAll('.quick-responses');
        quickResponses.forEach(response => {
            if (!response.querySelector('.quick-response-btn')) return;
            response.style.opacity = '0';
            setTimeout(() => {
                if (response.parentNode) {
                    response.remove();
                }
            }, 300);
        });
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
    
    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    
    loadWelcomeMessage() {}
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.chatInterface = new ChatInterface();
});

// Update the original startChatSession function to use the new chat interface
function startChatSession() {
    if (window.chatInterface) {
        window.chatInterface.openChat();
    } else {
        showNotification('Starting chat session...', 'info');
        setTimeout(() => {
            showNotification('Chat session ready! 💬', 'success');
        }, 1000);
    }
}
