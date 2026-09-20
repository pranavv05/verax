import pytest

from app.utils.json_parser import parse_json_object


def test_parses_clean_json():
    assert parse_json_object('{"a": 1, "b": "two"}') == {"a": 1, "b": "two"}


def test_parses_json_wrapped_in_markdown_fence():
    raw = '```json\n{"a": 1}\n```'
    assert parse_json_object(raw) == {"a": 1}


def test_parses_json_wrapped_in_bare_fence():
    raw = "```\n{\"a\": 1}\n```"
    assert parse_json_object(raw) == {"a": 1}


def test_extracts_json_object_from_surrounding_prose():
    raw = 'Here is the extracted data:\n{"a": 1}\nLet me know if you need anything else.'
    assert parse_json_object(raw) == {"a": 1}


def test_raises_on_truncated_json():
    # Simulates a Groq response that got cut off mid-object because it hit
    # max_tokens — the exact failure mode llm_service.extract_structured_data
    # must catch and degrade gracefully instead of letting propagate.
    with pytest.raises((ValueError, Exception)):
        parse_json_object('{"a": 1, "b": "unterminated')


def test_raises_when_response_is_a_json_array_not_object():
    with pytest.raises(ValueError):
        parse_json_object("[1, 2, 3]")


def test_raises_on_empty_string():
    with pytest.raises(Exception):
        parse_json_object("")


def test_raises_on_non_json_prose():
    with pytest.raises(Exception):
        parse_json_object("I'm sorry, I could not extract any data from this document.")
