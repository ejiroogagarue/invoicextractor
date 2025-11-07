"""Gemini-powered invoice extraction implementation."""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

import httpx


try:
    import fitz  # type: ignore
except ImportError as exc:  # pragma: no cover - surfaced at runtime
    raise RuntimeError("PyMuPDF (fitz) is required for Gemini OCR") from exc

try:
    from PIL import Image  # type: ignore
    import pytesseract  # type: ignore
except ImportError:
    Image = None  # type: ignore
    pytesseract = None  # type: ignore


GEMINI_ENDPOINT_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)


SYSTEM_PROMPT = """You are an expert financial document analyst. Extract EVERY data point from invoices with absolute precision."""


JSON_SCHEMA = """{
  "invoice_number": "string or null",
  "date": "string",
  "vendor": {
    "name": "string or null",
    "address": "string or null"
  },
  "customer": {
    "name": "string or null",
    "billing_address": "string or null"
  },
  "shipping_info": {
    "address": "string or null",
    "city": "string or null",
    "state": "string or null",
    "country": "string or null",
    "postal_code": "string or null",
    "ship_mode": "string or null"
  },
  "order_id": "string or null",
  "line_items": [
    {
      "item_name": "string",
      "description": "string or null",
      "product_code": "string or null",
      "quantity": number,
      "rate": number,
      "amount": number
    }
  ],
  "financial_summary": {
    "subtotal": number or null,
    "discount": {
      "percent": number or null,
      "amount": number or null
    },
    "shipping": number or null,
    "tax": number or null,
    "total": number or null,
    "balance_due": number or null
  },
  "payment_terms": "string or null",
  "notes": "string or null"
}"""


USER_PROMPT_TEMPLATE = """You will receive text extracted from an invoice document. Analyse it carefully and return a single VALID JSON object matching the schema below. Do not include markdown fences or commentary. Use null for any missing field and preserve exact numeric values.

JSON schema:
{json_schema}

CRITICAL RULES:
- `quantity` is how many units.
- `rate` is the unit price (per item) with no currency symbols.
- `amount` is the total for the line (quantity × rate).
- Extract shipping, discounts, and taxes when present.
- Never invent data. Use null if you cannot find a value.

SOURCE DOCUMENT:
{document}
"""


@dataclass
class _PageText:
    index: int
    content: str


