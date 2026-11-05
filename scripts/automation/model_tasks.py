"""Two bounded Gemini requests. No shell tools, browsing tools or write credentials."""
import os
import http.client
import copy
import time
import re
import urllib.error
import urllib.request
from common import ROOT, bounded_read, retry_after_seconds, clean_error, encoded, loads, now, read, require, schema, sha, write
from adapters import reconcile


class ModelContractError(ValueError):
    """One bounded retry is allowed for an incomplete Gemini JSON response."""


def verify_candidate_envelope(candidate, packet, task, policy):
    """Fail closed before accepting model output; trusted validator rechecks later."""
    schema(candidate, "candidate")
    require(candidate["run_id"] == packet["run_id"] and
            candidate["base_dataset_sha256"] == packet["base_dataset_sha256"] and
            candidate["task_type"] == task, "Model run/base mismatch")
    require(candidate["started_at"] == packet["started_at"] and
            candidate["completed_at"] == packet["completed_at"], "Model changed task timestamps")
    require(len(candidate["proposals"]) <= min(8, policy["max_model_proposals"]), "Proposal budget exceeded")
    expected = {source["source_id"]: source for source in packet["sources"]}
    actual = candidate["source_checks"]
    require(len(actual) == len(expected) and
            {row["source_id"] for row in actual} == set(expected), "Model source coverage incomplete or duplicated")
    keys = ("source_id", "source_url", "checked_at", "outcome", "source_sha256", "reason", "scope")
    for row in actual:
        require(all(row[key] == expected[row["source_id"]][key] for key in keys),
                "Model altered the trusted source-check ledger")



def model_review_schema():
    """Wire contract: the model authors observations, never retrieval bookkeeping."""
    candidate = read(ROOT / "automation/schemas/candidate.schema.json")
    source = candidate["properties"]["source_checks"]["items"]["properties"]
    return {"type": "object", "additionalProperties": False,
            "required": ["reviewed_sources", "proposals", "summary"],
            "properties": {
                "reviewed_sources": {"type": "array", "maxItems": 12,
                    "items": {"type": "object", "additionalProperties": False,
                              "required": ["source_id", "source_sha256"],
                              "properties": {k: source[k] for k in ("source_id", "source_sha256")}}},
                "proposals": dict(candidate["properties"]["proposals"], maxItems=8),
                "summary": candidate["properties"]["summary"]}}


def candidate_from_review(review, packet, task, policy):
    """Bind a strictly validated review to this invocation's immutable source facts.

    No legacy full-envelope fallback or correction of model-owned fields. The
    independent validator still verifies the resulting candidate and proposals.
    """
    import jsonschema
    try:
        jsonschema.Draft7Validator(model_review_schema()).validate(review)
    except jsonschema.ValidationError as error:
        raise ValueError(f"Model review contract failed at {str(list(error.path))[:180]} ({error.validator})") from None
    expected = [{k: source[k] for k in ("source_id", "source_sha256")}
                for source in packet["sources"]]
    actual = review["reviewed_sources"]
    require(len({row["source_id"] for row in expected}) == len(expected),
            "Duplicate trusted source ID")
    require(len(actual) == len(expected) and
            sorted(actual, key=lambda row: row["source_id"]) ==
            sorted(expected, key=lambda row: row["source_id"]),
            "Model source coverage or hash mismatch")
    require(packet["task_type"] == task, "Model packet task mismatch")
    keys = ("source_id", "source_url", "checked_at", "outcome", "source_sha256", "reason", "scope")
    candidate = {"schema_version": 1,
                 **{k: packet[k] for k in ("run_id", "base_dataset_sha256", "task_type", "started_at", "completed_at")},
                 "source_checks": [{k: source[k] for k in keys} for source in packet["sources"]],
                 "proposals": copy.deepcopy(review["proposals"]), "summary": review["summary"]}
    verify_candidate_envelope(candidate, packet, task, policy)
    return candidate


def task_system(task):
    name = "gemini-daily-scan.md" if task == "fresh_scan" else "gemini-reinvestigation.md"
    return (ROOT / "automation/gemini-system-prompt.md").read_text() + "\n" + (ROOT / "automation" / name).read_text()


