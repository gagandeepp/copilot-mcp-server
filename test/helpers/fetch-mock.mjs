// Preloaded into the server process (node --import) to replace fetch with a scripted GitHub and a scripted
// signed-download host. No network is ever used.
//
// Environment:
//   MOCK_SCENARIO    which organizations /user/orgs returns: basic (default), classify, clean, escaping, none
//   MOCK_STATS       file the mock writes its request log and counters to (the test reads it back)
//   MOCK_TIMEOUT_MS  shrink the client's 30 s request timeout to this many ms (only for the timeout test)
//
// Everything below /user/orgs is keyed by the org login, so one mock serves every test file.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FIXTURES = new URL("../fixtures/", import.meta.url);
const stats = { requests: [], inflight: 0, maxInflight: 0, aborted: [], bigStreamPulled: 0 };
const save = () => {
    if (process.env.MOCK_STATS) writeFileSync(process.env.MOCK_STATS, JSON.stringify(stats));
};

if (process.env.MOCK_TIMEOUT_MS) {
    // AbortSignal.timeout timers are unref'd; the stdio server stays alive on its open stdin, so the shortened timeout still fires.
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    AbortSignal.timeout = () => realTimeout(Number(process.env.MOCK_TIMEOUT_MS));
}

const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const sleep = (ms, signal) =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(signal.reason);
        });
    });
const MB = 1024 * 1024;

// ---------------------------------------------------------------------------------------------------------------
// /user/orgs
// ---------------------------------------------------------------------------------------------------------------
const org = (id, login, description = null) => ({ id, login, description, url: `https://api.github.com/orgs/${login}` });

const ORGS = {
    basic: [org(1, "acme", "Acme Corp"), org(2, "globex"), org(3, "initech", "Initech - TPS reports")],
    // Phase 4 classification: successes, then skipped, then failed, each group in this order.
    classify: ["ok-1", "nocop", "ok-2", "owner", "rl403", "ok-3", "rl429", "ok-4", "err502", "ok-5", "net", "ok-6"].map((login, i) => org(i, login)),
    clean: [org(1, "ok-1"), org(2, "ok-2")],
    // User-controlled strings with table-breaking characters.
    escaping: [org(10, "pipe-org", "Has a | pipe\nand a newline"), org(11, "plain-org", "Plain description")],
    none: [],
};

// ---------------------------------------------------------------------------------------------------------------
// Copilot billing
// ---------------------------------------------------------------------------------------------------------------
const billing = (total, active, extra = {}) => ({
    seat_breakdown: {
        total,
        added_this_cycle: 0,
        pending_cancellation: 0,
        pending_invitation: 0,
        active_this_cycle: active,
        inactive_this_cycle: total - active,
        ...extra,
    },
    seat_management_setting: "assign_selected",
    public_code_suggestions: "block",
    ide_chat: "enabled",
    platform_chat: "enabled",
    cli: "enabled",
    plan_type: "business",
});

