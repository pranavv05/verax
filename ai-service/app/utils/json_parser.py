import json
import re
from typing import Any


JSON_FENCE_PATTERN = re.compile(r"```(?:json)?\s*(\{.*\})\s*```", re.DOTALL)
JSON_OBJECT_PATTERN = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json_candidate(text: str) -> str:
    fenced = JSON_FENCE_PATTERN.search(text)
    if fenced:
        return fenced.group(1).strip()

    bracketed = JSON_OBJECT_PATTERN.search(text)
    if bracketed:
        return bracketed.group(0).strip()

    return text.strip()


def parse_json_object(raw_text: str) -> dict[str, Any]:
    candidate = _extract_json_candidate(raw_text)
    parsed = json.loads(candidate)
    if not isinstance(parsed, dict):
        raise ValueError("Expected a JSON object in LLM response")
    return parsed