def model_input_bytes(packet, task):
    return len(task_system(task).encode()) + len(encoded({"review_schema": model_review_schema(), "inputs": packet}))


def fit_packet(packet, task, policy):
    """Trim context deterministically, never fabricate evidence or skip review.

    The full source/issue history remains in the audit. The independent replay
    executes the same selection and recomputes the exact bounded packet.
    """
    packet = copy.deepcopy(packet)
    limit = policy["max_model_input_bytes_per_task"] - 1000  # corrective-retry headroom
    original_sources = len(packet["sources"])
    while model_input_bytes(packet, task) > limit:
        if packet["sample_adapter_decisions"]:
            packet["sample_adapter_decisions"].pop()
        elif any(s["excerpt"] for s in packet["sources"]):
            for source in packet["sources"]:
                source.update(excerpt="", excerpt_is_complete_source=False, excerpt_omitted_for_budget=True)
        elif len(packet["issues"]) > 1:
            packet["issues"].pop()
        elif len(packet["sources"]) > 1:
            packet["sources"].pop()
            urls = {s["source_url"] for s in packet["sources"]}
            packet["issues"] = [i for i in packet["issues"] if i["source_url"] in urls]
        else:
            raise ValueError("Minimum honest model packet exceeds reviewed input budget")
        packet["scope"].update(sample_units=len(packet["sample_adapter_decisions"]),
                                issues_in_this_task=len(packet["issues"]),
                                sources_omitted_for_model_budget=original_sources-len(packet["sources"]))
    return packet


