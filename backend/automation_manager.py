import asyncio
from typing import Dict, Optional, List
from datetime import datetime, timezone
from lms_automation import LMSAutomation
import logging

logger = logging.getLogger(__name__)

class AutomationManager:
    def __init__(self):
        self.active_sessions: Dict[str, LMSAutomation] = {}
        self.logs: Dict[str, List[Dict]] = {}
        self.status: Dict[str, Dict] = {}
    
    async def log_callback(self, session_id: str, log_entry: Dict):
        """Store logs for a session"""
        if session_id not in self.logs:
            self.logs[session_id] = []
        
        self.logs[session_id].append(log_entry)
        
        # Keep only last 500 logs
        if len(self.logs[session_id]) > 500:
            self.logs[session_id] = self.logs[session_id][-500:]
    
    async def start_automation(self, session_id: str, email: str, password: str, course_title: Optional[str] = None):
        """Start automation for a session"""
        try:
            if session_id in self.active_sessions:
                return {"success": False, "error": "Session already running"}
            
            # Create automation instance
            automation = LMSAutomation(
                email=email,
                password=password,
                log_callback=lambda log: self.log_callback(session_id, log)
            )
            
            self.active_sessions[session_id] = automation
            self.logs[session_id] = []
            self.status[session_id] = {
                "status": "running",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "course": course_title
            }
            
            # Run automation in background
            asyncio.create_task(self._run_automation(session_id, automation, course_title))
            
            return {"success": True, "session_id": session_id}
            
        except Exception as e:
            logger.error(f"Failed to start automation: {e}")
            return {"success": False, "error": str(e)}
    
    async def _run_automation(self, session_id: str, automation: LMSAutomation, course_title: Optional[str]):
        """Background task to run automation"""
        try:
            result = await automation.run(course_title)
            
            self.status[session_id] = {
                "status": "completed" if result.get("success") else "failed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "result": result
            }
            
            # Remove from active sessions
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
                
        except Exception as e:
            logger.error(f"Automation failed: {e}")
            self.status[session_id] = {
                "status": "failed",
                "error": str(e),
                "failed_at": datetime.now(timezone.utc).isoformat()
            }
            
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
    
    async def stop_automation(self, session_id: str):
        """Stop automation for a session"""
        try:
            if session_id not in self.active_sessions:
                return {"success": False, "error": "Session not found"}
            
            automation = self.active_sessions[session_id]
            await automation.stop()
            
            self.status[session_id]["status"] = "stopped"
            self.status[session_id]["stopped_at"] = datetime.now(timezone.utc).isoformat()
            
            del self.active_sessions[session_id]
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Failed to stop automation: {e}")
            return {"success": False, "error": str(e)}
    
    def get_status(self, session_id: str):
        """Get status of a session"""
        return self.status.get(session_id, {"status": "not_found"})
    
    def get_logs(self, session_id: str, limit: int = 100):
        """Get logs for a session"""
        logs = self.logs.get(session_id, [])
        return logs[-limit:]
    
    async def get_courses(self, email: str, password: str):
        """Get list of courses"""
        automation = None
        try:
            automation = LMSAutomation(email, password)
            
            if not await automation.initialize():
                return {"success": False, "error": "Failed to login - please verify credentials"}
            
            courses = await automation.get_courses()
            
            return {"success": True, "courses": courses}
            
        except Exception as e:
            logger.error(f"Failed to get courses: {e}")
            return {"success": False, "error": str(e)}
        finally:
            # Always cleanup browser
            if automation:
                try:
                    await automation.stop()
                except:
                    pass

# Global manager instance
automation_manager = AutomationManager()
