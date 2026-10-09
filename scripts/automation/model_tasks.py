"""Two bounded Gemini requests. No shell tools, browsing tools or write credentials."""
import os
import copy
import time
import re
import urllib.error
import urllib.request
from common import ROOT, clean_error, encoded, loads, now, read, require, schema, sha, write
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
               and s.get("source_sha256") and s.get("path")
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
              "output_instructions": "Return the exact candidate schema. Copy supplied source-check metadata, not inferred values. "
                "Review only supplied excerpts; do not claim full-file model verification. Do not invent values when a sample hash replaces a value. "
                "At most 8 proposals. For unresolved issues return null new_candidate, finding unresolved, and their exact issue_id. "
                "If proposing a supported NAV change use atomic_group nav:<AMFI code>, record_id <AMFI code>, field nav, new_candidate {nav,navDate}; "
                "otherwise report unresolved observations. Sources outside this packet were not inspected by this task."}
    return packet



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
    prompt_name = "gemini-daily-scan.md" if task == "fresh_scan" else "gemini-reinvestigation.md"
    system = (ROOT / "automation/gemini-system-prompt.md").read_text() + "\n" + (ROOT / "automation" / prompt_name).read_text()
    contract = read(ROOT / "automation/schemas/candidate.schema.json")
    user = encoded({"candidate_schema": contract, "inputs": packet}).decode()
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
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=policy["model_timeout_seconds"]) as response:
        raw = response.read(policy["max_model_response_bytes"] + 1)
    require(len(raw) <= policy["max_model_response_bytes"], "Oversized model response")
    body = loads(raw)
    candidates = body.get("candidates", [])
    diagnostic = {"finish_reasons": [c.get("finishReason") for c in candidates],
                  "part_keys": [[sorted(p) for p in c.get("content", {}).get("parts", [])] for c in candidates],
                  "usage": body.get("usageMetadata", {}), "response_sha256": sha(raw)}
    write(ROOT / "work/run" / (task + "-transport.json"), diagnostic)
    final_text = "".join(p.get("text", "") for c in candidates for p in c.get("content", {}).get("parts", [])
                         if isinstance(p.get("text"), str) and not p.get("thought", False))
    (ROOT / "work/run" / (task + "-raw-text.txt")).write_text(final_text.replace(key, "[REDACTED]"))
    try:
        candidate = loads(response_text(body))
        verify_candidate_envelope(candidate, packet, task, policy)
    except ValueError as error:
        # Bad JSON, truncated answers and incomplete ledgers get one corrective
        # retry. Never treat them as valid observations or silently fill gaps.
        raise ModelContractError(str(error)[:240]) from None
    return candidate, body.get("usageMetadata", {})


def response_text(body):
    candidates = body.get("candidates", [])
    require(len(candidates) == 1 and candidates[0].get("finishReason") == "STOP", "Incomplete model response")
    parts = candidates[0].get("content", {}).get("parts", [])
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
    require(policy["max_model_calls"] == 4 and policy["model_retries"] == 1, "Reviewed four-attempt budget changed")
    for task in ["fresh_scan", "reinvestigation"]:
        packet = packets(acquisition, units, task, policy)
        write(root / (task + "-input.json"), packet)
        started = now()
        try:
            if is_no_work_packet(packet):
                candidate, usage, attempts = trusted_no_work_candidate(packet), {}, 0
                status = "not_required"
            else:
                candidate, usage, attempts = bounded_call(packet, task, policy)
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
        write(root / (task + "-status.json"), report)
        print(task + ": " + report["status"])



def bounded_call(packet, task, policy, caller=call_model, wait=time.sleep):
    current_packet = packet
    for attempt in range(1, policy["model_retries"] + 2):
        try:
            candidate, usage = caller(current_packet, task, policy)
            return candidate, usage, attempt
        except urllib.error.HTTPError as error:
            error.fundlenz_attempts = attempt
            if attempt > policy["model_retries"] or error.code not in policy["model_retry_http_statuses"]:
                raise
            wait(policy["model_retry_delay_seconds"])
        except ModelContractError as error:
            error.fundlenz_attempts = attempt
            if attempt > policy["model_retries"]:
                raise
            # Correct the same bounded task; do not introduce new sources,
            # change trusted metadata or bypass independent validation.
            current_packet = dict(packet)
            current_packet["output_instructions"] = packet["output_instructions"] + (
                " CORRECTIVE RETRY: Your previous response was rejected: " + str(error)[:120] +
                ". Return fewer or zero proposals and exactly one source_checks row for EVERY inputs.sources entry. "
                "Copy all seven metadata fields unchanged. Return complete valid JSON and never invent evidence.")
    raise ValueError("Model attempt budget exhausted")


if __name__ == "__main__":
    main()