def packets(acquisition, units, task, policy, run=None):
    run = run or ROOT / "work/run"
    issues = acquisition["previous_state"]["issues"]["issues"]
    urls = {i["source_url"] for i in issues}
    # Gemini can investigate only independently downloaded, SHA-256 verified
    # source bytes. A failed fetch (including a 403 or blocked redirect) has
    # source_sha256=None: giving it to the model invites fabricated evidence.
    # The downloader and persistent issue queue still record the failure.
    sources = [s for s in acquisition["source_checks"]
               if s["checked_at"] and s["outcome"] in {"checked_changed", "checked_unchanged"}
               and s.get("source_sha256")
               and (task == "fresh_scan" or s["source_url"] in urls)]
    sources.sort(key=lambda s: (0 if s["adapter"] == "amfi_nav" else
                                1 if s["adapter"] == "ishares_holdings" else 2, s["source_id"]))
    selected_issues = []
    if task == "reinvestigation":
        # Rotate the full queue of attempted sources BEFORE bounding source
        # packets. Cutting sources first can starve every issue on source 13+.
        attempted_urls = {s["source_url"] for s in sources}
        eligible = sorted([i for i in issues if i["source_url"] in attempted_urls], key=lambda i: i["issue_id"])
        cursor = acquisition["previous_state"].get("investigation_after", "")
        eligible = [i for i in eligible if i["issue_id"] > cursor] + [i for i in eligible if i["issue_id"] <= cursor]
        selected_issues = copy.deepcopy(eligible[:min(8, policy["max_model_source_packets"])])
        selected_urls = {i["source_url"] for i in selected_issues}
        sources = [s for s in sources if s["source_url"] in selected_urls]
    else:
        sources = sources[:policy["max_model_source_packets"]]
    # The deterministic adapters inspect whole files; the model gets explicitly
    # labelled excerpts and at most eight sample units, never a fake full review.
    result = []
    for source in sources:
        entry = {k: source.get(k) for k in ["source_id", "source_url", "checked_at", "outcome", "source_sha256", "reason", "scope"]}
        raw = (run / source["path"]).read_bytes() if source.get("path") else b""
        textual = raw[:100].lstrip().startswith((b"<", b"{", b"[")) or source["source_url"].split("?")[0].endswith((".csv", ".txt"))
        entry["excerpt"] = raw.decode("utf-8", errors="replace")[:700] if textual else "Binary disclosure: no text extraction adapter in this release."
        entry["excerpt_is_complete_source"] = textual and len(raw) <= 700
        result.append(entry)
    relevant = [u for u in units if u["decision"] not in {"unchanged", "older_snapshot", "retained_unsupported"}
                and u["source_url"] in {s["source_url"] for s in sources}]
    if task == "reinvestigation":
        wanted = {(i["record_id"] or i["scope"]).removeprefix("model:") for i in selected_issues}
        relevant = [u for u in units if u["unit"] in wanted]
    relevant.sort(key=lambda u: u["decision"] == "accepted")
    samples = []
    for unit in relevant[:8]:
        item = dict(unit)
        s = next((s for s in sources if s["source_id"] == unit["source_id"]), None)
        locator = re.match(r"AMFI line (\d+)", unit["locator"])
        if s and s.get("path") and locator:
            raw = (run / s["path"]).read_bytes()
            line = int(locator[1])
            rows = raw.decode("utf-8-sig").splitlines()
            item["actual_source_rows"] = {"source_sha256": s["source_sha256"], "header": rows[0],
                                          "line": line, "text": rows[line - 1][:2000]}
        for key in ["previous_verified", "proposed_value"]:
            if len(encoded(item[key])) > 2500:
                value = item[key]
                item[key] = {"sample_only": True, "sha256_of_complete_value": sha(encoded(value)),
                             "snapshot_date": value.get("date") if isinstance(value, dict) else None}
        samples.append(item)
    for issue in selected_issues:
        for key in ["previous_candidate", "previous_verified"]:
            if len(encoded(issue[key])) > 2500:
                issue[key] = {"sample_only": True, "sha256_of_complete_value": sha(encoded(issue[key])),
                              "reason": "Complete value retained in audit; not included in bounded model context."}
    packet = {"run_id": acquisition["run_id"], "base_dataset_sha256": acquisition["base_dataset_sha256"],
              "task_type": task, "started_at": acquisition["started_at"], "completed_at": acquisition["completed_at"],
              "sources": result, "sample_adapter_decisions": samples, "issues": selected_issues,
              "scope": {"total_adapter_units": len(units), "sample_units": len(samples), "open_issues": len(issues),
                        "issues_in_this_task": len(selected_issues), "unselected_issues_remain_open": True,
                        "unavailable_sources_excluded_from_model": sum(
                            s["outcome"] == "unavailable" and bool(s["checked_at"])
                            for s in acquisition["source_checks"])},
              "output_instructions": "Return the exact review_schema. Include every source ID and hash in reviewed_sources. The runner owns retrieval metadata. "
                "Review only supplied excerpts; do not claim full-file model verification. Do not invent values when a sample hash replaces a value. "
                "At most 8 proposals. For unresolved issues return null new_candidate, finding unresolved, and their exact issue_id. "
                "If proposing a supported NAV change use atomic_group nav:<AMFI code>, record_id <AMFI code>, field nav, new_candidate {nav,navDate}; "
                "New AMFI identities are admitted only by the trusted new_plan adapter, never inferred from names. Do not propose replacement identities or fabricate holdings. Omit a proposal when the supplied deterministic result has no evidenced problem; "
                "otherwise report unresolved observations. Sources outside this packet were not inspected by this task."}
    return fit_packet(packet, task, policy)



def is_no_work_packet(packet):
    """Avoid paid/unavailable model calls only when no evidence or assigned issues exist.

    An unavailable source remains represented in the packet and is never
    misclassified as having been successfully checked.
    """
    return (not packet["sources"] and not packet["issues"] and
            not packet["sample_adapter_decisions"])


def trusted_no_work_candidate(packet):
    """Only the trusted runner may generate this factual empty-source envelope."""
    require(is_no_work_packet(packet), "Never bypass Gemini for a packet with evidence or issues")
    candidate = {"schema_version": 1, "run_id": packet["run_id"],
                 "base_dataset_sha256": packet["base_dataset_sha256"],
                 "task_type": packet["task_type"],
                 "started_at": packet["started_at"],
                 "completed_at": packet["completed_at"],
                 "source_checks": [], "proposals": [],
                 "summary": "No sources, adapter decisions or assigned investigation issues in this task; no Gemini request needed."}
    schema(candidate, "candidate")
    return candidate