async function billingResponse(login, signal) {
    stats.inflight++;
    stats.maxInflight = Math.max(stats.maxInflight, stats.inflight);
    save();
    try {
        await sleep(80, signal); // long enough for concurrent requests to overlap
        if (login.startsWith("ok-")) return json(200, billing(10, 6));
        if (login === "acme") {
            return json(200, billing(25, 20, { added_this_cycle: 3, pending_cancellation: 2, pending_invitation: 1 }));
        }
        if (login === "globex") return json(200, { ...billing(8, 3), plan_type: "enterprise", seat_management_setting: "assign_all", public_code_suggestions: "allow", cli: "disabled" });
        if (login === "pipe-org") return json(200, { ...billing(4, 1), plan_type: "bus|iness" });
        if (login === "plain-org") return json(200, billing(2, 2));
        if (login === "nocop" || login === "initech") return json(404, { message: "Not Found" });
        if (login === "owner") return json(403, { message: "Must be an org owner" });
        if (login === "rl403") {
            return json(403, { message: "API rate limit exceeded" }, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1795000000" });
        }
        if (login === "rl429") return json(429, { message: "slow down" }, { "retry-after": "30" });
        if (login === "err502") return json(502, { message: "Bad gateway" });
        if (login === "net") throw new TypeError("fetch failed");
        return json(404, { message: "Not Found" });
    } finally {
        stats.inflight--;
        save();
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Copilot seats
// ---------------------------------------------------------------------------------------------------------------
const seat = (login, overrides = {}) => ({
    assignee: { login, id: 1, avatar_url: "", type: "User" },
    assigning_team: null,
    created_at: "2026-01-01T00:00:00Z",
    last_activity_at: "2026-11-01T00:00:00Z",
    last_activity_editor: "vscode",
    last_authenticated_at: null,
    pending_cancellation_date: null,
    plan_type: "business",
    ...overrides,
});

async function seatsResponse(login, signal, url) {
    if (login === "hang") {
        try {
            await sleep(60_000, signal);
        } catch (err) {
            stats.aborted.push(url.pathname);
            save();
            throw err;
        }
    }
    if (login === "acme") {
        return json(200, {
            total_seats: 250,
            seats: [
                seat("alice", {
                    assigning_team: { id: 7, name: "Platform" },
                    last_authenticated_at: "2026-11-18T09:00:00Z",
                    last_activity_editor: "vscode/1.99.0/copilot-chat/0.26.0",
                    pending_cancellation_date: "2026-12-01",
                }),
                seat("bob", { last_activity_at: null, last_activity_editor: null, plan_type: "enterprise" }),
            ],
        });
    }
    if (login === "globex") return json(200, { total_seats: 1, seats: [seat("carol", { assigning_team: { id: 8, name: "Data" } })] });
    if (login === "pipe-org") {
        return json(200, {
            total_seats: 1,
            seats: [seat("dave", { assigning_team: { id: 9, name: "Dev|Ops\nTeam" }, last_activity_editor: "vs|code", plan_type: "bus|iness" })],
        });
    }
    if (login === "empty") return json(200, { total_seats: 0, seats: [] });
    if (login === "owner") return json(403, { message: "Must be an org owner" });
    return json(404, { message: "Not Found" });
}

// ---------------------------------------------------------------------------------------------------------------
// Usage-metrics reports: the API hands out signed download links, the download host serves the files.
// ---------------------------------------------------------------------------------------------------------------
const DL = "https://copilot-reports.github.com";

// org -> which download links the reports API hands out (same for the 28-day and the 1-day endpoint)
const LINKS = {
    ok: [`${DL}/org-28-day.ndjson`],
    oneday: [`${DL}/org-1-day.ndjson`],
    multi: [`${DL}/org-28-day.ndjson`, `${DL}/org-28-day-pretty-array.json`],
    nullengage: [`${DL}/org-28-day-null-engagement.ndjson`],
    expired: [`${DL}/expired.ndjson`],
    malformed: [`${DL}/org-1-day-one-malformed-line.ndjson`],
    allbad: [`${DL}/allbad.ndjson`],
    empty: [`${DL}/empty.ndjson`],
    bigcl: [`${DL}/big-cl`],
    bigstream: [`${DL}/big-stream`],
    utf8: [`${DL}/utf8-split`],
    httplink: ["http://copilot-reports.github.com/org-28-day.ndjson"],
    server500: [`${DL}/server500`],
    hang: [`${DL}/hang`],
    nolinks: [],
};

function download(url) {
    const name = url.pathname.slice(1);
    if (name === "expired.ndjson") return new Response("<Error><Code>AuthenticationFailed</Code></Error>", { status: 403 });
    if (name === "server500") return new Response("boom", { status: 500 });
    if (name === "allbad.ndjson") return new Response("not json\n{broken\n[1,2,3]\n", { status: 200 });
    if (name === "empty.ndjson") return new Response("", { status: 200 });
    if (name === "big-cl") return new Response("tiny", { status: 200, headers: { "content-length": String(30 * MB) } });
    if (name === "big-stream") {
        let n = 0;
        return new Response(
            new ReadableStream({
                pull(controller) {
                    if (n >= 60) return controller.close();
                    n++;
                    stats.bigStreamPulled = n;
                    save();
                    controller.enqueue(new Uint8Array(MB).fill(0x20));
                },
            }),
            { status: 200 }
        );
    }
    if (name === "utf8-split") {
        // One 28-day record whose language name has multi-byte characters; the byte stream is cut mid-character.
        const rec = {
            day_totals: [
                {
                    day: "2026-11-19",
                    daily_active_users: 1,
                    totals_by_language_feature: [{ language: "日本語-é-🚀", feature: "code_completion", code_generation_activity_count: 3 }],
                },
            ],
        };
        const bytes = new TextEncoder().encode(JSON.stringify(rec) + "\n");
        let i = 0;
        return new Response(
            new ReadableStream({
                pull(controller) {
                    if (i >= bytes.length) return controller.close();
                    controller.enqueue(bytes.slice(i, i + 7)); // 7-byte chunks split 3- and 4-byte characters
                    i += 7;
                },
            }),
            { status: 200 }
        );
    }
    if (name.startsWith("org-")) {
        const file = new URL(`derived/${name}`, FIXTURES);
        if (!existsSync(file)) return new Response("fixture missing: " + name, { status: 500 });
        return new Response(readFileSync(file, "utf8"), { status: 200, headers: { "content-type": "application/x-ndjson" } });
    }
    return new Response("not found", { status: 404 });
}

function metricsResponse(login, kind, url) {
    const day = url.searchParams.get("day");
    if (kind === "organization-1-day" && !day) return json(422, { message: "Invalid request." });
    if (login === "denied") {
        return json(403, {
            message: "Insufficient permissions. This action requires admin, or relevant organization role access.",
            documentation_url: "https://docs.github.com/rest/copilot/copilot-usage-metrics",
        });
    }
    if (login === "nodata") return new Response(null, { status: 204 });
    if (login === "badenvelope") return json(200, { foo: 1 });
    if (login === "ok" && kind === "organization-1-day") return json(200, { download_links: LINKS.oneday, report_day: day });
    const links = LINKS[login];
    if (!links) return json(404, { message: "Not Found" });
    return json(
        200,
        kind === "organization-1-day"
            ? { download_links: links, report_day: day }
            : { download_links: links, report_start_day: "2026-11-17", report_end_day: "2026-11-19" }
    );
}

// ---------------------------------------------------------------------------------------------------------------
// fetch
// ---------------------------------------------------------------------------------------------------------------
globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    stats.requests.push({ host: url.host, path: url.pathname, search: url.search, headers });
    save();

    if (url.host === "copilot-reports.github.com") {
        if (url.pathname === "/hang") {
            await new Promise((_, reject) =>
                init.signal?.addEventListener("abort", () => {
                    stats.aborted.push("hang");
                    save();
                    reject(init.signal.reason);
                })
            );
        }
        return download(url);
    }
    if (url.host !== "api.github.com") return json(404, { message: "Not Found" });

    if (url.pathname === "/user/orgs") return json(200, ORGS[process.env.MOCK_SCENARIO ?? "basic"] ?? []);

    const metrics = url.pathname.match(/^\/orgs\/([^/]+)\/copilot\/metrics\/reports\/(organization-28-day\/latest|organization-1-day)$/);
    if (metrics) return metricsResponse(metrics[1], metrics[2], url);

    const seats = url.pathname.match(/^\/orgs\/([^/]+)\/copilot\/billing\/seats$/);
    if (seats) return seatsResponse(seats[1], init.signal, url);

    const bill = url.pathname.match(/^\/orgs\/([^/]+)\/copilot\/billing$/);
    if (bill) return billingResponse(bill[1], init.signal);

    return json(404, { message: "Not Found", documentation_url: "https://docs.github.com/rest" });
};
