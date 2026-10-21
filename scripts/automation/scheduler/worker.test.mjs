import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import worker, { runScheduler, REPOSITORY, EXTERNAL_RUN_NAME, CRONS, indiaDate } from "./worker.mjs";

const at = Date.parse("2026-10-15T03:47:00Z");
const event = { cron: CRONS[0], scheduledTime: at };
const env = { SCHEDULER_ENABLED: "true", FUNDLENZ_DISPATCH_TOKEN: "fictional-test-token" };
const run = (extra = {}) => ({ id: 42, head_branch: "main", head_repository: { full_name: REPOSITORY },
  event: "workflow_dispatch", display_title: EXTERNAL_RUN_NAME, created_at: new Date(at).toISOString(), ...extra });
const history = (runs = [], count = runs.length) => Response.json({ workflow_runs: runs, total_count: count });

function transport(responses) {
  const calls = [];
  const fetcher = async (...args) => {
    calls.push(args);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error("Unexpected extra request");
    return next;
  };
  return { calls, fetcher };
}

test("disabled configuration and public HTTP handler cannot dispatch", async () => {
  const fake = transport([]);
  assert.equal((await runScheduler(event, {}, fake.fetcher, at)).status, "disabled");
  assert.equal((await worker.fetch(new Request("https://example.invalid/run"), env)).status, 404);
  assert.equal(fake.calls.length, 0);
});

test("fixed main workflow, explicit opt-in, no forced sources, protected credential transport", async () => {
  for (const status of [200, 204]) {
    const fake = transport([history(), new Response(null, { status })]);
    assert.equal((await runScheduler(event, env, fake.fetcher, at)).status, "dispatched");
    assert.equal(fake.calls.length, 2);
    for (const [url, options] of fake.calls) {
      assert.equal(new URL(url).origin, "https://api.github.com");
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
    }
    const [url, options] = fake.calls[1];
    assert.equal(url, `https://api.github.com/repos/${REPOSITORY}/actions/workflows/catalogue-daily.yml/dispatches`);
    assert.deepEqual(JSON.parse(options.body), { ref:"main", inputs:{ automated_daily:true,
      force_supported_sources:false, publish_validated_data:true } });
  }
});

test("existing native/external runs of every status suppress the second timer", async () => {
  for (const status of ["queued", "in_progress", "completed"]) {
    for (const eventName of ["schedule", "workflow_dispatch"]) {
      const fake = transport([history([run({ status, event:eventName, conclusion:"failure" })])]);
      assert.equal((await runScheduler(event, env, fake.fetcher, at)).status, "already_triggered");
      assert.equal(fake.calls.length, 1);
    }
  }
});

test("manual audit, other repository/branch and yesterday do not suppress today's dispatch", async () => {
  const cases = [run({display_title:"FundLenz daily catalogue"}), run({head_branch:"feature"}),
    run({head_repository:{full_name:"someone/else"}}), run({created_at:"2026-10-14T03:47:00Z"})];
  for (const item of cases) {
    const fake = transport([history([item]), new Response(null, {status:204})]);
    assert.equal((await runScheduler(event, env, fake.fetcher, at)).status, "dispatched");
  }
});

test("invalid events and missing credential fail before any network request", async () => {
  for (const [input, config, clock] of [
    [{...event, cron:"* * * * *"}, env, at],
    [{...event, scheduledTime:NaN}, env, at],
    [event, env, at - 1],
    [event, env, at + 24*3600_000],
    [event, {SCHEDULER_ENABLED:"true"}, at],
  ]) {
    const fake = transport([]);
    await assert.rejects(runScheduler(input, config, fake.fetcher, clock));
    assert.equal(fake.calls.length, 0);
  }
  assert.equal(indiaDate(Date.parse("2026-10-14T18:30:00Z")), "2026-10-15");
});

test("truncated history and provider errors fail closed without POST or credential leakage", async () => {
  for (const reply of [history([],100), Response.json({}), new Response("invalid"),
    new Response("private provider body",{status:401}), new Response("private provider body",{status:429}),
    new Error("fictional-test-token")]) {
    const fake = transport([reply]);
    await assert.rejects(runScheduler(event,env,fake.fetcher,at), error => {
      assert.ok(!error.message.includes("fictional-test-token"));
      assert.ok(!error.message.includes("private provider body"));
      return true;
    });
    assert.equal(fake.calls.length,1);
  }
});

test("ambiguous POST failures are never automatically retried", async () => {
  for (const failure of [new Error("timeout"),new Response(null,{status:503})]) {
    const fake=transport([history(),failure]);
    await assert.rejects(runScheduler(event,env,fake.fetcher,at));
    assert.equal(fake.calls.length,2);
    assert.equal(fake.calls.filter(([,options])=>options.method==="POST").length,1);
  }
});

test("default transport preserves the runtime fetch receiver", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async function () {
    assert.equal(this, globalThis);
    calls++;
    return history([run()]);
  };
  try {
    assert.equal((await runScheduler(event, env, undefined, at)).status, "already_triggered");
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("transport diagnostics classify errors without leaking exception text", async () => {
  for (const [name, label] of [["TimeoutError", "timeout"], ["AbortError", "aborted"],
    ["TypeError", "type_error"], ["fictional-test-token", "network_or_runtime_error"]]) {
    const error = new Error("fictional-test-token");
    error.name = name;
    const fake = transport([error]);
    await assert.rejects(runScheduler(event, env, fake.fetcher, at), failure => {
      assert.ok(failure.message.includes(`(${label})`));
      assert.ok(!failure.message.includes("fictional-test-token"));
      return true;
    });
    assert.equal(fake.calls.length, 1);
  }
});

test("scheduler config stays isolated and inert until explicit activation", () => {
  const config=JSON.parse(readFileSync(new URL("../../../wrangler.catalogue-scheduler.jsonc",import.meta.url),"utf8"));
  assert.equal(config.name,"fundlenz-catalogue-scheduler");
  assert.equal(config.vars.SCHEDULER_ENABLED,"false");
  assert.equal(config.workers_dev,false);
  assert.equal(config.preview_urls,false);
  assert.deepEqual(config.triggers.crons,CRONS);
  for (const key of ["routes","d1_databases","assets","kv_namespaces"]) assert.equal(config[key],undefined);
});

