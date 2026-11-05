"""Fixed-host GitHub transport. Tokens never follow redirects or enter logs."""
import os
import http.client
import re
import time
import urllib.error
import urllib.request
from common import bounded_read, encoded, loads, require, retry_after_seconds


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class GitHub:
    def __init__(self, token=None):
        self.repo = os.environ.get("GITHUB_REPOSITORY", "atharv3169/FundLenz")
        require(re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", self.repo), "Invalid repository")
        self.token = token or os.environ.get("GH_TOKEN")
        require(self.token, "Missing narrowly scoped GitHub token")
        self._last_write_at = None

    def call(self, path, method="GET", data=None, *, raw_limit=None):
        require(path.startswith("/") and ".." not in path, "Invalid GitHub API path")
        if raw_limit is not None:
            require(method == "GET" and re.fullmatch(r"/git/blobs/[0-9a-f]{40}", path), "Raw reads require an immutable blob")
            require(isinstance(raw_limit, int) and 0 <= raw_limit <= 100 * 1024 * 1024, "Invalid blob size limit")
        limit = raw_limit if raw_limit is not None else 32 * 1024 * 1024
        request = urllib.request.Request("https://api.github.com/repos/" + self.repo + path,
                                         data=encoded(data) if data is not None else None, method=method,
                                         headers={"Authorization": "Bearer " + self.token, "Accept": "application/vnd.github.raw+json" if raw_limit is not None else "application/vnd.github+json",
                                                  "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"})
        # Immutable object uploads cannot move a ref or create a duplicate PR.
        # All externally visible writes are reconciled at their owning stage.
        retryable = method == "GET" or (method == "POST" and path in {"/git/blobs", "/git/trees", "/git/commits"})
        operation_deadline = time.monotonic() + 180
        for attempt in range(3):
            if time.monotonic() >= operation_deadline:
                raise TimeoutError("GitHub request deadline exhausted")
            if method != "GET":
                if self._last_write_at is not None:
                    time.sleep(max(0, 1 - (time.monotonic() - self._last_write_at)))
                self._last_write_at = time.monotonic()
            try:
                deadline = min(operation_deadline, time.monotonic() + 60)
                with urllib.request.build_opener(NoRedirect()).open(request, timeout=min(30, max(1, operation_deadline - time.monotonic()))) as response:
                    raw = bounded_read(response, limit, deadline)
                break
            except urllib.error.HTTPError as error:
                cooldown = retry_after_seconds(error.headers, 60)
                throttled = error.code in {403, 429} and cooldown is not None
                if not retryable or attempt == 2 or (error.code not in {500, 502, 503, 504} and not throttled):
                    raise
                if error.headers.get("Retry-After") is not None and cooldown is None:
                    raise
                delay = max(2 ** attempt, cooldown or 0)
                if time.monotonic() + delay >= operation_deadline:
                    raise
                time.sleep(delay)
                continue
            except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.IncompleteRead):
                if not retryable or attempt == 2:
                    raise
            time.sleep(2 ** attempt)
        require(len(raw) <= limit, "Oversized API response")
        return raw if raw_limit is not None else (loads(raw) if raw else None)

    def all(self, path, key=None):
        items = []
        for page in range(1, 101):
            value = self.call(path + ("&" if "?" in path else "?") + f"per_page=100&page={page}")
            batch = value[key] if key else value
            require(isinstance(batch, list), "Malformed paginated API response")
            items.extend(batch)
            if len(batch) < 100:
                return items
        raise ValueError("API pagination budget exceeded; refusing an incomplete diff")
