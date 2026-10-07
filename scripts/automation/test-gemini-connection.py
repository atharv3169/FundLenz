#!/usr/bin/env python3
"""One bounded Gemini connectivity request; never reads or writes catalogue data."""
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

MODEL = "gemini-3.1-flash-lite"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
MAX_RESPONSE_BYTES = 65536


class ConnectionCheckError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward the API credential to another URL.
        return None


def validate_response(raw):
    if len(raw) > MAX_RESPONSE_BYTES:
        raise ConnectionCheckError("Response exceeded the connection-test size limit.")
    try:
        payload = json.loads(raw)
        candidates = payload["candidates"]
        if len(candidates) != 1 or candidates[0].get("finishReason") != "STOP":
            raise ValueError("Incomplete response")
        parts = candidates[0]["content"]["parts"]
        answer = "".join(part.get("text", "") for part in parts if not part.get("thought"))
        if json.loads(answer) != {"status": "ok", "check": "fundlenz"}:
            raise ValueError("Unexpected response")
        usage = payload.get("usageMetadata", {})
        return {"status": "passed", "model": MODEL,
                "checks": ["credential accepted", "generation completed", "JSON response validated"],
                "total_tokens": usage.get("totalTokenCount") if type(usage.get("totalTokenCount")) is int else None,
                "catalogue_modified": False, "scheduled_updates_enabled": False}
    except (ValueError, KeyError, TypeError, AttributeError, IndexError):
        raise ConnectionCheckError("Gemini responded, but the fixed connection-test response was invalid or incomplete.") from None


def run(key, opener=None):
    if not key or not key.strip():
        raise ConnectionCheckError("GEMINI_API_KEY is missing. Add it under repository Settings > Secrets and variables > Actions.")
    body = {
        "contents": [{"role": "user", "parts": [{"text": 'Connection test only. Return exactly this JSON: {"status":"ok","check":"fundlenz"}'}]}],
        "generationConfig": {"maxOutputTokens": 512, "responseMimeType": "application/json"},
    }
    request = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "x-goog-api-key": key.strip()})
    opener = opener or urllib.request.build_opener(NoRedirect())
    try:
        with opener.open(request, timeout=40) as response:
            return validate_response(response.read(MAX_RESPONSE_BYTES + 1))
    except urllib.error.HTTPError as error:
        messages = {
            400: "Gemini rejected the request or key. Check the API key type and model availability in AI Studio.",
            401: "Gemini did not accept the API credential. Replace the repository secret with a valid AI Studio key.",
            403: "Gemini denied access. Check key restrictions, project API access and regional availability in AI Studio.",
            404: "The configured model is unavailable to this project. Review current supported models before changing configuration.",
            429: "Gemini quota is unavailable or exhausted. Check this project's free-tier quota; no automatic retries or billing changes were made.",
        }
        # Do not print raw error bodies, request headers, URLs supplied by the
        # service or exception reprs: they can contain credentials or user data.
        raise ConnectionCheckError(messages.get(error.code, f"Gemini request failed with HTTP {int(error.code)}; no automatic retry was attempted.")) from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise ConnectionCheckError("Gemini connection failed or timed out; no automatic retry was attempted.") from None


def main():
    try:
        result = run(os.environ.get("GEMINI_API_KEY", ""))
        message = "Gemini connection test passed. Catalogue data was not modified. Daily updates are not enabled."
        status = 0
    except ConnectionCheckError as error:
        result = {"status": "failed", "message": str(error), "catalogue_modified": False}
        message = str(error)
        status = 1
    print(json.dumps(result, indent=2))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with Path(summary).open("a") as output:
            output.write("## Gemini connection test\n\n" + message + "\n")
    return status


if __name__ == "__main__":
    sys.exit(main())
