# LMS AI Quiz Solver

Automatically answers LMS training course quizzes using AI (GPT-4o).

## Features

- ✅ Auto-detects quiz questions
- ✅ Supports single and multiple choice (choose 1, choose 2, choose 3)
- ✅ Clicks Submit and Continue automatically
- ✅ Clicks Next button to advance videos
- ✅ Works with H5P interactive content

## Quick Start

### Step 1: Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to **API Keys** → **Create new secret key**
4. Copy the key (starts with `sk-`)

### Step 2: Deploy Backend to Railway (Free)

1. Click the button below:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/fastapi)

Or manually:

1. Fork this repository
2. Go to [railway.app](https://railway.app) and sign in with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your forked repo
5. Go to **Variables** tab and add:
   ```
   OPENAI_API_KEY = sk-your-key-here
   ```
6. Click **Deploy**
7. Once deployed, go to **Settings** → **Domains** → **Generate Domain**
8. Copy your URL (e.g., `https://your-app.up.railway.app`)

### Step 3: Update the Script

1. Open `lms-quiz-solver.js`
2. Change line 14:
   ```javascript
   const API_URL = 'https://your-app.up.railway.app/api';
   ```

### Step 4: Use It

1. Open your LMS training course
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Copy and paste the entire `lms-quiz-solver.js` script
5. Press **Enter**
6. Watch it work! 🎉

## Commands

| Command | Description |
|---------|-------------|
| `stopQuizAI()` | Stop the script |

## How It Works

1. Script monitors the page for quiz questions every 2 seconds
2. When a quiz is detected, it extracts the question and options
3. Sends to your backend API which calls GPT-4o
4. AI analyzes and returns the correct answer(s)
5. Script selects the answers and clicks Submit
6. Automatically clicks Continue/Next to proceed

## Files

| File | Description |
|------|-------------|
| `server.py` | Backend API (deploy to Railway) |
| `lms-quiz-solver.js` | Browser script (paste in console) |
| `requirements.txt` | Python dependencies |
| `Procfile` | Railway/Heroku config |
| `railway.json` | Railway config |

## Troubleshooting

### "Connection failed" error
- Make sure your Railway app is deployed and running
- Check that `API_URL` matches your Railway domain exactly
- Ensure `OPENAI_API_KEY` is set in Railway variables

### Script not detecting quizzes
- Make sure you're on the course page with the video/quiz
- For H5P content in iframes, you may need to run the script inside the iframe context

### Wrong answers
- The AI is not 100% accurate - some questions may need manual correction
- Complex or context-specific questions may be harder

## Cost

- **Railway**: Free tier includes 500 hours/month
- **OpenAI**: ~$0.01-0.03 per quiz question (GPT-4o pricing)

## Disclaimer

This tool is for educational purposes. Use responsibly and in accordance with your organization's policies.

## License

MIT License - feel free to modify and share!
