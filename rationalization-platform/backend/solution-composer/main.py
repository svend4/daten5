"""
Solution Composer
Automatically compose solutions from requirements
"""

import os
import json
from typing import List, Dict
from fastapi import FastAPI
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

try:
    import openai
    OPENAI_AVAILABLE = True
except:
    OPENAI_AVAILABLE = False

load_dotenv()

app = FastAPI(title="Solution Composer", version="1.0.0")

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
CATALOG_API_URL = os.getenv('CATALOG_API_URL', 'http://catalog-api:3000')

if OPENAI_API_KEY and OPENAI_AVAILABLE:
    openai.api_key = OPENAI_API_KEY

class ComposeRequest(BaseModel):
    requirements: str
    constraints: Dict = {}

class Component(BaseModel):
    name: str
    purpose: str
    capabilities: List[str]

class ComposedSolution(BaseModel):
    components: List[Component]
    workflow: Dict
    estimatedCost: float
    code: str

@app.post("/compose", response_model=ComposedSolution)
async def compose_solution(request: ComposeRequest):
    """Compose a solution from requirements"""

    # 1. Analyze requirements
    capabilities = await analyze_requirements(request.requirements)

    # 2. Find applications
    components = await find_components(capabilities)

    # 3. Generate workflow
    workflow = generate_workflow(components)

    # 4. Generate integration code
    code = generate_code(components, workflow)

    # 5. Estimate cost
    cost = estimate_cost(components)

    return ComposedSolution(
        components=[Component(**c) for c in components],
        workflow=workflow,
        estimatedCost=cost,
        code=code
    )

async def analyze_requirements(requirements: str) -> List[str]:
    """Extract required capabilities from requirements"""

    if OPENAI_AVAILABLE and OPENAI_API_KEY:
        prompt = f"""Analyze these requirements and extract needed capabilities:

Requirements: {requirements}

Return a JSON list of capability names needed, such as:
["authentication", "database", "payment", "email"]"""

        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )

        content = response.choices[0].message.content
        try:
            return json.loads(content)
        except:
            pass

    return ["authentication", "database", "api"]

async def find_components(capabilities: List[str]) -> List[Dict]:
    """Find applications that provide required capabilities"""

    components = []

    for cap in capabilities:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{CATALOG_API_URL}/api/search",
                    params={"q": cap, "limit": 1}
                )
                data = response.json()

                if data.get("applications"):
                    app = data["applications"][0]
                    components.append({
                        "name": app["name"],
                        "purpose": f"Provides {cap}",
                        "capabilities": [cap]
                    })
            except:
                components.append({
                    "name": f"{cap.capitalize()} Service",
                    "purpose": f"Provides {cap}",
                    "capabilities": [cap]
                })

    return components

def generate_workflow(components: List[Dict]) -> Dict:
    """Generate workflow steps"""

    steps = []

    for i, component in enumerate(components):
        steps.append({
            "name": f"setup_{component['name'].lower().replace(' ', '_')}",
            "type": "api_call",
            "config": {
                "method": "POST",
                "url": f"https://api.{component['name'].lower()}.com/setup",
                "body": {"config": "default"}
            }
        })

    return {"steps": steps}

def generate_code(components: List[Dict], workflow: Dict) -> str:
    """Generate integration code"""

    code = "# Auto-generated integration code\n\n"
    code += "import requests\n\n"

    for component in components:
        code += f"# Setup {component['name']}\n"
        code += f"{component['name'].lower()}_client = None  # Initialize client\n\n"

    code += "# Execute workflow\n"
    code += "def execute():\n"

    for step in workflow["steps"]:
        code += f"    # {step['name']}\n"
        code += f"    response = requests.post('{step['config']['url']}')\n"

    return code

def estimate_cost(components: List[Dict]) -> float:
    """Estimate monthly cost"""
    return len(components) * 50.0  # $50 per component

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
