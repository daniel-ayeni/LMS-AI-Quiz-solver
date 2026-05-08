from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
from openai import OpenAI

app = FastAPI(title="LMS Quiz Solver API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI client
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
client = None
if OPENAI_API_KEY:
    client = OpenAI(api_key=OPENAI_API_KEY)


class QuizOption(BaseModel):
    text: str
    index: int


class SolveQuizRequest(BaseModel):
    question: str
    options: List[QuizOption]
    num_answers: Optional[int] = 1


class SolveQuizResponse(BaseModel):
    success: bool
    correct_answer_indices: Optional[List[int]] = None
    correct_answer_texts: Optional[List[str]] = None
    explanation: Optional[str] = None
    error: Optional[str] = None


@app.get("/")
async def root():
    return {"status": "ok", "message": "LMS Quiz Solver API is running"}


@app.get("/api/")
async def api_root():
    return {"status": "ok"}


@app.post("/api/solve-quiz", response_model=SolveQuizResponse)
async def solve_quiz(request: SolveQuizRequest):
    """Use AI to solve quiz questions"""
    try:
        if not client:
            return SolveQuizResponse(
                success=False,
                error="OPENAI_API_KEY not configured"
            )

        # Format options
        options_text = "\n".join([
            f"{chr(65 + opt.index)}. {opt.text}" 
            for opt in request.options
        ])
        num_answers = request.num_answers or 1

        # Create prompt
        if num_answers > 1:
            prompt = f"""You are an expert at workplace training and compliance quizzes.

Question: {request.question}

Options:
{options_text}

IMPORTANT: Select exactly {num_answers} correct answers.

Respond with JSON only (no markdown):
{{"answer_indices": [list of {num_answers} 0-based indices], "explanation": "brief reason"}}"""
        else:
            prompt = f"""You are an expert at workplace training and compliance quizzes.

Question: {request.question}

Options:
{options_text}

Select the single best answer.

Respond with JSON only (no markdown):
{{"answer_indices": [single 0-based index], "explanation": "brief reason"}}"""

        # Call OpenAI
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system", 
                    "content": "You answer workplace training quizzes accurately. Always respond with valid JSON only, no markdown."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=500
        )

        result_text = response.choices[0].message.content.strip()
        
        # Clean markdown if present
        if result_text.startswith("```"):
            lines = result_text.split("```")
            if len(lines) > 1:
                result_text = lines[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()

        # Parse JSON
        result = json.loads(result_text)
        indices = result.get("answer_indices", [0])
        
        # Ensure list
        if not isinstance(indices, list):
            indices = [indices]
        
        # Validate and limit indices
        valid_indices = [
            i for i in indices 
            if isinstance(i, int) and 0 <= i < len(request.options)
        ][:num_answers]
        
        if not valid_indices:
            valid_indices = [0]

        return SolveQuizResponse(
            success=True,
            correct_answer_indices=valid_indices,
            correct_answer_texts=[request.options[i].text for i in valid_indices],
            explanation=result.get("explanation", "")
        )

    except json.JSONDecodeError:
        # Try to extract answer from text
        return SolveQuizResponse(
            success=True,
            correct_answer_indices=[0],
            correct_answer_texts=[request.options[0].text],
            explanation="Could not parse response"
        )
    except Exception as e:
        return SolveQuizResponse(
            success=False,
            error=str(e)
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
