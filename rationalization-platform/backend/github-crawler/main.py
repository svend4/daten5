"""
GitHub Crawler
Automatically discovers and analyzes GitHub repositories
"""

import os
import time
import logging
from datetime import datetime
from typing import List, Dict, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from github import Github, GithubException
from neo4j import GraphDatabase
import redis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GitHubCrawler:
    """
    GitHub repository crawler and analyzer
    """

    def __init__(self):
        # Initialize GitHub API
        self.github_token = os.getenv('GITHUB_TOKEN')
        if not self.github_token:
            raise ValueError("GITHUB_TOKEN environment variable is required")

        self.gh = Github(self.github_token, per_page=100)

        # Initialize database connections
        self.init_databases()

        # Rate limiting
        self.request_count = 0
        self.max_requests_per_hour = 5000  # GitHub API limit

        logger.info("GitHub Crawler initialized")

    def init_databases(self):
        """Initialize PostgreSQL, Neo4j, and Redis connections"""

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

        # Neo4j
        neo4j_uri = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
        neo4j_user = os.getenv('NEO4J_USER', 'neo4j')
        neo4j_password = os.getenv('NEO4J_PASSWORD')

        self.neo4j_driver = GraphDatabase.driver(
            neo4j_uri,
            auth=(neo4j_user, neo4j_password)
        )
        logger.info("Neo4j connected")

        # Redis
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', '6379')),
            password=os.getenv('REDIS_PASSWORD'),
            decode_responses=True
        )
        logger.info("Redis connected")

    def check_rate_limit(self):
        """Check GitHub API rate limit"""
        rate_limit = self.gh.get_rate_limit()
        core_limit = rate_limit.core

        logger.info(f"GitHub API Rate Limit: {core_limit.remaining}/{core_limit.limit}")

        if core_limit.remaining < 100:
            reset_time = core_limit.reset
            wait_seconds = (reset_time - datetime.now()).total_seconds()
            logger.warning(f"Rate limit low, waiting {wait_seconds}s until reset")
            time.sleep(max(wait_seconds, 0))

    def repository_exists(self, repo_url: str) -> bool:
        """Check if repository already exists in database"""
        cursor = self.pg_conn.cursor()
        cursor.execute(
            "SELECT id FROM applications WHERE source_url = %s",
            (repo_url,)
        )
        result = cursor.fetchone()
        cursor.close()
        return result is not None

    def extract_repo_info(self, repo) -> Dict:
        """Extract relevant information from GitHub repository"""
        try:
            # Get language statistics
            languages = repo.get_languages()
            primary_language = max(languages.items(), key=lambda x: x[1])[0] if languages else None

            # Get topics (tags)
            topics = repo.get_topics()

            # Get README
            readme_content = None
            try:
                readme = repo.get_readme()
                readme_content = readme.decoded_content.decode('utf-8')[:1000]  # First 1000 chars
            except:
                pass

            # Extract dependencies (from package.json, requirements.txt, etc.)
            dependencies = self.extract_dependencies(repo)

            info = {
                'name': repo.name,
                'full_name': repo.full_name,
                'description': repo.description,
                'url': repo.html_url,
                'homepage': repo.homepage,
                'language': primary_language,
                'languages': list(languages.keys()),
                'stars': repo.stargazers_count,
                'forks': repo.forks_count,
                'open_issues': repo.open_issues_count,
                'watchers': repo.watchers_count,
                'topics': topics,
                'license': repo.license.spdx_id if repo.license else None,
                'created_at': repo.created_at,
                'updated_at': repo.updated_at,
                'pushed_at': repo.pushed_at,
                'size': repo.size,
                'default_branch': repo.default_branch,
                'is_fork': repo.fork,
                'is_archived': repo.archived,
                'owner': repo.owner.login,
                'owner_type': repo.owner.type,
                'readme': readme_content,
                'dependencies': dependencies,
            }

            return info

        except GithubException as e:
            logger.error(f"Error extracting repo info: {e}")
            return None

    def extract_dependencies(self, repo) -> List[str]:
        """Extract dependencies from repository files"""
        dependencies = []

        try:
            # Try package.json (Node.js)
            try:
                package_json = repo.get_contents("package.json")
                import json
                data = json.loads(package_json.decoded_content)
                if 'dependencies' in data:
                    dependencies.extend(data['dependencies'].keys())
            except:
                pass

            # Try requirements.txt (Python)
            try:
                requirements = repo.get_contents("requirements.txt")
                lines = requirements.decoded_content.decode('utf-8').split('\n')
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        # Extract package name (before ==, >=, etc.)
                        pkg_name = line.split('==')[0].split('>=')[0].split('<=')[0].strip()
                        dependencies.append(pkg_name)
            except:
                pass

            # Try go.mod (Go)
            try:
                go_mod = repo.get_contents("go.mod")
                lines = go_mod.decoded_content.decode('utf-8').split('\n')
                for line in lines:
                    line = line.strip()
                    if line.startswith('require'):
                        parts = line.split()
                        if len(parts) >= 2:
                            dependencies.append(parts[1])
            except:
                pass

        except Exception as e:
            logger.debug(f"Error extracting dependencies: {e}")

        return dependencies

    def save_to_database(self, repo_info: Dict) -> Optional[str]:
        """Save repository information to PostgreSQL"""
        try:
            cursor = self.pg_conn.cursor()

            # Generate slug
            slug = repo_info['full_name'].lower().replace('/', '-')

            # Insert application
            cursor.execute("""
                INSERT INTO applications (
                    name, slug, description, type, source, source_url,
                    homepage_url, repository_url, license,
                    author, tags, version,
                    stars, downloads, forks, issues_count,
                    last_updated_at, last_commit_at
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (slug) DO UPDATE SET
                    description = EXCLUDED.description,
                    stars = EXCLUDED.stars,
                    forks = EXCLUDED.forks,
                    issues_count = EXCLUDED.issues_count,
                    last_updated_at = EXCLUDED.last_updated_at,
                    last_commit_at = EXCLUDED.last_commit_at,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            """, (
                repo_info['name'],
                slug,
                repo_info['description'],
                'library',  # Default type
                'github',
                repo_info['url'],
                repo_info['homepage'],
                repo_info['url'],
                repo_info['license'],
                repo_info['owner'],
                repo_info['topics'],
                None,  # version
                repo_info['stars'],
                0,  # downloads (not available from GitHub)
                repo_info['forks'],
                repo_info['open_issues'],
                repo_info['updated_at'],
                repo_info['pushed_at'],
            ))

            result = cursor.fetchone()
            app_id = result['id'] if result else None

            self.pg_conn.commit()
            cursor.close()

            logger.info(f"Saved repository: {repo_info['full_name']} (ID: {app_id})")

            return app_id

        except Exception as e:
            logger.error(f"Error saving to database: {e}")
            self.pg_conn.rollback()
            return None

    def save_to_neo4j(self, repo_info: Dict, app_id: str):
        """Save repository graph relationships to Neo4j"""
        try:
            with self.neo4j_driver.session() as session:
                # Create Application node
                session.run("""
                    MERGE (a:Application {id: $app_id})
                    SET a.name = $name,
                        a.type = 'library',
                        a.source = 'github',
                        a.stars = $stars,
                        a.language = $language
                """, {
                    'app_id': app_id,
                    'name': repo_info['name'],
                    'stars': repo_info['stars'],
                    'language': repo_info['language'],
                })

                # Create Technology nodes and relationships
                for lang in repo_info['languages']:
                    session.run("""
                        MERGE (t:Technology {name: $language})
                        WITH t
                        MATCH (a:Application {id: $app_id})
                        MERGE (a)-[:BUILT_WITH]->(t)
                    """, {
                        'language': lang,
                        'app_id': app_id,
                    })

                logger.debug(f"Saved to Neo4j: {repo_info['full_name']}")

        except Exception as e:
            logger.error(f"Error saving to Neo4j: {e}")

    def crawl_popular_repositories(self, language: Optional[str] = None, limit: int = 100):
        """Crawl popular repositories from GitHub"""
        logger.info(f"Starting crawl for {language or 'all'} repositories (limit: {limit})")

        # Start crawler run tracking
        cursor = self.pg_conn.cursor()
        cursor.execute("""
            INSERT INTO crawler_runs (source, status, started_at)
            VALUES ('github', 'running', CURRENT_TIMESTAMP)
            RETURNING id
        """)
        run_id = cursor.fetchone()['id']
        self.pg_conn.commit()
        cursor.close()

        processed = 0
        updated = 0
        failed = 0

        try:
            # Build search query
            query = "stars:>1000"
            if language:
                query += f" language:{language}"

            # Search repositories
            repositories = self.gh.search_repositories(
                query=query,
                sort="stars",
                order="desc"
            )

            for repo in repositories[:limit]:
                try:
                    self.check_rate_limit()

                    # Check if already exists
                    if self.repository_exists(repo.html_url):
                        logger.debug(f"Repository already exists: {repo.full_name}")
                        continue

                    # Extract information
                    repo_info = self.extract_repo_info(repo)
                    if not repo_info:
                        failed += 1
                        continue

                    # Save to databases
                    app_id = self.save_to_database(repo_info)
                    if app_id:
                        self.save_to_neo4j(repo_info, app_id)
                        processed += 1

                        # Cache in Redis
                        self.redis_client.setex(
                            f"repo:{repo.full_name}",
                            3600,  # 1 hour
                            app_id
                        )

                    time.sleep(0.5)  # Be nice to the API

                except Exception as e:
                    logger.error(f"Error processing repository {repo.full_name}: {e}")
                    failed += 1
                    continue

        except Exception as e:
            logger.error(f"Crawler error: {e}")

        finally:
            # Update crawler run status
            cursor = self.pg_conn.cursor()
            cursor.execute("""
                UPDATE crawler_runs
                SET status = 'completed',
                    completed_at = CURRENT_TIMESTAMP,
                    items_processed = %s,
                    items_updated = %s,
                    items_failed = %s,
                    duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))
                WHERE id = %s
            """, (processed, updated, failed, run_id))
            self.pg_conn.commit()
            cursor.close()

            logger.info(f"Crawl completed: {processed} processed, {failed} failed")

    def close(self):
        """Close all connections"""
        if self.pg_conn:
            self.pg_conn.close()
        if self.neo4j_driver:
            self.neo4j_driver.close()
        if self.redis_client:
            self.redis_client.close()

        logger.info("Crawler connections closed")


def main():
    """Main entry point"""
    crawler = GitHubCrawler()

    try:
        # Crawl popular JavaScript repositories
        crawler.crawl_popular_repositories(language="JavaScript", limit=50)

        # Crawl popular Python repositories
        crawler.crawl_popular_repositories(language="Python", limit=50)

        # Crawl popular TypeScript repositories
        crawler.crawl_popular_repositories(language="TypeScript", limit=50)

        # Crawl popular Go repositories
        crawler.crawl_popular_repositories(language="Go", limit=50)

    finally:
        crawler.close()


if __name__ == "__main__":
    main()
