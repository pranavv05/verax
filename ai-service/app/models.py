from typing import Any
from typing import Optional

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import constr


DocType = constr(pattern=r"^(invoice|bank_statement|bill|other)$")


class ProcessRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    s3_key: str = Field(min_length=1)
    doc_type: DocType
    document_id: str = Field(min_length=1)
    firm_id: Optional[str] = None


class ProcessResponse(BaseModel):
    document_id: str
    structured_data: dict[str, Any]
    confidence_score: float
    raw_text: Optional[str] = None
    ocr_engine: Optional[str] = None
