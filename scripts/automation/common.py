"""Small, fail-closed primitives shared by trusted automation processes."""
import datetime as dt
import hashlib
import json
import math
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def strict_pairs(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON key")
        result[key] = value
    return result


def loads(raw):
    def reject(value):
        raise ValueError("Non-finite JSON constant")
    def finite_float(value):
        parsed = float(value)
        require(math.isfinite(parsed), "Non-finite JSON number")
        return parsed
    return json.loads(raw, object_pairs_hook=strict_pairs, parse_constant=reject, parse_float=finite_float)


def read(path):
    return loads(Path(path).read_bytes())


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode()


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded(value))


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def timestamp(value):
    result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(result.tzinfo is not None, "Timestamp requires timezone")
    return result


def safe_path(root, relative):
    require(isinstance(relative, str) and relative and "\\" not in relative, "Unsafe path")
    require(not relative.startswith("/") and all(p not in {"", ".", ".."} for p in relative.split("/")), "Unsafe path")
    path = Path(root) / relative
    require(path.resolve().is_relative_to(Path(root).resolve()), "Path escapes root")
    require(not any(p.is_symlink() for p in [path, *path.parents] if p != Path(root).parent), "Symlink forbidden")
    return path


def dataset_hash(root=ROOT, overlay=None):
    paths = {p.relative_to(root).as_posix(): sha(p.read_bytes()) for p in (Path(root) / "public/data").rglob("*.json")}
    for path, value in (overlay or {}).items():
        if path.startswith("public/data/"):
            paths[path] = sha(value)
    return sha("".join(p + "\0" + h + "\n" for p, h in sorted(paths.items())).encode())


def schema(value, name):
    # Pinned dependency; format validation is mandatory, not annotation-only.
    import jsonschema
    contract = read(ROOT / "automation/schemas" / (name + ".schema.json"))
    checker = jsonschema.FormatChecker()
    # jsonschema silently skips some formats without optional packages. Register
    # the required date formats explicitly, using calendar-aware stdlib parsing.
    @checker.checks("date-time", raises=(ValueError, TypeError))
    def date_time(item):
        if not isinstance(item, str): return True
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", item)) and timestamp(item) is not None
    @checker.checks("date", raises=(ValueError, TypeError))
    def date(item):
        if not isinstance(item, str): return True
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", item)) and dt.date.fromisoformat(item) is not None
    try:
        jsonschema.Draft7Validator(contract, format_checker=checker).validate(value)
    except jsonschema.ValidationError as error:
        # Preserve diagnostic locations without dumping a whole source document
        # or oversized malformed URL into Actions logs.
        brief = ValueError(f"Contract {name} failed at {str(list(error.path))[:180]} ({error.validator})")
        brief.schema_path, brief.path = list(error.schema_path), list(error.path)
        raise brief from None


def manifest(files):
    return [{"path": p, "bytes": len(raw), "sha256": sha(raw)} for p, raw in sorted(files.items())]


def clean_error(error):
    # No remote response body or exception containing a URL/query/key enters logs.
    return type(error).__name__


def run_id():
    result = os.environ.get("GITHUB_RUN_ID", "local") + "-" + os.environ.get("GITHUB_RUN_ATTEMPT", "1")
    require(re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", result), "Invalid run ID")
    return result