def call_model(packet, task, policy):
    key = os.environ.get("GEMINI_API_KEY")
    require(key, "Missing GEMINI_API_KEY")
    system = task_system(task)
    contract = model_review_schema()
    user = encoded({"review_schema": contract, "inputs": packet}).decode()
    require(len(system.encode()) + len(user.encode()) <= policy["max_model_input_bytes_per_task"], "Model input budget exhausted")
    payload = {"systemInstruction": {"parts": [{"text": system}]},
               "contents": [{"role": "user", "parts": [{"text": user}]}],
               "generationConfig": {"temperature": 0, "maxOutputTokens": policy["max_model_output_tokens"], "responseMimeType": "application/json"}}
    request = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/" + policy["model"] + ":generateContent",
                                     data=encoded(payload), headers={"Content-Type": "application/json", "x-goog-api-key": key}, method="POST")
    # Refuse redirects so an API key can never follow a response to another host.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    deadline = time.monotonic() + policy["model_timeout_seconds"]
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=policy["model_timeout_seconds"]) as response:
        raw = bounded_read(response, policy["max_model_response_bytes"], deadline)
    require(len(raw) <= policy["max_model_response_bytes"], "Oversized model response")
    write(ROOT / "work/run" / (task + "-provider-response.json"),
          {"response_sha256": sha(raw), "raw_response": raw.decode("utf-8", errors="replace").replace(key, "[REDACTED]")})
    try:
        body = loads(raw)
        final_text = response_text(body)
        candidates = body["candidates"]
        diagnostic = {"finish_reasons": [c.get("finishReason") for c in candidates],
                      "part_keys": [[sorted(p) for p in c["content"]["parts"]] for c in candidates],
                      "response_sha256": sha(raw)}
        write(ROOT / "work/run" / (task + "-transport.json"), diagnostic)
        (ROOT / "work/run" / (task + "-raw-text.txt")).write_text(final_text.replace(key, "[REDACTED]"))
        review = loads(final_text)
        candidate = candidate_from_review(review, packet, task, policy)
        # Usage is provider bookkeeping, not arbitrary text for public logs.
        usage = body.get("usageMetadata", {})
        require(isinstance(usage, dict), "Malformed provider usage metadata")
        usage = {k: usage[k] for k in ("promptTokenCount", "candidatesTokenCount", "totalTokenCount", "thoughtsTokenCount")
                 if type(usage.get(k)) is int and usage[k] >= 0}
    except (ValueError, TypeError, KeyError, AttributeError) as error:
        reason = str(error)[:200] if isinstance(error, ValueError) else type(error).__name__
        raise ModelContractError("Invalid model response: " + reason) from None
    return candidate, usage


def response_text(body):
    require(isinstance(body, dict), "Malformed model response object")
    candidates = body.get("candidates", [])
    require(isinstance(candidates, list) and all(isinstance(c, dict) for c in candidates), "Malformed model candidates")
    require(len(candidates) == 1 and candidates[0].get("finishReason") == "STOP", "Incomplete model response")
    content = candidates[0].get("content", {})
    require(isinstance(content, dict), "Malformed model content")
    parts = content.get("parts", [])
    require(isinstance(parts, list) and all(isinstance(p, dict) for p in parts), "Malformed model parts")
    # Official Gemini text parts may carry thoughtSignature metadata. It is not
    # candidate data, a permission, or something to execute. Thought parts are
    # excluded; every final text value still undergoes the full strict contract.
    require(parts and all(set(p) <= {"text", "thought", "thoughtSignature"} and isinstance(p.get("text"), str) for p in parts),
            "Unexpected model content type")
    text = "".join(p["text"] for p in parts if not p.get("thought", False))
    require(text, "Missing final model text")
    return text


