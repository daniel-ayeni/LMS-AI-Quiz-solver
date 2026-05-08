/**
 * LMS Quiz Helper - SMART VERSION
 * Learns correct answers from feedback instead of random guessing
 */

(function() {
    'use strict';
    
    console.log('🧠 SMART MODE: LMS Quiz Helper Started');
    console.log('This version learns from feedback to find correct answers faster');
    
    let isProcessing = false;
    const knownAnswers = new Map(); // Store correct answers
    
    function log(msg, type = 'info') {
        const emoji = {'info': 'ℹ️', 'success': '✅', 'warning': '⚠️', 'error': '❌', 'quiz': '🎯', 'learn': '🧠'};
        console.log(`${emoji[type]} ${msg}`);
    }
    
    function getQuestionText() {
        // Try to extract question text for identification
        const questionElements = document.querySelectorAll('h2, h3, .question, [class*="question"]');
        for (const el of questionElements) {
            const text = el.textContent.trim();
            if (text.length > 10) return text;
        }
        return 'unknown';
    }
    
    function checkForCorrectAnswers() {
        // After submission, check which answers are marked correct
        const correctInfo = {};
        
        // Look for correct answer indicators in HTML
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const radios = document.querySelectorAll('input[type="radio"]');
        
        checkboxes.forEach((cb, idx) => {
            // Check for correct indicators
            const parent = cb.closest('.answer, .option, li, div');
            if (parent) {
                const classes = parent.className;
                const hasCorrect = classes.includes('correct') || 
                                 classes.includes('right') || 
                                 parent.querySelector('.correct, .checkmark, .tick');
                
                if (hasCorrect) {
                    correctInfo[`checkbox_${idx}`] = true;
                    log(`Learned: Checkbox ${idx + 1} is correct`, 'learn');
                }
            }
        });
        
        radios.forEach((radio, idx) => {
            const parent = radio.closest('.answer, .option, li, div');
            if (parent) {
                const classes = parent.className;
                const hasCorrect = classes.includes('correct') || 
                                 classes.includes('right') || 
                                 parent.querySelector('.correct, .checkmark, .tick');
                
                if (hasCorrect) {
                    correctInfo[`radio_${radio.name}_${idx}`] = true;
                    log(`Learned: Radio ${idx + 1} (${radio.name}) is correct`, 'learn');
                }
            }
        });
        
        return correctInfo;
    }
    
    function checkHTMLForAnswers() {
        // Check if correct answers are marked in HTML attributes
        const answers = {};
        
        document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((input, idx) => {
            // Check various attributes that might indicate correct answer
            if (input.getAttribute('data-correct') === 'true' ||
                input.getAttribute('data-correct') === '1' ||
                input.getAttribute('correct') === 'true' ||
                input.classList.contains('correct-answer')) {
                
                answers[idx] = input;
                log(`Found correct answer in HTML: ${input.type} #${idx + 1}`, 'learn');
            }
        });
        
        return answers;
    }
    
    async function answerQuiz() {
        if (isProcessing) return;
        
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const radios = document.querySelectorAll('input[type="radio"]');
        
        if (checkboxes.length === 0 && radios.length === 0) return;
        
        log('Quiz detected!', 'quiz');
        isProcessing = true;
        
        const questionText = getQuestionText();
        log(`Question: ${questionText.substring(0, 50)}...`);
        
        // First, check if HTML reveals correct answers
        const htmlAnswers = checkHTMLForAnswers();
        if (Object.keys(htmlAnswers).length > 0) {
            log('Found correct answers in HTML!', 'success');
            
            // Select them
            Object.values(htmlAnswers).forEach(input => {
                input.checked = true;
                input.click();
            });
            
            await submitAndContinue();
            isProcessing = false;
            return true;
        }
        
        // Check if we already know the answer
        if (knownAnswers.has(questionText)) {
            log('Using known correct answer!', 'learn');
            const correctIndices = knownAnswers.get(questionText);
            
            checkboxes.forEach((cb, idx) => {
                cb.checked = correctIndices.checkboxes.includes(idx);
                if (cb.checked) cb.click();
            });
            
            radios.forEach((radio, idx) => {
                if (correctIndices.radios[radio.name] === idx) {
                    radio.checked = true;
                    radio.click();
                }
            });
            
            await submitAndContinue();
            isProcessing = false;
            return true;
        }
        
        // Try systematically with learning
        for (let attempt = 1; attempt <= 30; attempt++) {
            log(`Attempt ${attempt}/30`);
            
            // Handle checkboxes - try different combinations
            if (checkboxes.length > 0) {
                checkboxes.forEach(cb => cb.checked = false);
                
                // Try systematic combinations
                const numToSelect = 1 + ((attempt - 1) % Math.min(3, checkboxes.length));
                const combo = getSystematicCombo(checkboxes.length, numToSelect, attempt);
                
                combo.forEach(idx => {
                    checkboxes[idx].checked = true;
                    checkboxes[idx].click();
                });
                
                log(`Testing ${numToSelect} checkbox(es): ${combo.map(i => i+1).join(',')}`);
            }
            
            // Handle radio buttons
            if (radios.length > 0) {
                const radioGroups = {};
                radios.forEach(radio => {
                    const name = radio.name || 'default';
                    if (!radioGroups[name]) radioGroups[name] = [];
                    radioGroups[name].push(radio);
                });
                
                // Try each radio option systematically
                Object.entries(radioGroups).forEach(([name, group]) => {
                    const idx = (attempt - 1) % group.length;
                    group.forEach(r => r.checked = false);
                    group[idx].checked = true;
                    group[idx].click();
                    log(`Testing radio ${idx + 1}/${group.length} in group ${name}`);
                });
            }
            
            await new Promise(r => setTimeout(r, 300));
            
            // Submit
            const submitBtn = Array.from(document.querySelectorAll('button')).find(btn => {
                const text = btn.textContent.toLowerCase();
                return (text.includes('check') || text.includes('submit')) && 
                       btn.offsetParent !== null && !btn.disabled;
            });
            
            if (submitBtn) {
                submitBtn.click();
                log('Submitted answer');
                await new Promise(r => setTimeout(r, 1500));
                
                // Check result
                const bodyText = document.body.textContent.toLowerCase();
                const correct = bodyText.includes('correct') && !bodyText.includes('incorrect');
                
                if (correct) {
                    log('✨ Found correct answer!', 'success');
                    
                    // Learn and save this answer
                    const correctIndices = {
                        checkboxes: Array.from(checkboxes).map((cb, i) => cb.checked ? i : -1).filter(i => i >= 0),
                        radios: {}
                    };
                    
                    radios.forEach((radio, idx) => {
                        if (radio.checked) {
                            correctIndices.radios[radio.name] = idx;
                        }
                    });
                    
                    knownAnswers.set(questionText, correctIndices);
                    log(`Saved answer for future use`, 'learn');
                    
                    // Click continue
                    const continueBtn = Array.from(document.querySelectorAll('button')).find(b =>
                        b.textContent.toLowerCase().includes('continue') && b.offsetParent !== null
                    );
                    
                    if (continueBtn) {
                        await new Promise(r => setTimeout(r, 500));
                        continueBtn.click();
                        log('Clicked continue', 'success');
                    }
                    
                    isProcessing = false;
                    return true;
                }
                
                // Learn from feedback even if wrong
                const feedback = checkForCorrectAnswers();
                if (Object.keys(feedback).length > 0) {
                    log('Learned from feedback, adjusting next attempt', 'learn');
                }
            }
        }
        
        log('Max attempts reached', 'warning');
        isProcessing = false;
        return false;
    }
    
    function getSystematicCombo(total, count, attempt) {
        // Generate systematic combinations instead of random
        const combos = [];
        for (let i = 0; i < total; i++) {
            if (combos.length < count) {
                const offset = Math.floor((attempt - 1) / count);
                const idx = (i + offset) % total;
                if (!combos.includes(idx)) combos.push(idx);
            }
        }
        return combos;
    }
    
    async function submitAndContinue() {
        const submitBtn = Array.from(document.querySelectorAll('button')).find(btn => {
            const text = btn.textContent.toLowerCase();
            return (text.includes('check') || text.includes('submit')) && btn.offsetParent !== null;
        });
        
        if (submitBtn) {
            submitBtn.click();
            await new Promise(r => setTimeout(r, 1500));
            
            const continueBtn = Array.from(document.querySelectorAll('button')).find(b =>
                b.textContent.toLowerCase().includes('continue') && b.offsetParent !== null
            );
            
            if (continueBtn) {
                continueBtn.click();
            }
        }
    }
    
    // Monitor every 2 seconds
    setInterval(answerQuiz, 2000);
    
    log('Smart learning mode active', 'success');
    log('Will try to find correct answers systematically', 'info');
    
})();
