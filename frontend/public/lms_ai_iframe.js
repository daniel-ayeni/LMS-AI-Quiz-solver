/**
 * LMS AI Quiz Solver - Iframe Version
 * Run this INSIDE the H5P iframe
 * 
 * HOW TO USE IN IFRAME:
 * 1. Press F12 to open console
 * 2. In the console, find the dropdown at the top (usually says "top")
 * 3. Click it and select the iframe URL (contains "h5p_embed" or "content.yourhippo.com")
 * 4. Paste this script in that iframe's console
 * 5. Press Enter
 * 
 * The AI will analyze each quiz question and select the correct answer!
 */

(function() {
    'use strict';
    
    // API endpoint for AI quiz solving
    const API_URL = 'https://video-tutor-4.preview.emergentagent.com/api';
    
    console.log('🤖 LMS AI Quiz Solver (Iframe Mode) Started!');
    console.log('📡 API:', API_URL);
    
    let isProcessing = false;
    let lastQuizHash = '';
    
    function log(msg, type = 'info') {
        const emoji = {'info': 'ℹ️', 'success': '✅', 'warning': '⚠️', 'error': '❌', 'ai': '🤖'};
        console.log(`${emoji[type] || 'ℹ️'} ${msg}`);
    }
    
    // Create hash to avoid processing same quiz twice
    function getQuizHash(question, options) {
        return `${question}|${options.join('|')}`;
    }
    
    // Extract question text from the page
    function extractQuestion() {
        const selectors = [
            '.h5p-question-content',
            '.h5p-multichoice-question', 
            '.h5p-question',
            '[class*="question"]',
            'h2', 'h3'
        ];
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent.trim();
                // Must be long enough and look like a question
                if (text.length > 15 && text.length < 1000) {
                    if (text.includes('?') || text.split(' ').length > 4) {
                        return text;
                    }
                }
            }
        }
        
        // Fallback: get text near the inputs
        const container = document.querySelector('.h5p-question-content, .h5p-multichoice, [class*="quiz"]');
        if (container) {
            return container.textContent.substring(0, 500).trim();
        }
        
        return 'Question text not found';
    }
    
    // Extract answer options
    function extractOptions() {
        const options = [];
        const radios = document.querySelectorAll('input[type="radio"]');
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const inputs = radios.length > 0 ? Array.from(radios) : Array.from(checkboxes);
        
        inputs.forEach((input, index) => {
            let optionText = '';
            
            // Method 1: Label with for attribute
            if (input.id) {
                const label = document.querySelector(`label[for="${input.id}"]`);
                if (label) {
                    optionText = label.textContent.trim();
                }
            }
            
            // Method 2: H5P alternative container
            if (!optionText) {
                const container = input.closest('.h5p-alternative-container');
                if (container) {
                    const inner = container.querySelector('.h5p-alternative-inner');
                    if (inner) {
                        optionText = inner.textContent.trim();
                    }
                }
            }
            
            // Method 3: Parent element text
            if (!optionText) {
                const parent = input.closest('label, .answer, .option, [class*="alternative"]');
                if (parent) {
                    optionText = parent.textContent.trim();
                }
            }
            
            // Method 4: Sibling text
            if (!optionText && input.parentElement) {
                const clone = input.parentElement.cloneNode(true);
                const inputClone = clone.querySelector('input');
                if (inputClone) inputClone.remove();
                optionText = clone.textContent.trim();
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
    
    // Call AI API to get the correct answer
    async function callAI(question, options) {
        const payload = {
            question: question,
            options: options.map((opt, idx) => ({
                text: opt.text,
                index: idx
            }))
        };
        
        log('Sending to AI...', 'ai');
        log(`Question: ${question.substring(0, 80)}...`);
        log(`Options: ${options.map(o => o.text.substring(0, 30)).join(' | ')}`);
        
        try {
            const response = await fetch(`${API_URL}/solve-quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            log(`API Error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // Select the answer chosen by AI
    function selectAnswer(options, answerIndex) {
        if (answerIndex < 0 || answerIndex >= options.length) {
            log(`Invalid answer index: ${answerIndex}`, 'error');
            return false;
        }
        
        const target = options[answerIndex];
        
        // Clear all selections first
        options.forEach(opt => {
            opt.input.checked = false;
        });
        
        // Select the AI's answer
        target.input.checked = true;
        target.input.click();
        
        // Dispatch events to trigger H5P's handlers
        ['change', 'click', 'input'].forEach(eventType => {
            target.input.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        // Also try clicking the label
        if (target.input.id) {
            const label = document.querySelector(`label[for="${target.input.id}"]`);
            if (label) label.click();
        }
        
        log(`Selected: "${target.text.substring(0, 50)}..."`, 'success');
        return true;
    }
    
    // Find and click a button by text content
    function clickButton(textMatch) {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            if (text.includes(textMatch.toLowerCase()) && !btn.disabled && btn.offsetParent !== null) {
                btn.click();
                log(`Clicked "${btn.textContent.trim()}" button`, 'success');
                return true;
            }
        }
        return false;
    }
    
    // Main quiz processing function
    async function processQuiz() {
        if (isProcessing) return;
        
        // Check for quiz inputs
        const radios = document.querySelectorAll('input[type="radio"]');
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        
        if (radios.length === 0 && checkboxes.length === 0) {
            return; // No quiz on page
        }
        
        // Extract question and options
        const question = extractQuestion();
        const options = extractOptions();
        
        if (options.length === 0) {
            log('Found inputs but could not extract option text', 'warning');
            return;
        }
        
        // Check if we already processed this exact quiz
        const quizHash = getQuizHash(question, options.map(o => o.text));
        if (quizHash === lastQuizHash) {
            return; // Already processed
        }
        
        // Start processing
        isProcessing = true;
        lastQuizHash = quizHash;
        
        log('═══════════════════════════════════', 'ai');
        log('Quiz Detected!', 'ai');
        
        try {
            // Call AI to get the answer
            const result = await callAI(question, options);
            
            if (result.success) {
                log(`AI Answer: "${result.correct_answer_text}"`, 'ai');
                if (result.explanation) {
                    log(`Reason: ${result.explanation}`, 'info');
                }
                
                // Select the AI's answer
                const selected = selectAnswer(options, result.correct_answer_index);
                
                if (selected) {
                    // Wait a moment then click submit
                    await new Promise(r => setTimeout(r, 600));
                    
                    if (clickButton('check') || clickButton('submit')) {
                        // Wait for result and click continue
                        await new Promise(r => setTimeout(r, 1500));
                        
                        if (clickButton('continue') || clickButton('next')) {
                            log('Moving to next section...', 'success');
                            lastQuizHash = ''; // Reset to allow next quiz
                        }
                    }
                }
                
                log('═══════════════════════════════════', 'ai');
                
            } else {
                log(`AI returned error: ${result.error}`, 'error');
            }
            
        } catch (error) {
            log(`Error: ${error.message}`, 'error');
            lastQuizHash = ''; // Reset on error to allow retry
        } finally {
            isProcessing = false;
        }
    }
    
    // Start monitoring
    log('Monitoring for quizzes every 2 seconds...', 'success');
    log('To stop: type stopQuizAI() in console', 'info');
    log('═══════════════════════════════════', 'ai');
    
    const monitorInterval = setInterval(processQuiz, 2000);
    
    // Global stop function
    window.stopQuizAI = function() {
        clearInterval(monitorInterval);
        log('AI Quiz Solver stopped!', 'warning');
    };
    
    // Run once immediately
    setTimeout(processQuiz, 500);
    
})();