def main():
    root = ROOT / "work/run"
    acquisition = read(root / "acquisition.json")
    policy = read(ROOT / "automation/runtime.json")
    raws = {s["source_id"]: (root / s["path"]).read_bytes() for s in acquisition["source_checks"] if s.get("path")}
    units, _ = reconcile(ROOT, acquisition, policy, raws)
    require(policy["max_model_calls"] == 8 and policy["model_retries"] == 3, "Reviewed eight-attempt budget changed")
    for task in ["fresh_scan", "reinvestigation"]:
        packet = packets(acquisition, units, task, policy)
        write(root / (task + "-input.json"), packet)
        started = now()
        retry_events = []
        try:
            if is_no_work_packet(packet):
                candidate, usage, attempts = trusted_no_work_candidate(packet), {}, 0
                status = "not_required"
            else:
                candidate, usage, attempts = bounded_call(packet, task, policy, events=retry_events)
                status = "completed"
            write(root / (task + ".json"), candidate)
            report = {"task": task, "status": status, "started_at": started, "completed_at": now(), "usage": usage,
                      "source_packets": len(packet["sources"]), "issues_in_packet": len(packet["issues"]), "attempts": attempts}
        except Exception as error:
            report = {"task": task, "status": "failed", "started_at": started, "completed_at": now(), "error_type": clean_error(error)}
            report["attempts"] = getattr(error, "fundlenz_attempts", 1)
            if isinstance(error, ValueError): report["reason"] = str(error)[:300]
            if hasattr(error, "schema_path"):
                report["schema_path"] = list(error.schema_path)
                report["instance_path"] = list(error.path)
            if isinstance(error, urllib.error.HTTPError):
                report["http_status"] = error.code
        report["retry_events"] = retry_events
        write(root / (task + "-status.json"), report)
        print(task + ": " + report["status"])



def bounded_call(packet, task, policy, caller=call_model, wait=time.sleep, events=None):
    current_packet = packet
    contract_failures = 0
    events = events if events is not None else []

    def record_retry(error, attempt, delay):
        # Never print provider bodies, request URLs, keys or source/model text.
        event = {"task": task, "attempt": attempt, "error_type": type(error).__name__,
                 "http_status": error.code if isinstance(error, urllib.error.HTTPError) else None,
                 "next_delay_seconds": delay, "remaining_attempts": policy["model_retries"] + 1 - attempt}
        events.append(event)
        print(encoded({"model_retry": event}).decode().strip(), flush=True)
        if delay:
            wait(delay)

    def service_delay(attempt):
        return min(240, policy["model_retry_delay_seconds"] * (2 ** (attempt - 1)))
    for attempt in range(1, policy["model_retries"] + 2):
        try:
            candidate, usage = caller(current_packet, task, policy)
            return candidate, usage, attempt
        except urllib.error.HTTPError as error:
            error.fundlenz_attempts = attempt
            if attempt > policy["model_retries"] or error.code not in policy["model_retry_http_statuses"]:
                raise
            cooldown = retry_after_seconds(error.headers, 240)
            if error.headers.get("Retry-After") is not None and cooldown is None:
                raise
            record_retry(error, attempt, max(service_delay(attempt), cooldown or 0))
        except ModelContractError as error:
            error.fundlenz_attempts = attempt
            contract_failures += 1
            if attempt > policy["model_retries"] or contract_failures > 1:
                raise
            record_retry(error, attempt, 0)
            # Correct the same bounded task; do not introduce new sources,
            # change trusted metadata or bypass independent validation.
            current_packet = dict(packet)
            current_packet["output_instructions"] = packet["output_instructions"] + (
                " CORRECTIVE RETRY: Your previous response was rejected: " + str(error)[:120] +
                ". Return fewer or zero proposals and exactly one reviewed_sources row for EVERY inputs.sources entry. "
                "Copy source_id and source_sha256 exactly. Use only review_schema keys. Return complete valid JSON and never invent evidence.")
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.IncompleteRead) as error:
            error.fundlenz_attempts = attempt
            if attempt > policy["model_retries"]:
                raise
            record_retry(error, attempt, service_delay(attempt))
    raise ValueError("Model attempt budget exhausted")


if __name__ == "__main__":
    main()
