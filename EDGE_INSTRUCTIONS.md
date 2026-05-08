# 🎯 LMS Auto-Quiz Helper - Microsoft Edge Instructions

## Method B: Bookmarklet for Edge

### Step 1: Show Your Favorites Bar

1. Open Microsoft Edge
2. Press `Ctrl + Shift + B` to show the Favorites Bar
   - Or click the `...` menu → Settings → Appearance → Toggle "Show favorites bar" ON

### Step 2: Add the Bookmarklet

**Option A: Drag & Drop (Easiest)**
1. Go to: https://video-tutor-4.preview.emergentagent.com/helper.html
2. Look for the green button that says "⭐ LMS Auto-Quiz"
3. **Click and HOLD** on the button
4. **Drag it up** to your Favorites Bar
5. **Drop it** there
6. Done! 🎉

**Option B: Manual Add (If drag doesn't work)**
1. Right-click on your Favorites Bar
2. Click "Add Folder or Favorite"
3. Name: `LMS Auto-Quiz`
4. URL: Copy and paste this EXACTLY:
   ```
   javascript:(function(){fetch('https://video-tutor-4.preview.emergentagent.com/lms_auto_quiz.js').then(r=>r.text()).then(eval);})();
   ```
5. Click "Save"

### Step 3: Use It!

1. **Open your LMS course**
   - Go to https://lms.yourhippo.com/
   - Login
   - Navigate to a course
   - Click "Continue" to start the video

2. **Click the bookmarklet**
   - Click "LMS Auto-Quiz" in your Favorites Bar
   - You should see in the console (F12): "🚀 LMS Auto-Quiz Helper Started!"

3. **Let it run!**
   - Keep the Edge tab open (you can minimize)
   - Mute if you want
   - Script handles quizzes automatically

### Troubleshooting Edge-Specific Issues

**Bookmarklet doesn't do anything when clicked?**
1. Press `F12` to open DevTools
2. Click on "Console" tab
3. Click the bookmarklet again
4. Look for any error messages

**Can't drag the button?**
- Try the "Manual Add" method above instead
- Or use Method A (Copy & Paste) from the main page

**Script blocked by Edge?**
1. Click the 🛡️ shield icon in the address bar
2. Allow JavaScript from this site
3. Try clicking the bookmarklet again

### What You'll See

Once activated, open the Console (F12) and you'll see:

```
🚀 LMS Auto-Quiz Helper Started!
📹 Let the video play naturally - I'll handle the quizzes
ℹ️ [13:45:10] Starting quiz monitor...
📹 Video: 1:23
🎯 [13:47:30] Quiz detected! Attempting to answer...
✅ [13:47:35] Quiz answered correctly!
```

### Edge Tips

- **Pin the tab**: Right-click the LMS tab → "Pin tab" to prevent accidental closing
- **Mute the tab**: Right-click the tab → "Mute site"
- **Side by side**: Use Edge's split screen to watch the progress while doing other work
- **Collections**: Add your courses to a Collection for easy access

### Need Help?

Full guide: https://video-tutor-4.preview.emergentagent.com/helper.html

---

**Happy Learning! 🎓 (Edge Edition)**
