/**
 * LMS AI Quiz Solver v1.0
 * 
 * Automatically answers training course quizzes using AI.
 * 
 * SETUP:
 * 1. Deploy the backend (see README.md)
 * 2. Change API_URL below to your backend URL
 * 3. Paste this script in browser console (F12) on your LMS course page
 * 
 * COMMANDS:
 * - stopQuizAI() : Stop the script
 * 
 * GitHub: https://github.com/YOUR_USERNAME/lms-quiz-solver
 */

(function() {
    // ============================================
    // ⚠️ CHANGE THIS TO YOUR BACKEND URL ⚠️
    // ============================================
    const API_URL = 'https://YOUR-APP-NAME.up.railway.app/api';
    // ============================================

    let isProcessing = false;
    let lastQuizHash = '';
    let intervalId = null;
    let isReady = false;

    function log(msg, type = 'info') {
        const emoji = { 
            'info': 'ℹ️', 
            'success': '✅', 
            'warning': '⚠️', 
            'error': '❌', 
            'ai': '🤖' 
        };
        console.log(`${emoji[type] || 'ℹ️'} ${msg}`);
    }

    async function wakeUpServer() {
        log('Connecting to AI server...', 'info');
        for (let i = 1; i <= 3; i++) {
            try {
                const resp = await fetch(`${API_URL}/`, { method: 'GET' });
                if (resp.ok) {
                    log('Server connected!', 'success');
                    isReady = true;
                    return true;
                }
            } catch (e) {}
            log(`Retry ${i}/3...`, 'warning');
            await new Promise(r => setTimeout(r, 2000));
        }
        log('Connection failed. Check your API_URL.', 'error');
        return false;
    }

    function extractNumAnswers(text) {
        const m = text.toLowerCase().match(/choose\s*(\d+)/);
        if (m) {
            log(`Found: choose ${m[1]}`, 'info');
            return parseInt(m[1]);
        }
        return 1;
    }

    function extractQuestion() {
        const selectors = [
            '.h5p-question-content', 
            '.h5p-multichoice-question', 
            '[class*="question"]', 
            'h2', 
            'h3'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim().length > 10) {
                return el.textContent.trim();
            }
        }
        return document.body.textContent.substring(0, 600);
    }

    function extractOptions() {
        const opts = [];
        const inputs = Array.from(
            document.querySelectorAll('input[type="checkbox"],input[type="radio"]')
        );
        
        inputs.forEach((inp, idx) => {
            let txt = '';
            
            // Method 1: H5P container
            const cont = inp.closest('.h5p-alternative-container');
            if (cont) {
                const inner = cont.querySelector('.h5p-alternative-inner');
                if (inner) txt = inner.textContent.trim();
            }
            
            // Method 2: Label
            if (!txt && inp.id) {
                const lbl = document.querySelector(`label[for="${inp.id}"]`);
                if (lbl) txt = lbl.textContent.trim();
            }
            
            // Method 3: Parent text
            if (!txt && inp.parentElement) {
                const c = inp.parentElement.cloneNode(true);
                const i = c.querySelector('input');
                if (i) i.remove();
                txt = c.textContent.trim();
            }
            
            if (txt) opts.push({ text: txt, index: idx, input: inp });
        });
        
        return opts;
    }

    async function callAI(question, options, numAnswers) {
        log(`Asking AI for ${numAnswers} answer(s)...`, 'ai');
        
        const resp = await fetch(`${API_URL}/solve-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                options: options.map((o, i) => ({ text: o.text, index: i })),
                num_answers: numAnswers
            })
        });
        
        if (!resp.ok) throw new Error(`API ${resp.status}`);
        
        const data = await resp.json();
        if (data.correct_answer_indices && data.correct_answer_indices.length > numAnswers) {
            data.correct_answer_indices = data.correct_answer_indices.slice(0, numAnswers);
            data.correct_answer_texts = data.correct_answer_texts.slice(0, numAnswers);
        }
        return data;
    }

    function selectAnswers(options, indices) {
        // Clear all
        options.forEach(o => o.input.checked = false);
        
        // Select answers
        indices.forEach(idx => {
            if (idx >= 0 && idx < options.length) {
                const t = options[idx];
                t.input.checked = true;
                t.input.click();
                ['change', 'click', 'input'].forEach(e => 
                    t.input.dispatchEvent(new Event(e, { bubbles: true }))
                );
                log(`✓ ${t.text.substring(0, 50)}`, 'success');
            }
        });
        return true;
    }

    function clickBtn(txt) {
        for (const b of document.querySelectorAll('button')) {
            if (b.textContent.toLowerCase().includes(txt) && !b.disabled && b.offsetParent !== null) {
                b.click();
                return true;
            }
        }
        return false;
    }

    function checkNextButton() {
        for (const b of document.querySelectorAll('button')) {
            const txt = b.textContent.toLowerCase().trim();
            if ((txt === 'next' || txt.includes('next')) && !b.disabled && b.offsetParent !== null) {
                b.click();
                log('Clicked Next button', 'success');
                return true;
            }
        }
        return false;
    }

    async function processQuiz() {
        if (isProcessing || !isReady) return;

        const hasQuiz = document.querySelector('input[type="checkbox"],input[type="radio"]');
        if (!hasQuiz) {
            checkNextButton();
            return;
        }

        const question = extractQuestion();
        const options = extractOptions();
        if (options.length === 0) {
            checkNextButton();
            return;
        }

        const hash = `${question}|${options.map(o => o.text).join('|')}`;
        if (hash === lastQuizHash) return;

        isProcessing = true;
        lastQuizHash = hash;
        const numAnswers = extractNumAnswers(question);

        log('════════════════════════════════════', 'ai');
        log(`Quiz: ${question.substring(0, 80)}...`);
        log(`Selecting ${numAnswers} answer(s)`, 'info');

        try {
            const r = await callAI(question, options, numAnswers);
            if (r.success && r.correct_answer_indices) {
                selectAnswers(options, r.correct_answer_indices);
                await new Promise(x => setTimeout(x, 600));
                if (clickBtn('check') || clickBtn('submit')) {
                    await new Promise(x => setTimeout(x, 1800));
                    if (clickBtn('continue')) lastQuizHash = '';
                }
            }
        } catch (e) {
            log(`Error: ${e.message}`, 'error');
            lastQuizHash = '';
            if (e.message.includes('502') || e.message.includes('503')) {
                log('Server sleeping, reconnecting...', 'warning');
                await wakeUpServer();
            }
        } finally {
            isProcessing = false;
        }
    }

    async function start() {
        console.log('');
        console.log('🤖 LMS AI Quiz Solver v1.0');
        console.log('══════════════════════════');
        
        if (API_URL.includes('YOUR-APP-NAME')) {
            log('ERROR: You need to set your API_URL first!', 'error');
            log('Edit the script and change API_URL to your Railway URL', 'error');
            return;
        }
        
        await wakeUpServer();
        if (isReady) {
            log('Monitoring for quizzes...', 'success');
            log('Stop command: stopQuizAI()', 'info');
            console.log('══════════════════════════');
            intervalId = setInterval(processQuiz, 2000);
            setTimeout(processQuiz, 400);
        }
    }

    start();

    window.stopQuizAI = function() {
        clearInterval(intervalId);
        isProcessing = true;
        isReady = false;
        log('Stopped!', 'warning');
    };
})();
