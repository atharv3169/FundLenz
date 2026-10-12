"""Fixed-host GitHub transport. Tokens never follow redirects or enter logs."""
import os
import re
import time
import urllib.error
import urllib.request
from common import encoded, loads, require


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class GitHub:
    def __init__(self, token=None):
        self.repo = os.environ.get("GITHUB_REPOSITORY", "atharv3169/FundLenz")
        require(re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", self.repo), "Invalid repository")
        self.token = token or os.environ.get("GH_TOKEN")
        require(self.token, "Missing narrowly scoped GitHub token")

    def call(self, path, method="GET", data=None):
        require(path.startswith("/") and ".." not in path, "Invalid GitHub API path")
        request = urllib.request.Request("https://api.github.com/repos/" + self.repo + path,
                                         data=encoded(data) if data is not None else None, method=method,
                                         headers={"Authorization": "Bearer " + self.token, "Accept": "application/vnd.github+json",
                                                  "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"})
        # Retry read-only transient errors. Never replay a possibly completed
        # write or retry authentication, permission, quota or validation errors.
        for attempt in range(3):
            try:
                with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
                    raw = response.read(32 * 1024 * 1024 + 1)
                break
            except urllib.error.HTTPError as error:
                if method != "GET" or attempt == 2 or error.code not in {500, 502, 503, 504}:
                    raise
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                if method != "GET" or attempt == 2:
                    raise
            time.sleep(2 ** attempt)
        require(len(raw) <= 32 * 1024 * 1024, "Oversized API response")
        return loads(raw) if raw else None

    def all(self, path, key=None):
        items = []
        for page in range(1, 101):
            value = self.call(path + ("&" if "?" in path else "?") + f"per_page=100&page={page}")
            batch = value[key] if key else value
            items.extend(batch)
            if len(batch) < 100:
                return items
        raise ValueError("API pagination budget exceeded; refusing an incomplete diff")
