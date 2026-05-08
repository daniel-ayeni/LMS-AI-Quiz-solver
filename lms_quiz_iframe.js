/**
 * LMS Quiz Helper - Iframe Version
 * Run this INSIDE the H5P iframe if quizzes aren't being detected
 * 
 * HOW TO USE IN IFRAME:
 * 1. Press F12 to open console
 * 2. In the console, find the dropdown at the top (usually says "top")
 * 3. Click it and select the iframe URL (contains "h5p_embed")
 * 4. Paste this script in that iframe's console
 * 5. Press Enter
 */

(function() {
    'use strict';
    
    console.log('🎯 LMS Quiz Helper (Iframe Mode) Started!');
    
    let isProcessing = false;
    
    function log(msg, type = 'info') {
        const emoji = {'info': 'ℹ️', 'success': '✅', 'warning': '⚠️', 'error': '❌', 'quiz': '🎯'};
        console.log(`${emoji[type]} ${msg}`);
    }
    
    async function answerQuiz() {
        if (isProcessing) return;
        
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const radios = document.querySelectorAll('input[type="radio"]');
        
        if (checkboxes.length === 0 && radios.length === 0) return;
        
        log('Quiz detected!', 'quiz');
        isProcessing = true;
        
        for (let attempt = 1; attempt <= 20; attempt++) {
            log(`Attempt ${attempt}`);
            
            // Handle checkboxes
            if (checkboxes.length > 0) {
                checkboxes.forEach(cb => cb.checked = false);
                const num = Math.floor(Math.random() * Math.min(3, checkboxes.length)) + 1;
                const indices = [];
                while (indices.length < num) {
                    const idx = Math.floor(Math.random() * checkboxes.length);
                    if (!indices.includes(idx)) indices.push(idx);
                }
                indices.forEach(i => {
                    checkboxes[i].checked = true;
                    checkboxes[i].dispatchEvent(new Event('change', {bubbles: true}));
                    checkboxes[i].dispatchEvent(new Event('click', {bubbles: true}));
                });
            }
            
            // Handle radios
            if (radios.length > 0) {
                // Group radios by name (each group is one question)
                const radioGroups = {};
                radios.forEach(radio => {
                    const name = radio.name || 'default';
                    if (!radioGroups[name]) radioGroups[name] = [];
                    radioGroups[name].push(radio);
                });
                
                log(`Found ${Object.keys(radioGroups).length} radio group(s)`);
                
                // Select one random radio from each group
                Object.entries(radioGroups).forEach(([groupName, groupRadios]) => {
                    const idx = Math.floor(Math.random() * groupRadios.length);
                    const selectedRadio = groupRadios[idx];
                    
                    // Uncheck all in group
                    groupRadios.forEach(r => r.checked = false);
                    
                    // Check selected
                    selectedRadio.checked = true;
                    selectedRadio.click();
                    
                    // Try clicking label too
                    const label = document.querySelector(`label[for="${selectedRadio.id}"]`);
                    if (label) label.click();
                    
                    // Dispatch events
                    ['change', 'click', 'input'].forEach(eventType => {
                        selectedRadio.dispatchEvent(new Event(eventType, {bubbles: true}));
                    });
                });
            }
            
            await new Promise(r => setTimeout(r, 500));
            
            // Find and click submit button
            const buttons = document.querySelectorAll('button');
            let submitBtn = null;
            for (const btn of buttons) {
                const text = btn.textContent.toLowerCase();
                if (text.includes('check') || text.includes('submit')) {
                    submitBtn = btn;
                    break;
                }
            }
            
            if (submitBtn) {
                submitBtn.click();
                log('Clicked submit');
                await new Promise(r => setTimeout(r, 1500));
                
                // Check for success
                const allText = document.body.textContent.toLowerCase();
                const continueBtn = Array.from(buttons).find(b => b.textContent.toLowerCase().includes('continue'));
                
                if (allText.includes('correct') || continueBtn) {
                    log('✨ Correct!', 'success');
                    if (continueBtn) {
                        await new Promise(r => setTimeout(r, 500));
                        continueBtn.click();
                        log('Clicked continue', 'success');
                    }
                    isProcessing = false;
                    return true;
                }
                
                log('Incorrect, retrying...');
            }
        }
        
        isProcessing = false;
        return false;
    }
    
    // Monitor every 2 seconds
    setInterval(answerQuiz, 2000);
    
    log('Monitoring for quizzes...', 'success');
    
})();
