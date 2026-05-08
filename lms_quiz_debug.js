/**
 * LMS Quiz Helper - DEBUG VERSION
 * This version shows detailed logs to help diagnose issues
 */

(function() {
    'use strict';
    
    console.log('🔍 DEBUG MODE: LMS Quiz Helper Started');
    console.log('═══════════════════════════════════════');
    
    let isProcessing = false;
    let checkCount = 0;
    
    function log(msg) {
        console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
    }
    
    async function debugQuiz() {
        if (isProcessing) return;
        
        checkCount++;
        
        // Show what we can see
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const radios = document.querySelectorAll('input[type="radio"]');
        const allInputs = document.querySelectorAll('input');
        const allButtons = document.querySelectorAll('button');
        
        console.log(`\n────── Check #${checkCount} ──────`);
        console.log(`Checkboxes found: ${checkboxes.length}`);
        console.log(`Radio buttons found: ${radios.length}`);
        console.log(`All inputs: ${allInputs.length}`);
        console.log(`All buttons: ${allButtons.length}`);
        
        // Show input details
        if (allInputs.length > 0) {
            console.log('\n📝 Input elements:');
            allInputs.forEach((inp, i) => {
                console.log(`  ${i+1}. Type: ${inp.type}, Name: ${inp.name}, ID: ${inp.id}, Visible: ${inp.offsetParent !== null}`);
            });
        }
        
        // Show button details
        if (allButtons.length > 0) {
            console.log('\n🔘 Button elements:');
            allButtons.forEach((btn, i) => {
                const text = btn.textContent.trim().substring(0, 30);
                console.log(`  ${i+1}. Text: "${text}", Visible: ${btn.offsetParent !== null}, Disabled: ${btn.disabled}`);
            });
        }
        
        // If we have quiz inputs, try to answer
        if (checkboxes.length > 0 || radios.length > 0) {
            console.log('\n🎯 QUIZ DETECTED! Attempting to answer...');
            isProcessing = true;
            
            for (let attempt = 1; attempt <= 5; attempt++) {
                console.log(`\n─── Attempt ${attempt} ───`);
                
                // Handle checkboxes
                if (checkboxes.length > 0) {
                    console.log('Handling checkboxes...');
                    checkboxes.forEach(cb => cb.checked = false);
                    
                    const numToSelect = Math.floor(Math.random() * Math.min(3, checkboxes.length)) + 1;
                    console.log(`Selecting ${numToSelect} random checkbox(es)`);
                    
                    const indices = [];
                    while (indices.length < numToSelect) {
                        const idx = Math.floor(Math.random() * checkboxes.length);
                        if (!indices.includes(idx)) indices.push(idx);
                    }
                    
                    indices.forEach(i => {
                        checkboxes[i].checked = true;
                        console.log(`  ✓ Checked checkbox ${i+1}`);
                        
                        // Try multiple events
                        ['change', 'click', 'input'].forEach(eventType => {
                            checkboxes[i].dispatchEvent(new Event(eventType, {bubbles: true}));
                        });
                    });
                }
                
                // Handle radios
                if (radios.length > 0) {
                    console.log('Handling radio buttons...');
                    
                    // Group radios by name
                    const radioGroups = {};
                    radios.forEach(radio => {
                        const name = radio.name || 'default';
                        if (!radioGroups[name]) radioGroups[name] = [];
                        radioGroups[name].push(radio);
                    });
                    
                    console.log(`Found ${Object.keys(radioGroups).length} radio group(s)`);
                    
                    // Select one random radio from each group
                    Object.entries(radioGroups).forEach(([groupName, groupRadios]) => {
                        const idx = Math.floor(Math.random() * groupRadios.length);
                        const selectedRadio = groupRadios[idx];
                        
                        // Uncheck all in group first
                        groupRadios.forEach(r => r.checked = false);
                        
                        // Check the selected one
                        selectedRadio.checked = true;
                        console.log(`  ✓ Selected radio ${idx+1}/${groupRadios.length} in group "${groupName}"`);
                        
                        // Try clicking the radio itself
                        selectedRadio.click();
                        
                        // Try clicking the label if it exists
                        const label = document.querySelector(`label[for="${selectedRadio.id}"]`);
                        if (label) {
                            label.click();
                            console.log(`    Also clicked associated label`);
                        }
                        
                        // Dispatch events
                        ['change', 'click', 'input'].forEach(eventType => {
                            selectedRadio.dispatchEvent(new Event(eventType, {bubbles: true}));
                        });
                    });
                }
                
                await new Promise(r => setTimeout(r, 500));
                
                // Find submit button
                console.log('Looking for submit button...');
                let submitBtn = null;
                
                for (const btn of allButtons) {
                    const text = btn.textContent.toLowerCase();
                    console.log(`  Checking button: "${btn.textContent.trim().substring(0, 20)}" - contains check/submit: ${text.includes('check') || text.includes('submit')}`);
                    
                    if ((text.includes('check') || text.includes('submit')) && btn.offsetParent !== null && !btn.disabled) {
                        submitBtn = btn;
                        console.log(`  ✓ Found submit button: "${btn.textContent.trim()}"`);
                        break;
                    }
                }
                
                if (submitBtn) {
                    console.log('Clicking submit button...');
                    submitBtn.click();
                    console.log('  ✓ Clicked!');
                    
                    await new Promise(r => setTimeout(r, 2000));
                    
                    // Check for success
                    const bodyText = document.body.textContent.toLowerCase();
                    const hasCorrect = bodyText.includes('correct');
                    const hasContinue = Array.from(allButtons).some(b => b.textContent.toLowerCase().includes('continue'));
                    
                    console.log(`Checking result... Correct: ${hasCorrect}, Continue button: ${hasContinue}`);
                    
                    if (hasCorrect || hasContinue) {
                        console.log('✅ SUCCESS! Quiz answered correctly!');
                        
                        const continueBtn = Array.from(allButtons).find(b => 
                            b.textContent.toLowerCase().includes('continue') && 
                            b.offsetParent !== null
                        );
                        
                        if (continueBtn) {
                            await new Promise(r => setTimeout(r, 500));
                            continueBtn.click();
                            console.log('✅ Clicked Continue button');
                        }
                        
                        isProcessing = false;
                        return true;
                    } else {
                        console.log('❌ Incorrect answer, will retry...');
                    }
                } else {
                    console.log('❌ No submit button found!');
                }
            }
            
            console.log('⚠️ Max attempts reached');
            isProcessing = false;
        }
    }
    
    // Run every 3 seconds
    setInterval(debugQuiz, 3000);
    
    log('Debug monitor started - watch console for detailed logs');
    log('════════════════════════════════════════════════════════');
    
})();
