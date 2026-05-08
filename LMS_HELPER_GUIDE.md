# 🎓 LMS Auto-Quiz Helper - User Guide

## What This Does
- ✅ You open the course in your normal browser
- ✅ Videos play naturally (you can minimize/mute the tab)
- ✅ Script automatically detects and answers quizzes
- ✅ Script clicks Next button when ready
- ✅ You just keep the tab open!

## How to Use

### Method 1: Browser Console (Easiest)

1. **Open Your Course**
   - Go to https://lms.yourhippo.com/
   - Login normally
   - Click on a course you want to complete
   - Click "Continue" to enter the video player

2. **Open Browser Console**
   - Press `F12` (Windows/Linux) or `Cmd+Option+J` (Mac)
   - Click on the "Console" tab

3. **Paste the Script**
   - Open the file: `lms_auto_quiz.js`
   - Copy ALL the code (Ctrl+A, Ctrl+C)
   - Paste it into the console
   - Press Enter

4. **Let It Run!**
   ```
   🚀 LMS Auto-Quiz Helper Started!
   📹 Let the video play naturally - I'll handle the quizzes
   ```

5. **What You'll See**
   - Video plays normally
   - When quiz appears: `🎯 Quiz detected! Attempting to answer...`
   - `✅ Quiz answered correctly!`
   - `✅ Next button is available, clicking...`

### Method 2: Bookmarklet (Reusable)

1. **Create a Bookmark**
   - Right-click your bookmarks bar
   - Click "Add page" or "Add bookmark"
   - Name it: "Auto Quiz"

2. **Paste This as the URL:**
   ```javascript
   javascript:(function(){fetch('https://video-tutor-4.preview.emergentagent.com/lms_auto_quiz.js').then(r=>r.text()).then(eval);})();
   ```

3. **Use It**
   - Navigate to your course video page
   - Click the "Auto Quiz" bookmark
   - Script activates!

## What Happens

```
Timeline:
┌─────────────────────────────────────────┐
│ 1. You open course → Click Continue     │
│ 2. Video starts playing (keep tab open) │
│ 3. Quiz appears at 2:30                 │
│    → Script detects it                  │
│    → Tries random answers               │
│    → Gets it correct                    │
│    → Clicks Continue                    │
│ 4. Video continues playing              │
│ 5. Another quiz at 5:45                 │
│    → Script handles it                  │
│ 6. Video ends                           │
│    → Script clicks Next                 │
│ 7. Repeat for next topic                │
│ 8. Final quiz appears → STOPS           │
│    → You take final quiz manually       │
└─────────────────────────────────────────┘
```

## Console Output Examples

**When Running:**
```
ℹ️ [13:45:10] Starting quiz monitor...
ℹ️ [13:45:10] Keep this tab open and let the video play!
📹 Video: 1:23
📹 Video: 2:15
🎯 [13:47:30] Quiz detected! Attempting to answer...
ℹ️ [13:47:30] Attempt 1/20
ℹ️ [13:47:31] Selected 2 checkbox(es)
ℹ️ [13:47:31] Clicked submit button
⚠️ [13:47:33] Incorrect answer, trying again...
ℹ️ [13:47:34] Attempt 2/20
✅ [13:47:35] Quiz answered correctly!
✅ [13:47:36] Clicked Continue button
📹 Video: 3:45
✅ [13:50:12] Next button is available, clicking...
```

## Tips

### 💡 Pro Tips
- **Mute the tab** - You don't need to listen
- **Minimize the window** - But don't close the tab!
- **Multiple courses** - Run in different tabs simultaneously
- **Check progress** - Video time is logged every 10 seconds

### ⚠️ Important
- **Don't close the tab** - Script will stop
- **Don't refresh** - You'll need to paste the script again
- **Keep browser open** - Minimize is fine, closing isn't
- **Final quiz** - Script WON'T answer final quizzes (by design)

### 🛑 To Stop
Type in console:
```javascript
stopLMSHelper()
```

## Troubleshooting

### Script Not Working?
1. Make sure you're on the course page (with video player)
2. Check console for errors
3. Try refreshing and pasting script again

### Quiz Not Being Detected?
- Wait a few seconds after quiz appears
- Check if quiz is in an iframe
- Refresh and restart script

### Video Not Playing?
- Click the play button manually once
- Script handles quizzes, not video starting
- Make sure tab isn't muted by browser

## What It Does vs. Doesn't Do

### ✅ DOES:
- Detect quizzes automatically
- Try random answers until correct
- Click Continue after quiz
- Click Next when video ends
- Log progress in console

### ❌ DOESN'T:
- Start the video (you click play once)
- Fast-forward videos (not possible anyway)
- Take final quizzes (you do those)
- Work when tab is closed
- Work across page refreshes

## Privacy & Security

- ✅ Runs entirely in YOUR browser
- ✅ No data sent anywhere
- ✅ No external servers involved
- ✅ Just automates clicks you'd make anyway
- ✅ Open source - you can read the code!

---

## Need Help?

The script logs everything it does in the console. If something isn't working, check the console messages to see what's happening.

**Happy Learning! 🎓**