class GeminiInvoiceExtractor:
    name = "gemini"

    def __init__(
        self,
        *,
        api_key: str,
        model: Optional[str],
        timeout: float,
        max_retries: int,
        fan_out_pages: bool,
    ) -> None:
        self._api_key = api_key
        self._model = model or "gemini-flash-latest"
        self._timeout = timeout
        self._max_retries = max(1, max_retries)
        self._fan_out_pages = fan_out_pages

    async def extract_invoice(
        self,
        *,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
    ) -> dict:
        perf: Dict[str, float] = {}
        perf_metadata: Dict[str, str] = {"provider": self.name, "model": self._model}
        start_time = time.time()

        text_start = time.perf_counter()
        pages = await asyncio.to_thread(self._extract_pages, file_bytes, mime_type)
        perf["text_extraction_time"] = (time.perf_counter() - text_start) * 1000

        if not pages:
            duration = round(time.time() - start_time, 2)
            return {
                "result_json": {
                    "error": "No text could be extracted from this document",
                    "line_items": [],
                },
                "result_markdown": json.dumps(
                    {
                        "error": "No text could be extracted from this document",
                        "line_items": [],
                    },
                    indent=2,
                ),
                "pages": 0,
                "duration": duration,
                "images": {},
                "performance": {**perf, **perf_metadata},
            }

        payload = self._build_payload(pages)

        api_start = time.perf_counter()
        response_json = await self._call_gemini(payload)
        perf["api_call_time"] = (time.perf_counter() - api_start) * 1000

        parse_start = time.perf_counter()
        invoice_json = self._parse_response(response_json)
        perf["json_parse_time"] = (time.perf_counter() - parse_start) * 1000

        duration = round(time.time() - start_time, 2)

        performance = {**perf, **perf_metadata}
        performance["provider_breakdown"] = {
            "provider": perf_metadata.get("provider"),
            "model": perf_metadata.get("model"),
            "text_extraction_time": perf.get("text_extraction_time", 0),
            "api_call_time": perf.get("api_call_time", 0),
            "json_parse_time": perf.get("json_parse_time", 0),
        }

        return {
            "result_json": invoice_json,
            "result_markdown": json.dumps(invoice_json, indent=2),
            "pages": len(pages),
            "duration": duration,
            "images": {},
            "performance": performance,
        }

    def _extract_pages(self, file_bytes: bytes, mime_type: str) -> List[_PageText]:
        if mime_type == "application/pdf":
            return self._extract_pdf_pages(file_bytes)
        if mime_type.startswith("image/"):
            text = self._extract_image_text(file_bytes)
            return [_PageText(index=0, content=text)] if text else []
        # Fallback: treat as binary text
        try:
            content = file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            content = ""
        return [_PageText(index=0, content=content)] if content else []

    def _extract_pdf_pages(self, file_bytes: bytes) -> List[_PageText]:
        document = fitz.open(stream=file_bytes, filetype="pdf")
        pages: List[_PageText] = []
        try:
            for page_index, page in enumerate(document):
                page_text = page.get_text().strip()
                if page_text:
                    pages.append(_PageText(index=page_index, content=page_text))
        finally:
            document.close()
        return pages

    def _extract_image_text(self, file_bytes: bytes) -> str:
        if not Image or not pytesseract:
            return ""
        import io

        with Image.open(io.BytesIO(file_bytes)) as img:
            return pytesseract.image_to_string(img)

    def _build_payload(self, pages: Sequence[_PageText]) -> dict:
        if self._fan_out_pages and len(pages) > 1:
            document_sections = []
            for page in pages:
                document_sections.append(f"=== PAGE {page.index + 1} ===\n{page.content}\n")
            document_text = "\n\n".join(document_sections)
        else:
            document_text = "\n\n".join(page.content for page in pages)

        user_prompt = USER_PROMPT_TEMPLATE.format(
            json_schema=JSON_SCHEMA,
            document=document_text,
        )

        return {
            "systemInstruction": {
                "role": "system",
                "parts": [{"text": SYSTEM_PROMPT}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 4096,
            },
        }

    async def _call_gemini(self, payload: dict) -> dict:
        url = GEMINI_ENDPOINT_TEMPLATE.format(model=self._model)
        headers = {"x-goog-api-key": self._api_key}
        last_error: Optional[Exception] = None

        for attempt in range(1, self._max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 200:
                    return response.json()
                error_payload = response.text
                last_error = RuntimeError(
                    f"Gemini API error {response.status_code}: {error_payload}"
                )
            except httpx.RequestError as exc:
                last_error = exc

            if attempt < self._max_retries:
                await asyncio.sleep(min(2 ** attempt, 5))

        assert last_error is not None
        raise last_error

    def _parse_response(self, response_json: dict) -> dict:
        candidates = response_json.get("candidates") or []
        if not candidates:
            return {
                "error": "No candidates returned from Gemini",
                "raw_response": response_json,
                "line_items": [],
            }

        candidate = candidates[0]
        content = candidate.get("content", {})
        parts = content.get("parts", [])
        text_parts = [part.get("text", "") for part in parts if part.get("text")]
        response_text = "\n".join(text_parts).strip()

        if not response_text:
            return {
                "error": "Gemini response did not contain text",
                "raw_response": response_json,
                "line_items": [],
            }

        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            # Attempt to clean accidental markdown fences
            cleaned = response_text
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
            cleaned = cleaned.rstrip("`")
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                return {
                    "error": "Failed to parse Gemini JSON response",
                    "raw_response": response_text[:1000],
                    "line_items": [],
                }


