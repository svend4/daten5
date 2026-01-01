"""
Natural Language Interface
AI-powered chat interface for the Rationalization Platform
"""

import os
import json
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis
import httpx
from dotenv import load_dotenv

try:
    import openai
    OPENAI_AVAILABLE = True
except:
    OPENAI_AVAILABLE = False

load_dotenv()

app = FastAPI(
    title="Natural Language Interface",
    description="AI-powered chat for Rationalization Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# CONFIGURATION
# ============================================================================

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
CATALOG_API_URL = os.getenv('CATALOG_API_URL', 'http://catalog-api:3000')
AI_CLASSIFIER_URL = os.getenv('AI_CLASSIFIER_URL', 'http://ai-classifier:8001')

if OPENAI_API_KEY and OPENAI_AVAILABLE:
    openai.api_key = OPENAI_API_KEY

# Redis for conversation history
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', '6379')),
    password=os.getenv('REDIS_PASSWORD'),
    decode_responses=True
)

# ============================================================================
# MODELS
# ============================================================================

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    context: Optional[Dict] = None

class ChatResponse(BaseModel):
    response: str
    actions: Optional[List[Dict]] = None
    suggestions: Optional[List[str]] = None
    sessionId: str

# ============================================================================
# AI ASSISTANT
# ============================================================================

class NLAssistant:
    def __init__(self):
        self.system_prompt = """You are an AI assistant for the Rationalization Platform, a B2B operating system for discovering and integrating digital solutions.

Your capabilities:
1. Help users find applications, libraries, and services
2. Recommend blueprints (pre-configured solutions)
3. Answer questions about applications and their capabilities
4. Suggest alternatives and compatible solutions
5. Guide users through integration processes

Available tools:
- search_applications(query) - Search for applications
- get_application(id) - Get application details
- find_alternatives(app_id) - Find alternative solutions
- get_blueprints(use_case) - Get blueprints for a use case
- recommend_stack(requirements) - Recommend technology stack

Respond in a helpful, conversational manner. When performing actions, explain what you're doing."""

    async def chat(self, message: str, history: List[Message], context: Dict = None) -> Dict:
        """Process chat message and generate response"""

        # Build conversation
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend([{"role": m.role, "content": m.content} for m in history])
        messages.append({"role": "user", "content": message})

        try:
            # Call OpenAI
            if OPENAI_AVAILABLE and OPENAI_API_KEY:
                response = await self._call_openai(messages)
            else:
                response = await self._fallback_response(message)

            # Extract actions if any
            actions = self._extract_actions(response)

            # Execute actions
            if actions:
                action_results = await self._execute_actions(actions)
                response += "\n\n" + self._format_results(action_results)

            # Generate suggestions
            suggestions = self._generate_suggestions(message, response)

            return {
                "response": response,
                "actions": actions,
                "suggestions": suggestions,
            }

        except Exception as e:
            print(f"Chat error: {e}")
            return {
                "response": "I apologize, but I encountered an error processing your request. Please try again.",
                "actions": None,
                "suggestions": ["Try rephrasing your question", "Ask about available features"],
            }

    async def _call_openai(self, messages: List[Dict]) -> str:
        """Call OpenAI API"""
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.7,
            max_tokens=500,
        )
        return response.choices[0].message.content

    async def _fallback_response(self, message: str) -> str:
        """Fallback response when OpenAI is not available"""
        message_lower = message.lower()

        if any(word in message_lower for word in ['search', 'find', 'looking for']):
            return "I can help you search for applications. What type of solution are you looking for?"

        if any(word in message_lower for word in ['recommend', 'suggest', 'what should']):
            return "I can recommend solutions based on your needs. What problem are you trying to solve?"

        if 'blueprint' in message_lower:
            return "Blueprints are pre-configured solution templates. What use case are you interested in?"

        return "I can help you discover and integrate digital solutions. Try asking me to search for applications, recommend blueprints, or find alternatives."

    def _extract_actions(self, response: str) -> Optional[List[Dict]]:
        """Extract structured actions from AI response"""
        # Simple pattern matching for actions
        # In production, use function calling or structured outputs

        actions = []

        if "search_applications" in response:
            actions.append({"type": "search", "function": "search_applications"})

        if "get_application" in response:
            actions.append({"type": "get", "function": "get_application"})

        return actions if actions else None

    async def _execute_actions(self, actions: List[Dict]) -> List[Dict]:
        """Execute extracted actions"""
        results = []

        for action in actions:
            try:
                if action["type"] == "search":
                    result = await self._search_applications("react")
                    results.append({"action": action, "result": result})

            except Exception as e:
                results.append({"action": action, "error": str(e)})

        return results

    async def _search_applications(self, query: str) -> Dict:
        """Search applications via Catalog API"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{CATALOG_API_URL}/api/search",
                params={"q": query, "limit": 5}
            )
            return response.json()

    def _format_results(self, results: List[Dict]) -> str:
        """Format action results for display"""
        if not results:
            return ""

        formatted = "\n\nHere's what I found:\n"

        for result in results:
            if "result" in result and "applications" in result["result"]:
                apps = result["result"]["applications"]
                for app in apps[:3]:
                    formatted += f"\n- **{app['name']}**: {app.get('description', 'No description')}"

        return formatted

    def _generate_suggestions(self, message: str, response: str) -> List[str]:
        """Generate conversation suggestions"""
        suggestions = [
            "Search for applications",
            "Get blueprint recommendations",
            "Find alternatives to a solution",
        ]

        return suggestions[:3]


assistant = NLAssistant()

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    return {
        "service": "Natural Language Interface",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "openai_available": OPENAI_AVAILABLE and bool(OPENAI_API_KEY)
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process chat message"""

    session_id = request.sessionId or f"session_{os.urandom(8).hex()}"

    # Get conversation history
    history_key = f"chat:{session_id}"
    history_json = redis_client.get(history_key) or "[]"
    history = [Message(**m) for m in json.loads(history_json)]

    # Process message
    result = await assistant.chat(
        message=request.message,
        history=history,
        context=request.context
    )

    # Update history
    history.append(Message(role="user", content=request.message))
    history.append(Message(role="assistant", content=result["response"]))

    # Keep last 20 messages
    history = history[-20:]

    # Save to Redis (1 hour TTL)
    redis_client.setex(
        history_key,
        3600,
        json.dumps([m.dict() for m in history])
    )

    return ChatResponse(
        response=result["response"],
        actions=result.get("actions"),
        suggestions=result.get("suggestions"),
        sessionId=session_id
    )

@app.delete("/chat/{session_id}")
async def clear_chat(session_id: str):
    """Clear chat history"""
    redis_client.delete(f"chat:{session_id}")
    return {"cleared": True}

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
