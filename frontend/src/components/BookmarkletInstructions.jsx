import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, ExternalLink, ChevronDown, ChevronUp, Zap, Bot, MonitorPlay } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function BookmarkletInstructions() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const mainScript = `${BACKEND_URL}/lms_ai_quiz.js`;
  const iframeScript = `${BACKEND_URL}/lms_ai_iframe.js`;

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const fetchAndCopyScript = async (url, label) => {
    try {
      toast.info('Fetching script...');
      const response = await fetch(url);
      const script = await response.text();
      await navigator.clipboard.writeText(script);
      toast.success(`${label} copied! Paste it in the browser console.`);
    } catch (err) {
      toast.error('Failed to fetch script');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3 py-8">
          <div className="flex justify-center">
            <Badge variant="outline" className="border-emerald-500 text-emerald-400 px-4 py-1">
              <Bot className="w-4 h-4 mr-2" />
              AI-Powered
            </Badge>
          </div>
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            LMS AI Quiz Solver
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Automatically answer in-video quiz questions using AI. 
            The script analyzes each question and selects the correct answer.
          </p>
        </div>

        {/* Main Instructions */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm" data-testid="main-instructions">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <MonitorPlay className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-2xl text-slate-100">Quick Start Guide</CardTitle>
                <CardDescription className="text-slate-400">Follow these steps to automate your training quizzes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-100 mb-2">Copy the AI Script</h3>
                <p className="text-slate-400 mb-3">Click the button below to copy the AI quiz solver script to your clipboard.</p>
                <Button 
                  onClick={() => fetchAndCopyScript(mainScript, 'AI Quiz Script')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  data-testid="copy-script-button"
                >
                  <Copy className="w-4 h-4" />
                  Copy AI Quiz Script
                </Button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-100 mb-2">Open Your Course</h3>
                <p className="text-slate-400 mb-3">Log into YourHippo LMS and navigate to any course with video content.</p>
                <Button 
                  variant="outline"
                  onClick={() => window.open('https://lms.yourhippo.com/', '_blank')}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700 gap-2"
                  data-testid="open-lms-button"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open YourHippo LMS
                </Button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-100 mb-2">Open Browser Console</h3>
                <p className="text-slate-400 mb-3">Press <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-200 font-mono">F12</kbd> to open Developer Tools, then click the <strong>Console</strong> tab.</p>
                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <p className="text-slate-400 text-sm">
                    <strong className="text-slate-200">Tip:</strong> In Edge/Chrome, you can also right-click anywhere and select "Inspect", then click "Console".
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                4
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-100 mb-2">Paste & Run</h3>
                <p className="text-slate-400 mb-3">Paste the copied script into the console and press <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-200 font-mono">Enter</kbd>.</p>
                <div className="p-3 bg-emerald-900/20 rounded-lg border border-emerald-700/50">
                  <p className="text-emerald-400 text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    The AI will now automatically answer quiz questions as they appear!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Section */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm" data-testid="advanced-instructions">
          <CardHeader 
            className="cursor-pointer"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl text-slate-100">Advanced: Cross-Origin Iframe Script</CardTitle>
                <CardDescription className="text-slate-400">Use this if quizzes appear inside an iframe</CardDescription>
              </div>
              {showAdvanced ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </CardHeader>
          {showAdvanced && (
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-700/50">
                <p className="text-yellow-400 text-sm">
                  <strong>When to use:</strong> If the main script doesn't detect quizzes (they're inside an H5P iframe), 
                  you need to run a separate script inside the iframe's context.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-200">Steps:</h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-400">
                  <li>Open Developer Tools (F12) and go to Console</li>
                  <li>Find the <strong className="text-slate-200">context dropdown</strong> at the top left (usually says "top")</li>
                  <li>Click it and select the iframe URL (contains "h5p" or "content.yourhippo.com")</li>
                  <li>Copy and paste the iframe script below</li>
                </ol>
              </div>

              <Button 
                onClick={() => fetchAndCopyScript(iframeScript, 'Iframe Script')}
                className="bg-slate-700 hover:bg-slate-600 text-white gap-2"
                data-testid="copy-iframe-script-button"
              >
                <Copy className="w-4 h-4" />
                Copy Iframe Script
              </Button>
            </CardContent>
          )}
        </Card>

        {/* How It Works */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm" data-testid="how-it-works">
          <CardHeader>
            <CardTitle className="text-xl text-slate-100">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 text-center">
                <div className="text-3xl mb-2">🔍</div>
                <h4 className="font-semibold text-slate-200 mb-1">Detects Quizzes</h4>
                <p className="text-slate-400 text-sm">Monitors for quiz questions as they appear during the video</p>
              </div>
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 text-center">
                <div className="text-3xl mb-2">🤖</div>
                <h4 className="font-semibold text-slate-200 mb-1">AI Analysis</h4>
                <p className="text-slate-400 text-sm">Sends the question to GPT-4o which analyzes and determines the answer</p>
              </div>
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 text-center">
                <div className="text-3xl mb-2">✅</div>
                <h4 className="font-semibold text-slate-200 mb-1">Auto-Answers</h4>
                <p className="text-slate-400 text-sm">Selects the correct answer and clicks submit automatically</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Notes */}
        <Card className="bg-red-900/20 border-red-800/50 backdrop-blur-sm" data-testid="important-notes">
          <CardHeader>
            <CardTitle className="text-xl text-red-300">Important Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-slate-300 flex items-start gap-2">
              <span className="text-red-400">•</span>
              This tool handles <strong>in-video flash quizzes only</strong>. You must complete the final exam yourself.
            </p>
            <p className="text-slate-300 flex items-start gap-2">
              <span className="text-red-400">•</span>
              Let the videos play naturally - the script will detect and answer quizzes automatically.
            </p>
            <p className="text-slate-300 flex items-start gap-2">
              <span className="text-red-400">•</span>
              To stop the script at any time, type <code className="px-2 py-0.5 bg-slate-800 rounded text-slate-300">stopLMSAI()</code> in the console.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
