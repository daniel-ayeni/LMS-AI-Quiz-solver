import asyncio
import random
import logging
from playwright.async_api import async_playwright, Page, TimeoutError
from typing import Callable, Optional, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class LMSAutomation:
    def __init__(self, email: str, password: str, log_callback: Optional[Callable] = None):
        self.email = email
        self.password = password
        self.log_callback = log_callback
        self.browser = None
        self.context = None
        self.page = None
        self.is_running = False
        self.current_course = None
        self.progress = 0
        
    def log(self, message: str, level: str = "info"):
        """Log messages and send to callback if available"""
        timestamp = datetime.now(timezone.utc).isoformat()
        log_entry = {
            "timestamp": timestamp,
            "level": level,
            "message": message
        }
        
        if level == "info":
            logger.info(message)
        elif level == "error":
            logger.error(message)
        elif level == "warning":
            logger.warning(message)
        
        if self.log_callback:
            asyncio.create_task(self.log_callback(log_entry))
    
    async def initialize(self):
        """Initialize browser and login"""
        try:
            self.log("Initializing browser...")
            playwright = await async_playwright().start()
            
            # Launch browser with video codec support and GPU acceleration
            self.browser = await playwright.chromium.launch(
                headless=True,
                executable_path="/pw-browsers/chromium-1148/chrome-linux/chrome",
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--use-angle=swiftshader',  # Software GPU rendering
                    '--disable-gpu-sandbox',
                    '--enable-features=VaapiVideoDecoder',  # Hardware video decoding
                    '--autoplay-policy=no-user-gesture-required',  # Allow autoplay
                    '--disable-features=VizDisplayCompositor',
                    '--disable-blink-features=AutomationControlled',  # Hide automation
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream',
                    '--enable-usermedia-screen-capturing',
                    '--allow-http-screen-capture'
                ]
            )
            self.context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            )
            self.page = await self.context.new_page()
            
            # Mute audio to prevent autoplay blocks
            await self.page.add_init_script("""
                Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
                    get: function() { return true; },
                    set: function() {}
                });
            """)
            
            self.log("Logging into LMS...")
            await self.page.goto("https://lms.yourhippo.com/", wait_until="networkidle")
            
            # Wait for login form
            await self.page.wait_for_selector('#email', timeout=10000)
            
            # Fill login form
            await self.page.fill('#email', self.email)
            await self.page.fill('#password', self.password)
            
            # Click login button
            self.log("Submitting credentials...")
            await self.page.click('button:has-text("Login")')
            await self.page.wait_for_timeout(3000)
            
            # Check if login was successful
            current_url = self.page.url
            
            # Check for error messages
            error_indicators = [
                'text="Invalid"',
                'text="incorrect"',
                'text="Incorrect"',
                'text="failed"',
                'text="Failed"'
            ]
            
            for selector in error_indicators:
                try:
                    error = await self.page.query_selector(selector)
                    if error:
                        error_text = await error.inner_text()
                        self.log(f"Login failed: {error_text}", "error")
                        return False
                except:
                    pass
            
            # If still on login page, check if we're actually logged in
            if '/login' in current_url or current_url.endswith('.com/'):
                # Look for typical post-login elements
                await self.page.wait_for_timeout(2000)
                
                # Check page content for dashboard keywords
                page_content = await self.page.content()
                dashboard_keywords = ['Learner Dashboard', 'Your Events', 'Your Bookings', 'Profile', 'Logout']
                
                found_keywords = sum(1 for keyword in dashboard_keywords if keyword in page_content)
                
                if found_keywords >= 2:
                    self.log(f"Login successful! (Found {found_keywords} dashboard indicators)")
                else:
                    self.log("Login failed - please verify credentials are correct for https://lms.yourhippo.com/", "error")
                    return False
            
            self.log("Successfully logged in!")
            return True
            
        except Exception as e:
            self.log(f"Failed to initialize: {str(e)}", "error")
            return False
    
    async def get_courses(self):
        """Fetch list of courses from dashboard"""
        try:
            self.log("Fetching course list...")
            
            # Wait for page to load completely
            await self.page.wait_for_timeout(3000)
            
            courses = []
            seen_titles = set()
            
            # Find table rows (each row is a course)
            # Look for the table body rows
            table_rows = await self.page.query_selector_all('tbody tr, div.bg-white.p-2.rounded.shadow')
            
            self.log(f"Found {len(table_rows)} potential course rows")
            
            for row in table_rows:
                try:
                    # Get the button in this row
                    button = await row.query_selector('button:has-text("Continue"), button:has-text("Take Course"), button:has-text("Take Quiz"), button:has-text("Retake")')
                    
                    if not button:
                        continue
                    
                    button_text = await button.inner_text()
                    
                    # Get all cells/text in the row
                    row_text = await row.inner_text()
                    lines = [l.strip() for l in row_text.split('\n') if l.strip()]
                    
                    # Find course title - look for span with tooltip or main text
                    title_elem = await row.query_selector('span.v-popper--has-tooltip, td.tbl-cell:nth-child(3), .text-base')
                    
                    if title_elem:
                        title = await title_elem.inner_text()
                        title = title.strip()
                    else:
                        # Fallback: extract from lines
                        title = None
                        for line in lines:
                            if len(line) > 15 and line not in ['Continue', 'Take Course', 'Take Quiz', 'Retake Course', 'Retake', 'Elearning', 'elearning']:
                                if '/' not in line[:10] and '%' not in line and 'Due:' not in line:
                                    title = line
                                    break
                    
                    if not title or len(title) < 3:
                        continue
                    
                    # Skip duplicates
                    if title in seen_titles:
                        continue
                    seen_titles.add(title)
                    
                    # Extract progress
                    progress = "0%"
                    progress_elem = await row.query_selector('div[title*="Course"], div:has-text("%")')
                    if progress_elem:
                        progress_text = await progress_elem.inner_text()
                        if '%' in progress_text:
                            # Extract just the number
                            import re
                            match = re.search(r'(\d+%)', progress_text)
                            if match:
                                progress = match.group(1)
                    
                    # Check for "Not Started"
                    if 'Not Started' in row_text:
                        progress = "0%"
                    
                    # Determine status based on button text
                    status = "current"
                    if 'overdue' in row_text.lower() or 'text-red' in await row.get_attribute('class'):
                        status = "overdue"
                    
                    if 'Take Quiz' in button_text:
                        status = "ready_for_quiz"
                    elif 'Continue' in button_text:
                        status = "in_progress"
                    elif 'Retake' in button_text:
                        status = "needs_retake"
                    elif 'Take Course' in button_text:
                        status = "not_started"
                    
                    courses.append({
                        "title": title,
                        "progress": progress,
                        "status": status
                    })
                    
                except Exception as e:
                    self.log(f"Error parsing row: {e}", "warning")
                    continue
            
            # Sort: overdue first, then ready_for_quiz last
            courses.sort(key=lambda x: (
                x["status"] == "ready_for_quiz",  # Quiz ready goes last
                x["status"] != "overdue",  # Overdue goes first
            ))
            
            self.log(f"Parsed {len(courses)} courses")
            for course in courses:
                self.log(f"  - {course['title']}: {course['progress']} ({course['status']})")
            
            return courses
            
        except Exception as e:
            self.log(f"Failed to fetch courses: {str(e)}", "error")
            import traceback
            traceback.print_exc()
            return []
    
    async def get_content_frame(self, page: Page):
        """Get the iframe containing course content if it exists"""
        try:
            # Look for iframes
            frames = page.frames
            
            # Check if there's an iframe with course content
            for frame in frames:
                if frame != page.main_frame:
                    # This is an iframe, check if it has course content
                    try:
                        # Look for common course content indicators
                        has_video = await frame.query_selector('video')
                        has_quiz = await frame.query_selector('input[type="checkbox"], input[type="radio"]')
                        
                        if has_video or has_quiz:
                            self.log(f"Found content in iframe: {frame.url}")
                            return frame
                    except:
                        continue
            
            # No iframe with content, use main frame
            return page.main_frame
        except Exception as e:
            self.log(f"Frame detection: {str(e)}", "warning")
            return page.main_frame
    
    async def process_video(self, page: Page):
        """Wait for video to complete - Interactive training video (can't seek, only play/pause)"""
        try:
            # Get the correct frame (might be in iframe)
            frame = await self.get_content_frame(page)
            
            # Check if there's a video player in the frame
            video = await frame.query_selector('video')
            
            if video:
                self.log("Monitoring video playback (interactive training - can't skip)...")
                
                # Just monitor if video is progressing naturally
                last_time = 0
                stuck_count = 0
                check_count = 0
                
                while self.is_running:
                    await asyncio.sleep(5)  # Check every 5 seconds
                    check_count += 1
                    
                    try:
                        current_time = await video.evaluate('el => el.currentTime')
                        is_paused = await video.evaluate('el => el.paused')
                        ended = await video.evaluate('el => el.ended')
                        
                        if ended:
                            self.log("✓ Video completed (ended)")
                            await asyncio.sleep(2)
                            break
                        
                        # Check if time is progressing
                        if current_time > last_time + 1:
                            minutes = int(current_time // 60)
                            seconds = int(current_time % 60)
                            self.log(f"Video playing: {minutes}:{seconds:02d}")
                            last_time = current_time
                            stuck_count = 0
                        else:
                            # No progress - might be paused for quiz or loading
                            if not is_paused:
                                stuck_count += 1
                                if stuck_count >= 6:  # 30 seconds no progress
                                    self.log("Video paused for 30+ seconds - likely quiz or end")
                                    break
                            else:
                                self.log("Video paused (might be quiz or buffering)")
                        
                        # Check for quiz
                        has_quiz = await frame.query_selector('input[type="checkbox"], input[type="radio"]')
                        if has_quiz:
                            self.log("⚠️ Quiz detected!")
                            break
                        
                        # Check if Next button enabled
                        next_btn = await page.query_selector('button:has-text("Next"):not([disabled])')
                        if next_btn:
                            try:
                                class_attr = await next_btn.get_attribute("class") or ""
                                if 'disabled' not in class_attr.lower():
                                    self.log("✓ Next button enabled")
                                    break
                            except:
                                pass
                        
                        # Safety: max 100 checks (8+ minutes per video segment)
                        if check_count >= 100:
                            self.log("Video monitoring timeout (8+ min), moving on")
                            break
                        
                    except Exception as e:
                        self.log(f"Monitoring error: {e}", "warning")
                        break
            else:
                self.log("No video element (might be text content)")
                await asyncio.sleep(5)
            
        except Exception as e:
            self.log(f"Video processing error: {str(e)}", "warning")
    
    async def handle_quiz(self, page: Page):
        """Handle in-video quiz questions with random attempts"""
        try:
            # Get the correct frame (might be in iframe)
            frame = await self.get_content_frame(page)
            
            # Look for quiz elements in the frame
            quiz_container = await frame.query_selector('div:has(input[type="checkbox"]), div:has(input[type="radio"]), form:has(input)')
            
            if not quiz_container:
                return False
            
            self.log("Quiz detected! Attempting to answer...")
            
            # Check for checkboxes
            checkboxes = await frame.query_selector_all('input[type="checkbox"]')
            radio_buttons = await frame.query_selector_all('input[type="radio"]')
            
            max_attempts = 20
            attempt = 0
            
            while attempt < max_attempts and self.is_running:
                attempt += 1
                self.log(f"Quiz attempt {attempt}")
                
                # Random selection for checkboxes
                if checkboxes:
                    # Uncheck all first
                    for cb in checkboxes:
                        if await cb.is_checked():
                            await cb.click()
                    
                    # Randomly select 1-3 checkboxes
                    num_to_select = random.randint(1, min(3, len(checkboxes)))
                    selected = random.sample(list(range(len(checkboxes))), num_to_select)
                    
                    for i in selected:
                        await checkboxes[i].click()
                        await asyncio.sleep(0.2)
                
                # Random selection for radio buttons
                elif radio_buttons:
                    choice = random.choice(radio_buttons)
                    await choice.click()
                    await asyncio.sleep(0.2)
                
                # Click submit/check button
                submit_btn = await frame.query_selector('button:has-text("CHECK"), button:has-text("Submit"), button:has-text("Check")')
                if submit_btn:
                    await submit_btn.click()
                    await asyncio.sleep(1.5)
                    
                    # Check for success indicators
                    success = await frame.query_selector('button:has-text("CONTINUE"), div:has-text("Correct"), [class*="correct"]')
                    
                    if success:
                        self.log("Quiz answered correctly!")
                        
                        # Click continue button
                        continue_btn = await frame.query_selector('button:has-text("CONTINUE"), button:has-text("Continue")')
                        if continue_btn:
                            await continue_btn.click()
                            await asyncio.sleep(1)
                        
                        return True
                    else:
                        self.log("Incorrect answer, trying again...", "warning")
                        await asyncio.sleep(1)
                        
                        # Reload checkboxes/radio buttons for next attempt
                        checkboxes = await frame.query_selector_all('input[type="checkbox"]')
                        radio_buttons = await frame.query_selector_all('input[type="radio"]')
                else:
                    break
            
            if attempt >= max_attempts:
                self.log("Max quiz attempts reached", "error")
            
            return False
            
        except Exception as e:
            self.log(f"Quiz handling error: {str(e)}", "error")
            return False
    
    async def process_course(self, course_title: str):
        """Process a single course until final quiz"""
        try:
            self.current_course = course_title
            self.is_running = True
            self.log(f"Starting course: {course_title}")
            
            # Find the course row in the table
            self.log("Looking for course in dashboard...")
            
            # Try to find by text in span with tooltip
            course_span = await self.page.query_selector(f'span.v-popper--has-tooltip:has-text("{course_title}")')
            
            if course_span:
                # Get the row containing this span
                row = await course_span.evaluate_handle('el => el.closest("tr") || el.closest("div.bg-white")')
                if row:
                    row_elem = row.as_element()
                    if row_elem:
                        # Find the button in this row
                        button = await row_elem.query_selector('button:has-text("Continue"), button:has-text("Take Course"), button:has-text("Retake")')
                        if button:
                            self.log("Found course button, clicking...")
                            await button.click()
                            await self.page.wait_for_timeout(3000)
                        else:
                            self.log("Button not found in row", "error")
                            return False
            else:
                self.log(f"Could not find course: {course_title}", "error")
                return False
            
            # Now we might be on an overview page with another "Continue" button
            # This is the progress button that says "You're X% of the way through..."
            await self.page.wait_for_timeout(3000)
            
            self.log("Looking for course progress Continue button...")
            
            # Try multiple selectors for the Continue button
            continue_selectors = [
                'button:has-text("You\'re")',  # Button with progress text
                'button:has-text("Continue")',
                'button.lg\\:flex:has-text("Continue")',
                'button:has-text("way through")'
            ]
            
            overview_continue = None
            for selector in continue_selectors:
                try:
                    overview_continue = await self.page.query_selector(selector)
                    if overview_continue:
                        self.log(f"Found Continue button with: {selector}")
                        break
                except:
                    continue
            
            if not overview_continue:
                # Try getting all buttons and finding the right one
                all_buttons = await self.page.query_selector_all('button')
                for btn in all_buttons:
                    try:
                        text = await btn.inner_text()
                        if 'way through' in text or ('Continue' in text and '%' in text):
                            overview_continue = btn
                            self.log("Found Continue button by text matching")
                            break
                    except:
                        continue
            
            if overview_continue:
                self.log("Clicking Continue button to enter video player...")
                await overview_continue.click()
                self.log("Waiting 15 seconds for H5P iframe to load...")
                await self.page.wait_for_timeout(15000)  # Wait 15 seconds for iframe to load
            else:
                self.log("Continue button not found, might already be in player")
                await self.page.wait_for_timeout(5000)
            
            # Now we should be in the course player
            self.log("Entered course player, waiting for video player to load...")
            await self.page.wait_for_timeout(5000)  # Wait 5 seconds for player to load
            
            # Check for and dismiss any modals/popups that might be blocking interaction
            self.log("Checking for modal popups...")
            modal_detected = False
            
            # Look for modal overlays
            modal_selectors = [
                '.modal-bg',
                '[class*="modal"]',
                '[class*="popup"]',
                '[class*="overlay"]',
                'div[data-v-dacca50d].modal-bg',
                '.v-dialog',
                '[role="dialog"]'
            ]
            
            for selector in modal_selectors:
                try:
                    modal = await self.page.query_selector(selector)
                    if modal:
                        self.log(f"Found modal with selector: {selector}")
                        modal_detected = True
                        
                        # Try to find and click close button
                        close_selectors = [
                            'button:has-text("Close")',
                            'button:has-text("OK")',
                            'button:has-text("Got it")',
                            'button:has-text("Continue")',
                            'button:has-text("Start")',
                            'button[aria-label*="Close"]',
                            'button[aria-label*="Dismiss"]',
                            '.close',
                            '[class*="close"]',
                            'button.v-btn',
                            'button'
                        ]
                        
                        for close_sel in close_selectors:
                            try:
                                close_btn = await self.page.query_selector(close_sel)
                                if close_btn:
                                    self.log(f"Found close button: {close_sel}, clicking...")
                                    await close_btn.click(force=True, timeout=3000)
                                    await asyncio.sleep(2)
                                    self.log("✓ Modal dismissed")
                                    break
                            except:
                                continue
                        
                        # If no close button worked, try pressing Escape
                        try:
                            self.log("Trying Escape key...")
                            await self.page.keyboard.press('Escape')
                            await asyncio.sleep(1)
                            self.log("✓ Pressed Escape")
                        except:
                            pass
                        
                        # Try clicking outside the modal
                        try:
                            self.log("Trying to click outside modal...")
                            await self.page.evaluate('document.querySelector(".modal-bg")?.click()')
                            await asyncio.sleep(1)
                        except:
                            pass
                        
                        break
                except:
                    continue
            
            if modal_detected:
                self.log("Waited 3 seconds after modal dismissal...")
                await asyncio.sleep(3)
            else:
                self.log("No modal popups detected")
            
            # Main course loop
            while self.is_running:
                # Check for final quiz (on main page, not in iframe)
                final_quiz = await self.page.query_selector('button:has-text("Take Quiz"):not(:has-text("Retake"))')
                
                if final_quiz:
                    self.log("🎯 Final quiz detected! Stopping automation.", "info")
                    self.log("Course video content completed. Ready for final assessment.", "info")
                    return "final_quiz_ready"
                
                # Get the content frame (might be in iframe)
                frame = await self.get_content_frame(self.page)
                if frame != self.page.main_frame:
                    self.log(f"Working in iframe: {frame.url}")
                
                # Look for video player and START it properly
                video_elem = await frame.query_selector('video')
                if video_elem:
                    self.log("Video player found, checking if it needs to start...")
                    
                    try:
                        is_paused = await video_elem.evaluate('el => el.paused')
                        current_time = await video_elem.evaluate('el => el.currentTime')
                        
                        # Check for pause button (|| icon) to see if video is actually playing
                        pause_btn_selectors = [
                            'button[aria-label*="Pause"]',
                            'button[title*="Pause"]',
                            '.h5p-control.h5p-pause',
                            'button.h5p-pause',
                            '.vjs-playing',
                            '[class*="pause"]'
                        ]
                        
                        pause_btn = None
                        for selector in pause_btn_selectors:
                            try:
                                pause_btn = await frame.query_selector(selector)
                                if pause_btn:
                                    self.log(f"✓ Pause button detected - video IS playing!")
                                    break
                            except:
                                continue
                        
                        if is_paused and current_time < 5:  # Video hasn't really started yet
                            self.log("Video hasn't started yet, attempting to play...")
                            
                            # This is an interactive training video - can't seek, only play/pause
                            # Need to trigger it to start playing
                            
                            # Method 1: Click the video element to trigger user interaction
                            self.log("Method 1: Clicking video element to trigger interaction...")
                            try:
                                await video_elem.click(force=True, timeout=5000)
                                await asyncio.sleep(2)
                            except Exception as e:
                                self.log(f"Video click failed: {e}", "warning")
                            
                            # Method 2: Use JavaScript to call play() with proper error handling
                            self.log("Method 2: Calling video.play() via JavaScript...")
                            try:
                                play_result = await video_elem.evaluate('''
                                    async (el) => {
                                        try {
                                            el.muted = true;  // Mute for autoplay policy
                                            const playPromise = el.play();
                                            if (playPromise !== undefined) {
                                                await playPromise;
                                                return { success: true, message: 'Playing' };
                                            }
                                            return { success: true, message: 'Play called' };
                                        } catch (err) {
                                            return { success: false, error: err.message };
                                        }
                                    }
                                ''')
                                
                                self.log(f"Play result: {play_result}")
                                
                                if play_result.get('success'):
                                    self.log("✓ Video.play() succeeded")
                                else:
                                    self.log(f"✗ Video.play() failed: {play_result.get('error')}", "warning")
                                    
                            except Exception as e:
                                self.log(f"JavaScript play error: {e}", "error")
                            
                            # Method 3: Try clicking any visible overlay
                            self.log("Method 3: Looking for clickable overlays...")
                            try:
                                overlays = await frame.query_selector_all('div[class*="overlay"], div[class*="poster"]')
                                for overlay in overlays[:3]:
                                    try:
                                        await overlay.click(force=True, timeout=2000)
                                        await asyncio.sleep(1)
                                    except:
                                        pass
                            except:
                                pass
                            
                            self.log("⏳ Waiting 90 seconds to check if video started...")
                            await asyncio.sleep(90)
                            
                            # Check if pause button appeared (confirms video is playing)
                            pause_btn_selectors = [
                                'button[aria-label*="Pause"]',
                                'button[title*="Pause"]',
                                '.h5p-control.h5p-pause',
                                'button.h5p-pause',
                                '[class*="pause"]'
                            ]
                            
                            pause_btn_check = None
                            for selector in pause_btn_selectors:
                                try:
                                    pause_btn_check = await frame.query_selector(selector)
                                    if pause_btn_check:
                                        break
                                except:
                                    continue
                            
                            is_still_paused = await video_elem.evaluate('el => el.paused')
                            new_time = await video_elem.evaluate('el => el.currentTime')
                            
                            if pause_btn_check:
                                self.log("✓ Video is now playing! (Pause button visible)")
                            elif not is_still_paused or new_time > 0:
                                self.log(f"✓ Video is playing (time: {int(new_time)}s)")
                            else:
                                self.log("Video still not playing after 90 seconds, will retry next loop...")
                                await asyncio.sleep(10)
                                continue
                    except Exception as e:
                        self.log(f"Error checking video state: {e}", "warning")
                
                # Process video (monitor it playing)
                await self.process_video(self.page)
                
                # Check for quiz in the content frame
                has_quiz = await frame.query_selector('input[type="checkbox"], input[type="radio"]')
                if has_quiz:
                    self.log("Quiz found in video!")
                    await self.handle_quiz(self.page)
                
                # Check for Next button
                self.log("Checking for Next button...")
                next_btn = await self.page.query_selector('button:has-text("Next"), button:has-text("NEXT")')
                
                if not next_btn:
                    next_btn = await self.page.query_selector('button:has-text("Continue"), button:has-text("CONTINUE")')
                
                if not next_btn and frame != self.page.main_frame:
                    next_btn = await frame.query_selector('button:has-text("Next"), button:has-text("Continue")')
                
                if next_btn:
                    # Check if button is enabled
                    is_disabled = await next_btn.get_attribute("disabled")
                    class_attr = await next_btn.get_attribute("class") or ""
                    
                    if not is_disabled and 'disabled' not in class_attr.lower():
                        self.log("✓ Next button is enabled, clicking...")
                        
                        # Check for modal before clicking
                        modal_check = await self.page.query_selector('.modal-bg, [class*="modal"]')
                        if modal_check:
                            self.log("Modal detected, dismissing before clicking Next...")
                            try:
                                await self.page.keyboard.press('Escape')
                                await asyncio.sleep(1)
                            except:
                                pass
                        
                        try:
                            await next_btn.click(force=True, timeout=5000)
                            self.log("Successfully clicked Next, waiting for new content...")
                            await self.page.wait_for_timeout(5000)
                        except Exception as e:
                            self.log(f"Click error: {e}", "warning")
                            # Try JavaScript click as fallback
                            try:
                                self.log("Trying JavaScript click...")
                                await next_btn.evaluate('el => el.click()')
                                self.log("✓ JavaScript click succeeded")
                                await asyncio.sleep(5)
                            except:
                                await asyncio.sleep(5)
                    else:
                        self.log("Next button exists but not enabled yet, waiting 10 seconds...")
                        await asyncio.sleep(10)
                else:
                    self.log("No Next button found, checking if course is complete...")
                    final_quiz = await self.page.query_selector('button:has-text("Take Quiz")')
                    if final_quiz:
                        self.log("🎯 Final quiz detected! Stopping automation.", "info")
                        return "final_quiz_ready"
                    
                    await asyncio.sleep(10)
                
                await asyncio.sleep(2)
            
            self.log(f"Course processing completed: {course_title}")
            return True
            
        except Exception as e:
            self.log(f"Course processing failed: {str(e)}", "error")
            import traceback
            traceback.print_exc()
            return False
    
    async def stop(self):
        """Stop automation"""
        self.is_running = False
        self.log("Stopping automation...")
        
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        
        self.log("Automation stopped")
    
    async def run(self, course_title: Optional[str] = None):
        """Main automation flow"""
        try:
            # Initialize browser and login
            if not await self.initialize():
                return {"success": False, "error": "Failed to initialize"}
            
            # Get courses
            courses = await self.get_courses()
            
            if not courses:
                self.log("No courses found", "warning")
                await self.stop()
                return {"success": False, "error": "No courses found"}
            
            # Process specific course or first incomplete
            target_course = None
            if course_title:
                target_course = next((c for c in courses if c["title"] == course_title), None)
            else:
                # Get first incomplete course (skip "ready_for_quiz" status)
                target_course = next(
                    (c for c in courses if c["status"] in ["in_progress", "needs_retake", "not_started", "overdue"]),
                    None
                )
            
            if not target_course:
                self.log("No course to process", "warning")
                await self.stop()
                return {"success": False, "error": "No course to process"}
            
            # Process the course
            result = await self.process_course(target_course["title"])
            
            await self.stop()
            
            return {
                "success": True,
                "course": target_course["title"],
                "result": result
            }
            
        except Exception as e:
            self.log(f"Automation error: {str(e)}", "error")
            await self.stop()
            return {"success": False, "error": str(e)}
