"""
AI Classifier Service
Provides AI-powered classification, embedding generation, and semantic analysis
"""

import os
import logging
from typing import List, Dict, Optional
from enum import Enum

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import psycopg2
from psycopg2.extras import RealDictCursor
import redis
from dotenv import load_dotenv

# AI/ML imports
try:
    import openai
    from sentence_transformers import SentenceTransformer
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logging.warning("OpenAI not available, using fallback embeddings")

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="AI Classifier Service",
    description="AI-powered classification and embedding service for Rationalization Platform",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# MODELS
# =============================================================================

class ApplicationType(str, Enum):
    SERVICE = "service"
    LIBRARY = "library"
    PLUGIN = "plugin"
    APPLICATION = "application"
    API = "api"
    FRAMEWORK = "framework"
    TOOL = "tool"


class ClassifyRequest(BaseModel):
    name: str
    description: Optional[str] = None
    readme: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class ClassifyResponse(BaseModel):
    type: ApplicationType
    capabilities: List[str]
    confidence: float
    suggested_tags: List[str]


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    dimensions: int


class SemanticSearchRequest(BaseModel):
    query: str
    limit: int = 10
    threshold: float = 0.7


# =============================================================================
# DATABASE
# =============================================================================

class Database:
    def __init__(self):
        self.pg_conn = None
        self.redis_client = None
        self.connect()

    def connect(self):
        """Connect to databases"""
        try:
            # PostgreSQL
            self.pg_conn = psycopg2.connect(
                host=os.getenv('POSTGRES_HOST', 'localhost'),
                port=os.getenv('POSTGRES_PORT', '5432'),
                database=os.getenv('POSTGRES_DB', 'rationalization'),
                user=os.getenv('POSTGRES_USER', 'admin'),
                password=os.getenv('POSTGRES_PASSWORD'),
                cursor_factory=RealDictCursor
            )
            logger.info("PostgreSQL connected")

            # Redis
            self.redis_client = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', '6379')),
                password=os.getenv('REDIS_PASSWORD'),
                decode_responses=True
            )
            logger.info("Redis connected")

        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def close(self):
        """Close database connections"""
        if self.pg_conn:
            self.pg_conn.close()
        if self.redis_client:
            self.redis_client.close()


# Initialize database
db = Database()

# =============================================================================
# AI CLASSIFIER
# =============================================================================

class AIClassifier:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')

        if self.openai_api_key and OPENAI_AVAILABLE:
            openai.api_key = self.openai_api_key
            self.use_openai = True
            logger.info("Using OpenAI for classification")
        else:
            # Fallback to local model
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            self.use_openai = False
            logger.info("Using local model for classification")

    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for text"""
        try:
            if self.use_openai:
                # Use OpenAI ada-002 embeddings
                response = openai.embeddings.create(
                    model="text-embedding-ada-002",
                    input=text
                )
                return response.data[0].embedding
            else:
                # Use local model
                embedding = self.model.encode(text)
                return embedding.tolist()

        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise

    def classify_application(
        self,
        name: str,
        description: Optional[str] = None,
        readme: Optional[str] = None,
        tags: List[str] = []
    ) -> Dict:
        """Classify application using AI"""
        try:
            # Combine text for analysis
            text_parts = [name]
            if description:
                text_parts.append(description)
            if readme:
                text_parts.append(readme[:500])  # First 500 chars
            if tags:
                text_parts.append(" ".join(tags))

            combined_text = " ".join(text_parts)

            if self.use_openai:
                return self._classify_with_openai(combined_text, tags)
            else:
                return self._classify_with_rules(name, description, tags)

        except Exception as e:
            logger.error(f"Classification failed: {e}")
            return {
                'type': 'application',
                'capabilities': [],
                'confidence': 0.5,
                'suggested_tags': tags
            }

    def _classify_with_openai(self, text: str, existing_tags: List[str]) -> Dict:
        """Classify using OpenAI GPT"""
        prompt = f"""
        Analyze this software project and provide:
        1. Type (one of: service, library, plugin, application, api, framework, tool)
        2. Key capabilities it provides (list of 3-5 items)
        3. Confidence score (0-1)
        4. Suggested tags (5-10 relevant tags)

        Project description:
        {text}

        Existing tags: {', '.join(existing_tags)}

        Respond in JSON format:
        {{
            "type": "...",
            "capabilities": [...],
            "confidence": 0.95,
            "suggested_tags": [...]
        }}
        """

        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a software classification expert."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
        )

        import json
        result = json.loads(response.choices[0].message.content)
        return result

    def _classify_with_rules(
        self,
        name: str,
        description: Optional[str],
        tags: List[str]
    ) -> Dict:
        """Classify using rule-based heuristics"""
        text = f"{name} {description or ''}".lower()

        # Determine type
        app_type = 'application'
        if any(word in text for word in ['api', 'rest', 'graphql']):
            app_type = 'api'
        elif any(word in text for word in ['library', 'package', 'module']):
            app_type = 'library'
        elif any(word in text for word in ['framework']):
            app_type = 'framework'
        elif any(word in text for word in ['plugin', 'extension', 'addon']):
            app_type = 'plugin'
        elif any(word in text for word in ['service', 'platform', 'saas']):
            app_type = 'service'
        elif any(word in text for word in ['cli', 'tool', 'utility']):
            app_type = 'tool'

        # Extract capabilities (simple keyword matching)
        capabilities = []
        capability_keywords = {
            'authentication': ['auth', 'login', 'oauth', 'jwt'],
            'payment': ['payment', 'stripe', 'billing'],
            'database': ['database', 'sql', 'nosql', 'postgres', 'mongo'],
            'api': ['api', 'rest', 'graphql'],
            'ui': ['ui', 'frontend', 'react', 'vue', 'angular'],
            'analytics': ['analytics', 'tracking', 'metrics'],
        }

        for capability, keywords in capability_keywords.items():
            if any(keyword in text for keyword in keywords):
                capabilities.append(capability)

        return {
            'type': app_type,
            'capabilities': capabilities,
            'confidence': 0.7,
            'suggested_tags': tags + [app_type]
        }


# Initialize classifier
classifier = AIClassifier()

# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "AI Classifier",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "openai_available": classifier.use_openai,
        "database": "connected"
    }

@app.post("/classify", response_model=ClassifyResponse)
async def classify_application(request: ClassifyRequest):
    """
    Classify an application and extract capabilities
    """
    try:
        result = classifier.classify_application(
            name=request.name,
            description=request.description,
            readme=request.readme,
            tags=request.tags
        )

        return ClassifyResponse(**result)

    except Exception as e:
        logger.error(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embedding", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    """
    Generate embedding vector for text
    """
    try:
        embedding = classifier.generate_embedding(request.text)

        return EmbeddingResponse(
            embedding=embedding,
            dimensions=len(embedding)
        )

    except Exception as e:
        logger.error(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/semantic-search")
async def semantic_search(request: SemanticSearchRequest):
    """
    Perform semantic search using embeddings
    """
    try:
        # Generate query embedding
        query_embedding = classifier.generate_embedding(request.query)

        # Search in database using vector similarity
        cursor = db.pg_conn.cursor()

        # Convert Python list to PostgreSQL array format
        embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'

        cursor.execute("""
            SELECT
                id, name, description,
                1 - (embedding <=> %s::vector) as similarity
            FROM applications
            WHERE embedding IS NOT NULL
                AND 1 - (embedding <=> %s::vector) > %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (embedding_str, embedding_str, request.threshold, embedding_str, request.limit))

        results = cursor.fetchall()
        cursor.close()

        return {
            "query": request.query,
            "results": results,
            "count": len(results)
        }

    except Exception as e:
        logger.error(f"Semantic search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-classify")
