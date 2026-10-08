"""Two bounded Gemini requests. No shell tools, browsing tools or write credentials."""
import os
import copy
import time
import re
import urllib.error
import urllib.request
from common import ROOT, clean_error, encoded, loads, now, read, require, schema, sha, write
from adapters import reconcile


def packets(acquisition, units, task, policy, run=None):
    run = run or ROOT / "work/run"
    issues = acquisition["previous_state"]["issues"]["issues"]
    urls = {i["source_url"] for i in issues}
    sources = [s for s in acquisition["source_checks"] if s["checked_at"] and (task == "fresh_scan" or s["source_url"] in urls)]
    sources.sort(key=lambda s: (0 if s["adapter"] == "amfi_nav" else 1 if s["outcome"] == "unavailable" else 2, s["source_id"]))
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
                        "issues_in_this_task": len(selected_issues), "unselected_issues_remain_open": True},
              "output_instructions": "Return the exact candidate schema. Copy supplied source-check metadata, not inferred values. "
                "Review only supplied excerpts; do not claim full-file model verification. Do not invent values when a sample hash replaces a value. "
                "At most 8 proposals. For unresolved issues return null new_candidate, finding unresolved, and their exact issue_id. "
                "If proposing a supported NAV change use atomic_group nav:<AMFI code>, record_id <AMFI code>, field nav, new_candidate {nav,navDate}; "
                "otherwise report unresolved observations. Sources outside this packet were not inspected by this task."}
    return packet


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
    candidate = loads(response_text(body))
    schema(candidate, "candidate")
    require(candidate["run_id"] == packet["run_id"] and candidate["base_dataset_sha256"] == packet["base_dataset_sha256"]
            and candidate["task_type"] == task, "Model run/base mismatch")
    require(len(candidate["proposals"]) <= policy["max_model_proposals"], "Proposal budget exceeded")
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
            candidate, usage, attempts = bounded_call(packet, task, policy)
            write(root / (task + ".json"), candidate)
            report = {"task": task, "status": "completed", "started_at": started, "completed_at": now(), "usage": usage,
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
    for attempt in range(1, policy["model_retries"] + 2):
        try:
            candidate, usage = caller(packet, task, policy)
            return candidate, usage, attempt
        except urllib.error.HTTPError as error:
            error.fundlenz_attempts = attempt
            if attempt > policy["model_retries"] or error.code not in policy["model_retry_http_statuses"]:
                raise
            wait(policy["model_retry_delay_seconds"])
    raise ValueError("Model attempt budget exhausted")


if __name__ == "__main__":
    main()
