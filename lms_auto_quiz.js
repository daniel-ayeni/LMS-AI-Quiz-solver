/**
 * YourHippo LMS Auto-Quiz Helper
 * 
 * HOW TO USE:
 * 1. Open your course in Chrome/Firefox
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter
 * 5. Let the video play - script will auto-answer quizzes!
 */

(function() {
    'use strict';
    
    console.log('🚀 LMS Auto-Quiz Helper Started!');
    console.log('📹 Let the video play naturally - I\'ll handle the quizzes');
    console.log('⚠️ You may see some H5P iframe errors - they\'re harmless and expected');
    
    // Suppress H5P resize errors (harmless)
    const originalError = console.error;
    console.error = function(...args) {
        const message = args.join(' ');
        if (message.includes('postMessage') || message.includes('h5p-resizer')) {
            // Suppress H5P iframe communication errors - they don't affect functionality
            return;
        }
        originalError.apply(console, args);
    };
    
    let isProcessingQuiz = false;
    let lastQuizTime = 0;
    
    // Configuration
    const config = {
        checkInterval: 2000,  // Check for quiz every 2 seconds
        maxAttempts: 20,      // Max attempts per quiz
        attemptDelay: 1500    // Wait between attempts
    };
    
    // Helper function to log with timestamp
    function log(message, type = 'info') {
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'quiz': '🎯'
        };
        console.log(`${emoji[type]} [${new Date().toLocaleTimeString()}] ${message}`);
    }
    
    // Check if quiz is present
    function hasQuiz() {
        // Look in main window first
        try {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            const radios = document.querySelectorAll('input[type="radio"]');
            
            if (checkboxes.length > 0 || radios.length > 0) {
                return { frame: window, doc: document, checkboxes, radios };
            }
        } catch (e) {
            log(`Main window check error: ${e.message}`, 'warning');
        }
        
        // Then check iframes
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                // Skip if iframe isn't loaded yet
                if (!iframe.contentWindow || !iframe.contentDocument) continue;
                
                const doc = iframe.contentDocument;
                const checkboxes = doc.querySelectorAll('input[type="checkbox"]');
                const radios = doc.querySelectorAll('input[type="radio"]');
                
                if (checkboxes.length > 0 || radios.length > 0) {
                    return { frame: iframe.contentWindow, doc: doc, checkboxes, radios };
                }
            } catch (e) {
                // Cross-origin iframe, can't access - skip silently
                continue;
            }
        }
        
        return null;
    }
    
    // Answer quiz with random selection
    async function answerQuiz(quizData) {
        if (!quizData) return false;
        
        const { frame, doc, checkboxes, radios } = quizData;
        
        log('Quiz detected! Attempting to answer...', 'quiz');
        
        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            log(`Attempt ${attempt}/${config.maxAttempts}`, 'info');
            
            // Random selection for checkboxes
            if (checkboxes.length > 0) {
                // Uncheck all first
                checkboxes.forEach(cb => cb.checked = false);
                
                // Randomly select 1-3 checkboxes
                const numToSelect = Math.floor(Math.random() * Math.min(3, checkboxes.length)) + 1;
                const indices = [];
                while (indices.length < numToSelect) {
                    const idx = Math.floor(Math.random() * checkboxes.length);
                    if (!indices.includes(idx)) indices.push(idx);
                }
                
                indices.forEach(i => {
                    checkboxes[i].checked = true;
                    checkboxes[i].dispatchEvent(new Event('change', { bubbles: true }));
                });
                
                log(`Selected ${numToSelect} checkbox(es)`, 'info');
            }
            
            // Random selection for radio buttons
            if (radios.length > 0) {
                const randomIdx = Math.floor(Math.random() * radios.length);
                radios[randomIdx].checked = true;
                radios[randomIdx].dispatchEvent(new Event('change', { bubbles: true }));
                log(`Selected radio button ${randomIdx + 1}`, 'info');
            }
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Click submit/check button
            const submitSelectors = [
                'button:has-text("CHECK")',
                'button:has-text("Check")',
                'button:has-text("Submit")',
                'button:has-text("SUBMIT")',
                '[class*="check"][class*="button"]',
                '[class*="submit"][class*="button"]'
            ];
            
            let submitBtn = null;
            for (const selector of submitSelectors) {
                submitBtn = doc.querySelector(selector);
                if (!submitBtn) {
                    // Try with contains text
                    const buttons = doc.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent.toLowerCase().includes('check') || 
                            btn.textContent.toLowerCase().includes('submit')) {
                            submitBtn = btn;
                            break;
                        }
                    }
                }
                if (submitBtn) break;
            }
            
            if (submitBtn) {
                submitBtn.click();
                log('Clicked submit button', 'info');
                
                // Wait for response
                await new Promise(resolve => setTimeout(resolve, config.attemptDelay));
                
                // Check for success indicators
                const successSelectors = [
                    '*:has-text("Correct")',
                    '*:has-text("correct")',
                    '[class*="correct"]',
                    '[class*="success"]',
                    'button:has-text("CONTINUE")',
                    'button:has-text("Continue")'
                ];
                
                let isCorrect = false;
                for (const selector of successSelectors) {
                    const el = doc.querySelector(selector);
                    if (el) {
                        const text = el.textContent.toLowerCase();
                        if (text.includes('correct') || text.includes('continue')) {
                            isCorrect = true;
                            break;
                        }
                    }
                }
                
                if (isCorrect) {
                    log('✨ Quiz answered correctly!', 'success');
                    
                    // Click Continue button
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const continueBtn = doc.querySelector('button:contains("Continue"), button:contains("CONTINUE")') || 
                                      Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Continue'));
                    
                    if (continueBtn) {
                        continueBtn.click();
                        log('Clicked Continue button', 'success');
                    }
                    
                    return true;
                } else {
                    log('Incorrect answer, trying again...', 'warning');
                }
            } else {
                log('Submit button not found', 'error');
                return false;
            }
        }
        
        log('Max attempts reached', 'error');
        return false;
    }
    
    // Check for Next button and click it
    function checkNextButton() {
        const nextSelectors = [
            'button:has-text("Next")',
            'button:has-text("NEXT")',
            'button:contains("Next")'
        ];
        
        for (const selector of nextSelectors) {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent.includes('Next') && !btn.disabled && !btn.classList.contains('disabled')) {
                    log('Next button is available, clicking...', 'success');
                    btn.click();
                    return true;
                }
            }
        }
        return false;
    }
    
    // Main monitoring loop
    async function monitorForQuiz() {
        // Prevent multiple simultaneous quiz processing
        if (isProcessingQuiz) return;
        
        const quizData = hasQuiz();
        
        if (quizData) {
            const now = Date.now();
            // Debounce - don't process same quiz multiple times
            if (now - lastQuizTime < 5000) return;
            
            log('Quiz elements found!', 'quiz');
            isProcessingQuiz = true;
            lastQuizTime = now;
            
            try {
                await answerQuiz(quizData);
            } catch (error) {
                log(`Error processing quiz: ${error.message}`, 'error');
            } finally {
                isProcessingQuiz = false;
            }
        } else {
            // No quiz found - check if it's in a cross-origin iframe
            const h5pIframe = document.querySelector('iframe[src*="h5p"]');
            if (h5pIframe && !quizData) {
                // Can't access cross-origin iframe
                log('⚠️ Quiz might be in H5P iframe (cross-origin blocked)', 'warning');
                log('💡 Open browser console, switch to iframe context (top dropdown), and paste this script there', 'info');
            }
            
            // Check if Next button is available
            checkNextButton();
        }
    }
    
    // Start monitoring
    log('Starting quiz monitor...', 'success');
    log('Keep this tab open and let the video play!', 'info');
    
    const monitorInterval = setInterval(monitorForQuiz, config.checkInterval);
    
    // Cleanup function
    window.stopLMSHelper = function() {
        clearInterval(monitorInterval);
        log('LMS Auto-Quiz Helper stopped', 'warning');
    };
    
    log('📌 To stop: type stopLMSHelper() in console', 'info');
    
    // Also log video time if available
    setInterval(() => {
        try {
            // Check main window first
            const mainVideo = document.querySelector('video');
            if (mainVideo && mainVideo.currentTime > 0) {
                const minutes = Math.floor(mainVideo.currentTime / 60);
                const seconds = Math.floor(mainVideo.currentTime % 60);
                console.log(`📹 Video: ${minutes}:${seconds.toString().padStart(2, '0')}`);
                return;
            }
            
            // Check iframes
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    if (!iframe.contentDocument) continue;
                    const video = iframe.contentDocument.querySelector('video');
                    if (video && video.currentTime > 0) {
                        const minutes = Math.floor(video.currentTime / 60);
                        const seconds = Math.floor(video.currentTime % 60);
                        console.log(`📹 Video: ${minutes}:${seconds.toString().padStart(2, '0')}`);
                        break;
                    }
                } catch (e) {
                    // Cross-origin, skip
                }
            }
        } catch (e) {
            // Silently skip errors
        }
    }, 10000);
    
})();