async def batch_classify(background_tasks: BackgroundTasks):
    """
    Classify all unclassified applications in background
    """
    try:
        cursor = db.pg_conn.cursor()

        # Get applications without embeddings
        cursor.execute("""
            SELECT id, name, description, tags
            FROM applications
            WHERE embedding IS NULL
            LIMIT 100
        """)

        applications = cursor.fetchall()
        cursor.close()

        # Add background task
        background_tasks.add_task(process_batch, applications)

        return {
            "message": f"Started batch classification for {len(applications)} applications",
            "count": len(applications)
        }

    except Exception as e:
        logger.error(f"Batch classify error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_batch(applications: List[Dict]):
    """Process batch classification in background"""
    logger.info(f"Processing batch of {len(applications)} applications")

    cursor = db.pg_conn.cursor()

    for app in applications:
        try:
            # Generate embedding
            text = f"{app['name']} {app['description'] or ''}"
            embedding = classifier.generate_embedding(text)

            # Classify
            classification = classifier.classify_application(
                name=app['name'],
                description=app['description'],
                tags=app['tags'] or []
            )

            # Convert embedding list to PostgreSQL array format
            embedding_str = '[' + ','.join(map(str, embedding)) + ']'

            # Update database
            cursor.execute("""
                UPDATE applications
                SET
                    embedding = %s::vector,
                    type = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (embedding_str, classification['type'], app['id']))

            # Add capabilities
            for capability_name in classification['capabilities']:
                # Find or create capability
                cursor.execute("""
                    INSERT INTO capabilities (name, slug, category)
                    VALUES (%s, %s, 'auto-detected')
                    ON CONFLICT (slug) DO NOTHING
                    RETURNING id
                """, (capability_name, capability_name.lower().replace(' ', '-')))

                result = cursor.fetchone()
                if result:
                    capability_id = result['id']

                    # Link to application
                    cursor.execute("""
                        INSERT INTO application_capabilities (application_id, capability_id, confidence)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (application_id, capability_id) DO NOTHING
                    """, (app['id'], capability_id, classification['confidence']))

            db.pg_conn.commit()
            logger.debug(f"Processed application: {app['name']}")

        except Exception as e:
            logger.error(f"Error processing {app['name']}: {e}")
            db.pg_conn.rollback()
            continue

    cursor.close()
    logger.info("Batch processing completed")


# =============================================================================
# STARTUP/SHUTDOWN
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    logger.info("AI Classifier Service starting...")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("AI Classifier Service shutting down...")
    db.close()


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8001")),
        reload=True,
        log_level="info"
    )
