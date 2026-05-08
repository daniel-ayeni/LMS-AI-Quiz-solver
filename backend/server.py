from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import asyncio
import json
from automation_manager import automation_manager
from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM Configuration for Quiz Solving
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# LMS Automation Models
class Credentials(BaseModel):
    email: str
    password: str

class StartAutomationRequest(BaseModel):
    email: str
    password: str
    course_title: Optional[str] = None

class AutomationResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    session_id: Optional[str] = None
    error: Optional[str] = None


# Quiz Solving Models
class QuizOption(BaseModel):
    text: str
    index: int

class SolveQuizRequest(BaseModel):
    question: str
    options: List[QuizOption]
    num_answers: Optional[int] = 1  # How many answers to select

class SolveQuizResponse(BaseModel):
    success: bool
    correct_answer_indices: Optional[List[int]] = None  # Support multiple answers
    correct_answer_texts: Optional[List[str]] = None
    explanation: Optional[str] = None
    error: Optional[str] = None


# Quiz Solving Endpoint
@api_router.post("/solve-quiz", response_model=SolveQuizResponse)
async def solve_quiz(request: SolveQuizRequest):
    """Use AI to solve a quiz question - supports multiple answers"""
    try:
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
        
        logger.info(f"Solving quiz: {request.question[:100]}...")
        logger.info(f"Number of answers required: {request.num_answers}")
        
        # Format options for the prompt
        options_text = "\n".join([f"{chr(65 + opt.index)}. {opt.text}" for opt in request.options])
        
        # Determine if multiple answers needed
        num_answers = request.num_answers or 1
        
        # Create prompt for the LLM
        if num_answers > 1:
            prompt = f"""You are an expert at answering workplace training and compliance quiz questions. 

Question: {request.question}

Options:
{options_text}

IMPORTANT: This question requires EXACTLY {num_answers} correct answers.

Instructions:
1. Read the question very carefully
2. Analyze ALL options thoroughly  
3. Select EXACTLY {num_answers} correct answers
4. Think about workplace safety, compliance, and best practices
5. Respond with ONLY a JSON object (no markdown, no code blocks):

{{"answer_indices": [<list of {num_answers} 0-based indices>], "explanation": "<brief reason for each selection>"}}

Example for selecting options A and C: {{"answer_indices": [0, 2], "explanation": "A is correct because... C is correct because..."}}

Return ONLY the JSON object."""
        else:
            prompt = f"""You are an expert at answering workplace training and compliance quiz questions.

Question: {request.question}

Options:
{options_text}

Instructions:
1. Read the question very carefully
2. Analyze ALL options thoroughly
3. Select the SINGLE best answer
4. Think about workplace safety, compliance, and best practices
5. Respond with ONLY a JSON object (no markdown, no code blocks):

{{"answer_indices": [<single 0-based index>], "explanation": "<brief reason>"}}

Example for selecting option B: {{"answer_indices": [1], "explanation": "B is correct because..."}}

Return ONLY the JSON object."""

        # Initialize LLM chat with GPT-5.2 for better reasoning
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"quiz-{uuid.uuid4()}",
            system_message="You are an expert at workplace training quizzes. Focus on safety, compliance, and professional best practices. Always respond with valid JSON only, no markdown formatting."
        ).with_model("openai", "gpt-5.2")
        
        # Send message and get response
        user_message = UserMessage(text=prompt)
        response_text = await chat.send_message(user_message)
        
        logger.info(f"LLM response: {response_text[:300]}")
        
        # Parse the response
        try:
            # Clean the response - remove markdown code blocks if present
            cleaned_response = response_text.strip()
            if cleaned_response.startswith("```"):
                lines = cleaned_response.split("```")
                if len(lines) > 1:
                    cleaned_response = lines[1]
                    if cleaned_response.startswith("json"):
                        cleaned_response = cleaned_response[4:]
                    cleaned_response = cleaned_response.strip()
            
            result = json.loads(cleaned_response)
            answer_indices = result.get("answer_indices", [0])
            explanation = result.get("explanation", "")
            
            # Ensure we have a list
            if not isinstance(answer_indices, list):
                answer_indices = [answer_indices]
            
            # Validate indices
            valid_indices = []
            for idx in answer_indices:
                if isinstance(idx, int) and 0 <= idx < len(request.options):
                    valid_indices.append(idx)
            
            # If no valid indices, default to first option
            if not valid_indices:
                valid_indices = [0]
            
            # Get the answer texts
            answer_texts = [request.options[idx].text for idx in valid_indices]
            
            return SolveQuizResponse(
                success=True,
                correct_answer_indices=valid_indices,
                correct_answer_texts=answer_texts,
                explanation=explanation
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response: {response_text}")
            # Try to extract answers from text if JSON parsing fails
            found_indices = []
            for i, opt in enumerate(request.options):
                letter = chr(65 + i)
                if f"{letter}." in response_text or f"{letter}:" in response_text or f"answer is {letter}" in response_text.lower():
                    found_indices.append(i)
            
            if found_indices:
                return SolveQuizResponse(
                    success=True,
                    correct_answer_indices=found_indices[:num_answers],
                    correct_answer_texts=[request.options[i].text for i in found_indices[:num_answers]],
                    explanation="Extracted from LLM response"
                )
            
            # Default to first option(s) if we can't parse
            default_indices = list(range(min(num_answers, len(request.options))))
            return SolveQuizResponse(
                success=True,
                correct_answer_indices=default_indices,
                correct_answer_texts=[request.options[i].text for i in default_indices],
                explanation="Could not parse LLM response, using default"
            )
            
    except Exception as e:
        logger.error(f"Quiz solving error: {str(e)}")
        return SolveQuizResponse(
            success=False,
            error=str(e)
        )


# LMS Automation Endpoints
@api_router.post("/lms/courses")
async def get_courses(credentials: Credentials):
    """Fetch list of courses from LMS"""
    try:
        # Run with timeout
        result = await asyncio.wait_for(
            automation_manager.get_courses(credentials.email, credentials.password),
            timeout=60  # 60 second timeout
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to fetch courses"))
        
        return result
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Request timeout - login took too long. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@api_router.post("/lms/start")
async def start_automation(request: StartAutomationRequest):
    """Start automation for a course"""
    session_id = str(uuid.uuid4())
    
    result = await automation_manager.start_automation(
        session_id=session_id,
        email=request.email,
        password=request.password,
        course_title=request.course_title
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to start automation"))
    
    return {
        "success": True,
        "session_id": session_id,
        "message": "Automation started successfully"
    }

@api_router.post("/lms/stop/{session_id}")
async def stop_automation(session_id: str):
    """Stop automation for a session"""
    result = await automation_manager.stop_automation(session_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to stop automation"))
    
    return {"success": True, "message": "Automation stopped"}

@api_router.get("/lms/status/{session_id}")
async def get_automation_status(session_id: str):
    """Get status of automation session"""
    status = automation_manager.get_status(session_id)
    return status

@api_router.get("/lms/logs/{session_id}")
async def get_logs(session_id: str, limit: int = 100):
    """Get logs for a session"""
    logs = automation_manager.get_logs(session_id, limit)
    return {"logs": logs}

@api_router.get("/lms/logs/stream/{session_id}")
async def stream_logs(session_id: str):
    """Stream logs in real-time using Server-Sent Events"""
    async def event_generator():
        last_log_count = 0
        
        while True:
            logs = automation_manager.get_logs(session_id, limit=500)
            
            # Send only new logs
            if len(logs) > last_log_count:
                new_logs = logs[last_log_count:]
                for log in new_logs:
                    yield f"data: {json.dumps(log)}\n\n"
                last_log_count = len(logs)
            
            # Check if session is complete
            status = automation_manager.get_status(session_id)
            if status.get("status") in ["completed", "failed", "stopped"]:
                yield f"data: {json.dumps({'type': 'complete', 'status': status})}\n\n"
                break
            
            await asyncio.sleep(1)
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()