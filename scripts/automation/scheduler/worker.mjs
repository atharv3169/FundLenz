/** Separate cron-only dispatcher: no Gemini key, publish token, D1 or public route. */
export const REPOSITORY = "atharv3169/FundLenz";
export const WORKFLOW = "catalogue-daily.yml";
export const EXTERNAL_RUN_NAME = "FundLenz daily catalogue (external scheduler)";
export const CRONS = ["47 3 * * *", "57 3 * * *"];
const API = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${WORKFLOW}`;

export function indiaDate(milliseconds) {
  return new Date(milliseconds + 330 * 60_000).toISOString().slice(0, 10);
}

export async function runScheduler(event, env, fetcher = (url, options) => globalThis.fetch(url, options), at = Date.now()) {
  if (env.SCHEDULER_ENABLED !== "true") return { status: "disabled" };
  if (!CRONS.includes(event.cron) || !Number.isFinite(event.scheduledTime)
      || event.scheduledTime > at || indiaDate(event.scheduledTime) !== indiaDate(at)) {
    throw new Error("Invalid or stale scheduler event");
  }
  const day = indiaDate(at);
  const due = new Date(`${day}T03:47:00.000Z`).getTime();
  if (at < due) throw new Error("Before the approved daily window");
  if (!env.FUNDLENZ_DISPATCH_TOKEN?.trim()) throw new Error("Missing dispatch credential");

  async function request(url, method, body) {
    // A fixed API host and rejected redirects keep credentials on GitHub.
    // No automatic POST retry: a lost response may already have dispatched.
    let response;
    try {
      response = await fetcher(url, {
        method, redirect: "manual", signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${env.FUNDLENZ_DISPATCH_TOKEN}`,
          Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json", "User-Agent": "FundLenz-catalogue-scheduler",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      // Only fixed diagnostic labels are logged; never exception text or credentials.
      const category = error?.name === "TimeoutError" ? "timeout"
        : error?.name === "AbortError" ? "aborted"
        : error?.name === "TypeError" ? "type_error"
        : "network_or_runtime_error";
      throw new Error(`GitHub ${method} transport failure (${category}); inspect run history before recovery`);
    }
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`GitHub ${method} redirect rejected (HTTP ${response.status})`);
    }
    if (!response.ok) throw new Error(`GitHub ${method} failed (HTTP ${response.status})`);
    return response;
  }

  const since = encodeURIComponent(">=" + new Date(due).toISOString());
  const response = await request(`${API}/runs?branch=main&per_page=100&created=${since}`, "GET");
  let data;
  try { data = await response.json(); } catch { throw new Error("Invalid GitHub run history"); }
  if (!Array.isArray(data.workflow_runs) || data.workflow_runs.length >= 100
      || !Number.isInteger(data.total_count) || data.total_count >= 100) {
    throw new Error("Incomplete or oversized GitHub run history; refusing dispatch");
  }
  const existing = data.workflow_runs.find(run => {
    const created = Date.parse(run.created_at);
    return run.head_branch === "main" && run.head_repository?.full_name === REPOSITORY
      && created >= due && created <= at
      && (run.event === "schedule" ||
        (run.event === "workflow_dispatch" && run.display_title === EXTERNAL_RUN_NAME));
  });
  // Failed runs require deliberate recovery; the second timer is only for a
  // missing dispatch, never an automatic new Gemini budget after a failure.
  if (existing) return { status: "already_triggered", day, run_id: existing.id };
  const dispatched = await request(`${API}/dispatches`, "POST", {
    ref: "main", inputs: {
      automated_daily: true, force_supported_sources: false, publish_validated_data: true,
    },
  });
  if (![200, 204].includes(dispatched.status)) throw new Error("Unexpected dispatch acknowledgement");
  return { status: "dispatched", day };
}

const worker = {
  async scheduled(controller, env) {
    controller.noRetry();
    const result = await runScheduler(controller, env);
    console.log(JSON.stringify(result));
  },
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};

export default worker;

