from agno.db.postgres.postgres import PostgresDb
from agno.vectordb.pgvector.pgvector import PgVector

from app.config import settings

db_url = settings.SYNC_DATABASE_URL.replace("postgresql://", "postgresql+psycopg://")


def get_agent_storage() -> PostgresDb:
    """
    Returns a configured PostgresDb instance for agent session storage.
    """
    return PostgresDb(
        db_url=db_url,
        session_table="agent_sessions",
    )


def get_vector_db(collection_name: str = "knowledge_base") -> PgVector:
    """
    Returns a configured PgVector instance for the agent's knowledge base.
    """
    return PgVector(
        table_name=collection_name,
        db_url=db_url,
    )
