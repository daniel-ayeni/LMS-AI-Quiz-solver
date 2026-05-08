/**
 * YourHippo LMS AI Quiz Solver
 * 
 * HOW TO USE:
 * 1. Open your course in Chrome/Edge/Firefox
 * 2. Open browser console (F12 -> Console tab)
 * 3. Copy and paste this entire script
 * 4. Press Enter
 * 5. Watch the video - AI will automatically answer quizzes!
 * 
 * IMPORTANT: This script uses AI to answer quiz questions intelligently.
 * The AI analyzes the question and options to find the correct answer.
 */

(function() {
    'use strict';
    
    // =========================
    // CONFIGURATION
    // =========================
    const API_URL = 'https://video-tutor-4.preview.emergentagent.com/api';
    const CHECK_INTERVAL = 2000;  // Check for quiz every 2 seconds
    const MAX_RETRIES = 3;        // Max retries for API calls
    
    // =========================
    // UI OVERLAY
    // =========================
    function createStatusOverlay() {
        // Remove existing overlay
        const existing = document.getElementById('lms-ai-status');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'lms-ai-status';
        overlay.innerHTML = `
            <style>
                #lms-ai-status {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 999999;
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border: 1px solid #334155;
                    border-radius: 12px;
                    padding: 12px 16px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 13px;
                    color: #e2e8f0;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                    min-width: 200px;
                    max-width: 300px;
                }
                #lms-ai-status .header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #60a5fa;
                }
                #lms-ai-status .status-text {
                    font-size: 12px;
                    color: #94a3b8;
                    margin-bottom: 4px;
                }
                #lms-ai-status .action-text {
                    font-size: 12px;
                    color: #34d399;
                    font-weight: 500;
                }
                #lms-ai-status .error-text {
                    font-size: 12px;
                    color: #f87171;
                    font-weight: 500;
                }
                #lms-ai-status .spinner {
                    display: inline-block;
                    width: 14px;
                    height: 14px;
                    border: 2px solid #60a5fa;
                    border-top-color: transparent;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                #lms-ai-status .close-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: #64748b;
                    cursor: pointer;
                    font-size: 16px;
                    line-height: 1;
                }
                #lms-ai-status .close-btn:hover {
                    color: #f87171;
                }
            </style>
            <button class="close-btn" onclick="window.stopLMSAI()">&times;</button>
            <div class="header">
                <span>🤖</span>
                <span>LMS AI Quiz Solver</span>
            </div>
            <div class="status-text" id="lms-status-text">Monitoring for quizzes...</div>
            <div id="lms-action-text"></div>
        `;
        document.body.appendChild(overlay);
    }
    
    function updateStatus(text, isAction = false, isError = false) {
        const statusEl = document.getElementById('lms-status-text');
        const actionEl = document.getElementById('lms-action-text');
        
        if (statusEl) {
            statusEl.textContent = text;
        }
        
        if (actionEl) {
            if (isError) {
                actionEl.className = 'error-text';
                actionEl.textContent = text;
            } else if (isAction) {
                actionEl.className = 'action-text';
                actionEl.textContent = text;
            } else {
                actionEl.textContent = '';
            }
        }
        
        console.log(`[LMS AI] ${text}`);
    }
    
    // =========================
    // QUIZ DETECTION
    // =========================
    let isProcessing = false;
    let lastQuizHash = '';
    
    function getQuizHash(question, options) {
        return `${question}|${options.join('|')}`;
    }
    
    function findQuizElements(doc = document) {
        // Look for radio buttons first (most common)
        const radios = doc.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
            return { type: 'radio', inputs: Array.from(radios), doc };
        }
        
        // Then checkboxes
        const checkboxes = doc.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            return { type: 'checkbox', inputs: Array.from(checkboxes), doc };
        }
        
        return null;
    }
    
    function detectQuiz() {
        // Check main document first
        let quiz = findQuizElements(document);
        if (quiz) return quiz;
        
        // Check accessible iframes
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                if (iframe.contentDocument) {
                    quiz = findQuizElements(iframe.contentDocument);
                    if (quiz) return quiz;
                }
            } catch (e) {
                // Cross-origin iframe, skip
            }
        }
        
        return null;
    }
    
    function extractQuestionText(doc) {
        // Common selectors for question text
        const selectors = [
            '.h5p-question-content',
            '.question-text',
            '.quiz-question',
            '[class*="question"]',
            'h2',
            'h3',
            'p'
        ];
        
        for (const selector of selectors) {
            const elements = doc.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent.trim();
                // Filter out very short texts or navigation elements
                if (text.length > 20 && text.length < 1000 && !text.includes('Next') && !text.includes('Previous')) {
                    // Check if this looks like a question (has question mark or is substantive)
                    if (text.includes('?') || text.split(' ').length > 5) {
                        return text;
                    }
                }
            }
        }
        
        // Fallback: look for the longest paragraph-like text
        const allText = doc.body.textContent;
        const sentences = allText.split(/[.!?]/).filter(s => s.trim().length > 30);
        if (sentences.length > 0) {
            const question = sentences.find(s => s.includes('?')) || sentences[0];
            return question.trim().substring(0, 500);
        }
        
        return 'Question text not found';
    }
    
    function extractOptions(quiz) {
        const options = [];
        const { type, inputs, doc } = quiz;
        
        // Group inputs by name for radio buttons
        const groups = {};
        inputs.forEach(input => {
            const name = input.name || 'default';
            if (!groups[name]) groups[name] = [];
            groups[name].push(input);
        });
        
        // Process each group (usually just one for single-answer questions)
        const mainGroup = Object.values(groups)[0] || [];
        
        mainGroup.forEach((input, index) => {
            let optionText = '';
            
            // Method 1: Check for associated label
            const labelFor = doc.querySelector(`label[for="${input.id}"]`);
            if (labelFor) {
                optionText = labelFor.textContent.trim();
            }
            
            // Method 2: Check parent label
            if (!optionText) {
                const parentLabel = input.closest('label');
                if (parentLabel) {
                    optionText = parentLabel.textContent.trim();
                }
            }
            
            // Method 3: Check sibling/nearby text
            if (!optionText) {
                const parent = input.parentElement;
                if (parent) {
                    const clone = parent.cloneNode(true);
                    const inputEl = clone.querySelector('input');
                    if (inputEl) inputEl.remove();
                    optionText = clone.textContent.trim();
                }
            }
            
            // Method 4: Check H5P answer structure
            if (!optionText) {
                const answerContainer = input.closest('.h5p-alternative-container, .answer-option, [class*="answer"], [class*="option"]');
                if (answerContainer) {
                    const textEl = answerContainer.querySelector('.h5p-alternative-text, .option-text, span, p');
                    if (textEl) {
                        optionText = textEl.textContent.trim();
                    } else {
                        optionText = answerContainer.textContent.trim();
                    }
                }
            }
            
            if (optionText) {
                options.push({
                    text: optionText,
                    index: index,
                    input: input
                });
            }
        });
        
        return options;
    }
    
    // =========================
    // AI QUIZ SOLVING
    // =========================
    async function callAIEndpoint(question, options) {
        const payload = {
            question: question,
            options: options.map((opt, idx) => ({
                text: opt.text,
                index: idx
            }))
        };
        
        updateStatus('Asking AI for answer...');
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(`${API_URL}/solve-quiz`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    return result;
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
                
            } catch (error) {
                console.error(`[LMS AI] Attempt ${attempt} failed:`, error);
                if (attempt === MAX_RETRIES) {
                    throw error;
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
    
    async function selectAnswer(quiz, answerIndex) {
        const options = extractOptions(quiz);
        
        if (answerIndex >= 0 && answerIndex < options.length) {
            const targetOption = options[answerIndex];
            const input = targetOption.input;
            
            // Clear other selections first
            options.forEach(opt => {
                opt.input.checked = false;
            });
            
            // Select the correct answer
            input.checked = true;
            input.click();
            
            // Dispatch events
            ['change', 'click', 'input'].forEach(eventType => {
                input.dispatchEvent(new Event(eventType, { bubbles: true }));
            });
            
            // Also click the label if exists
            const label = quiz.doc.querySelector(`label[for="${input.id}"]`);
            if (label) {
                label.click();
            }
            
            updateStatus(`Selected: ${targetOption.text.substring(0, 50)}...`, true);
            
            return true;
        }
        
        return false;
    }
    
    async function clickSubmitButton(doc) {
        // Find and click submit/check button
        const buttons = doc.querySelectorAll('button');
        
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            if ((text.includes('check') || text.includes('submit')) && !btn.disabled) {
                btn.click();
                updateStatus('Clicked submit button', true);
                return true;
            }
        }
        
        return false;
    }
    
    async function clickContinueButton(doc) {
        await new Promise(r => setTimeout(r, 1500));
        
        const buttons = doc.querySelectorAll('button');
        
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            if (text.includes('continue') && !btn.disabled) {
                btn.click();
                updateStatus('Quiz completed! Continuing...', true);
                return true;
            }
        }
        
        return false;
    }
    
    // =========================
    // MAIN QUIZ PROCESSOR
    // =========================
    async function processQuiz() {
        if (isProcessing) return;
        
        const quiz = detectQuiz();
        
        if (!quiz) {
            // Check for Next button to proceed
            checkNextButton();
            return;
        }
        
        const question = extractQuestionText(quiz.doc);
        const options = extractOptions(quiz);
        
        if (options.length === 0) {
            console.log('[LMS AI] No options found');
            return;
        }
        
        // Check if we've already processed this quiz
        const quizHash = getQuizHash(question, options.map(o => o.text));
        if (quizHash === lastQuizHash) {
            return;
        }
        
        isProcessing = true;
        lastQuizHash = quizHash;
        
        try {
            updateStatus('Quiz detected! Analyzing...');
            
            console.log('[LMS AI] Question:', question);
            console.log('[LMS AI] Options:', options.map(o => o.text));
            
            // Call AI to get answer
            const aiResult = await callAIEndpoint(question, options);
            
            if (aiResult.success) {
                console.log('[LMS AI] AI Answer:', aiResult);
                updateStatus(`AI chose: ${aiResult.correct_answer_text?.substring(0, 40)}...`, true);
                
                // Select the AI's answer
                await selectAnswer(quiz, aiResult.correct_answer_index);
                
                await new Promise(r => setTimeout(r, 500));
                
                // Click submit
                await clickSubmitButton(quiz.doc);
                
                // Wait and click continue
                await clickContinueButton(quiz.doc);
                
                // Reset hash after successful completion
                lastQuizHash = '';
                
            } else {
                updateStatus('AI error: ' + aiResult.error, false, true);
            }
            
        } catch (error) {
            console.error('[LMS AI] Error:', error);
            updateStatus('Error: ' + error.message, false, true);
        } finally {
            isProcessing = false;
        }
    }
    
    function checkNextButton() {
        const buttons = document.querySelectorAll('button');
        
        for (const btn of buttons) {
            const text = btn.textContent.trim().toLowerCase();
            if (text.includes('next') && !btn.disabled && btn.offsetParent !== null) {
                // Only click if it's actually visible and enabled
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    btn.click();
                    updateStatus('Clicked Next button', true);
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // =========================
    // START MONITORING
    // =========================
    console.log('========================================');
    console.log('🤖 LMS AI Quiz Solver Started!');
    console.log('========================================');
    console.log('API Endpoint:', API_URL);
    console.log('');
    console.log('The AI will automatically:');
    console.log('1. Detect quiz questions');
    console.log('2. Analyze question and options');
    console.log('3. Select the correct answer');
    console.log('4. Submit and continue');
    console.log('');
    console.log('To stop: Run stopLMSAI() in console');
    console.log('========================================');
    
    createStatusOverlay();
    
    const monitorInterval = setInterval(processQuiz, CHECK_INTERVAL);
    
    // Global stop function
    window.stopLMSAI = function() {
        clearInterval(monitorInterval);
        const overlay = document.getElementById('lms-ai-status');
        if (overlay) overlay.remove();
        console.log('[LMS AI] Stopped!');
    };
    
})();
