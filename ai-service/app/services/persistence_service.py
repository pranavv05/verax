from __future__ import annotations

import json
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings


class PersistenceService:
    def __init__(self) -> None:
        self._database_url = settings.app_database_url

    def _connect(self):
        return psycopg2.connect(self._database_url)

    @staticmethod
    def _set_tenant_context(cursor, firm_id: str) -> None:
        cursor.execute("SELECT set_config(%s, %s, true)", ("app.current_firm_id", firm_id))

    def persist_extraction(
        self,
        *,
        firm_id: str,
        document_id: str,
        raw_text: str,
        structured_data: dict[str, Any],
        confidence_score: float
    ) -> None:
        with self._connect() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                self._set_tenant_context(cursor, firm_id)

                cursor.execute(
                    """
                    INSERT INTO extractions (
                        document_id,
                        raw_text,
                        structured_data,
                        confidence_score,
                        reviewed_by,
                        reviewed_at,
                        deleted_at
                    )
                    VALUES (%s, %s, %s::jsonb, %s, NULL, NULL, NULL)
                    ON CONFLICT (document_id)
                    DO UPDATE SET
                        raw_text = EXCLUDED.raw_text,
                        structured_data = EXCLUDED.structured_data,
                        confidence_score = EXCLUDED.confidence_score,
                        reviewed_by = NULL,
                        reviewed_at = NULL,
                        deleted_at = NULL
                    """,
                    (
                        document_id,
                        raw_text,
                        json.dumps(structured_data),
                        confidence_score
                    )
                )

                cursor.execute(
                    """
                    UPDATE documents
                    SET status = 'extracted',
                        processing_error = NULL
                    WHERE id = %s
                      AND firm_id = %s
                      AND deleted_at IS NULL
                    """,
                    (document_id, firm_id)
                )

                cursor.execute(
                    """
                    INSERT INTO audit_logs (
                        firm_id,
                        user_id,
                        action,
                        entity_type,
                        entity_id,
                        metadata
                    ) VALUES (%s, NULL, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        firm_id,
                        "ai_extraction_saved",
                        "document",
                        document_id,
                        json.dumps({"confidence_score": confidence_score})
                    )
                )
