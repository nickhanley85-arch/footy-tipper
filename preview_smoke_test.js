const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const prototypePath = path.join(__dirname, "index.html");
const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

const chromePath = chromePaths.find((candidate) => fs.existsSync(candidate));
if (!chromePath) {
  console.error("No supported Chrome/Edge executable found.");
  process.exit(1);
}

const prototypeHtml = fs.readFileSync(prototypePath, "utf8");
const matchesJson = fs.readFileSync(path.join(__dirname, "data", "matches.json"), "utf8");
const matchesPayload = JSON.stringify(JSON.parse(matchesJson));
const rootUrl = `file:///${__dirname.replace(/\\/g, "/")}`;
const normalizedHtml = prototypeHtml
  .replace(/href="\.\//g, `href="${rootUrl}/`)
  .replace(/src="\.\//g, `src="${rootUrl}/`);
const fetchMockScript = `<script>window.fetch = async () => ({ ok: true, status: 200, json: async () => (${matchesPayload}) });<\/script>`;
const hydratedHtml = normalizedHtml.replace(`<script src="${rootUrl}/app.js"></script>`, `${fetchMockScript}<script src="${rootUrl}/app.js"></script>`);

const testScript = `
  <script>
    function previewText(selector) {
      const node = document.querySelector(selector);
      return node ? node.textContent.trim() : null;
    }

    function previewClick(selector) {
      const node = document.querySelector(selector);
      if (!node) {
        throw new Error("Missing selector: " + selector);
      }
      node.click();
      return node;
    }

    function previewWait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function waitFor(predicate, timeoutMs = 2000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (predicate()) {
          return true;
        }
        await previewWait(25);
      }
      return false;
    }

    window.addEventListener("load", async () => {
      const results = [];

      function check(name, condition, detail) {
        results.push({ name, pass: Boolean(condition), detail });
      }

      try {
        await waitFor(() => document.querySelectorAll(".match-card").length === 9);

        check(
          "initial match detail",
          previewText("#selectedMatchPill") === "Selected match: Bulldogs vs GWS",
          previewText("#selectedMatchPill")
        );

        check(
          "full round count",
          previewText("#gamesCount") === "9" && document.querySelectorAll(".match-card").length === 9,
          JSON.stringify({
            gamesCount: previewText("#gamesCount"),
            cards: document.querySelectorAll(".match-card").length
          })
        );

        previewClick('[data-match="carlton-richmond"] .select-match');
        await previewWait(10);
        check(
          "card selection updates detail",
          previewText("#metricWinner") === "Carlton",
          previewText("#metricWinner")
        );
        check(
          "model breakdown renders",
          previewText("#modelBreakdownSummary") && previewText("#modelBreakdownSummary").includes("Total edge"),
          previewText("#modelBreakdownSummary")
        );

        const search = document.querySelector("#matchSearch");
        search.value = "Marvel";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        await previewWait(10);
        const visibleAfterSearch = [...document.querySelectorAll(".match-card:not(.hidden)")].map((n) => n.dataset.match);
        check(
          "search filters matches",
          JSON.stringify(visibleAfterSearch) === JSON.stringify([
            "bulldogs-gws",
            "essendon-hawthorn",
            "st-kilda-fremantle"
          ]),
          visibleAfterSearch.join(",")
        );

        previewClick('#primaryFilters [data-filter="sort-confidence"]');
        search.value = "";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        await previewWait(10);
        const firstVisibleSorted = document.querySelector(".match-card:not(.hidden)");
        check(
          "sort by confidence",
          firstVisibleSorted && firstVisibleSorted.dataset.match === "gold-coast-west-coast",
          firstVisibleSorted ? firstVisibleSorted.dataset.match : "none"
        );

        previewClick('#primaryFilters [data-filter="injury"]');
        await previewWait(10);
        const visibleAfterInjury = [...document.querySelectorAll(".match-card:not(.hidden)")].map((n) => n.dataset.match);
        check(
          "injury filter",
          JSON.stringify(visibleAfterInjury) === JSON.stringify([
            "bulldogs-gws",
            "brisbane-geelong",
            "port-adelaide-adelaide"
          ]),
          visibleAfterInjury.join(",")
        );

        previewClick('[data-match="bulldogs-gws"] .select-match');
        await previewWait(10);
        check(
          "reselect bulldogs",
          previewText("#selectedMatchPill") === "Selected match: Bulldogs vs GWS",
          previewText("#selectedMatchPill")
        );
        previewClick('#tabBar [data-tab="injuries-tab"]');
        await previewWait(10);
        check(
          "tab switching",
          document.querySelector("#injuries-tab").classList.contains("active"),
          document.querySelector("#injuries-tab").className
        );

        previewClick("#lateOutToggle");
        await previewWait(10);
        check(
          "late out winner flip",
          previewText("#metricWinner") === "Bulldogs",
          previewText("#metricWinner")
        );
        check(
          "late out banner visible",
          getComputedStyle(document.querySelector("#lateOutBanner")).display !== "none",
          getComputedStyle(document.querySelector("#lateOutBanner")).display
        );

        const reasoningBefore = [...document.querySelectorAll(".match-card .reason-list")].map((n) => n.className);
        previewClick('#primaryFilters [data-filter="reasoning"]');
        await previewWait(10);
        const reasoningAfter = [...document.querySelectorAll(".match-card .reason-list")].map((n) => n.className);
        check(
          "reasoning chip changes UI",
          JSON.stringify(reasoningBefore) !== JSON.stringify(reasoningAfter),
          JSON.stringify({ reasoningBefore, reasoningAfter })
        );

        const secondaryBefore = [...document.querySelectorAll("#secondaryFilters .chip")].map((n) => n.className);
        previewClick('#secondaryFilters [data-secondary="venues"]');
        await previewWait(10);
        const secondaryAfter = [...document.querySelectorAll("#secondaryFilters .chip")].map((n) => n.className);
        check(
          "secondary chips update state",
          JSON.stringify(secondaryBefore) !== JSON.stringify(secondaryAfter),
          JSON.stringify({ secondaryBefore, secondaryAfter })
        );
      } catch (error) {
        results.push({ name: "runner error", pass: false, detail: error.message });
      }

      const pre = document.createElement("pre");
      pre.id = "results";
      pre.textContent = JSON.stringify(results, null, 2);
      document.body.appendChild(pre);
    });
  <\/script>
</body>`;

const runnerHtml = hydratedHtml.replace("</body>", testScript);
const runnerPath = path.join(os.tmpdir(), `footy-preview-runner-${Date.now()}.html`);
fs.writeFileSync(runnerPath, runnerHtml, "utf8");

const browser = spawnSync(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=8000",
    "--dump-dom",
    `file:///${runnerPath.replace(/\\/g, "/")}`
  ],
  { encoding: "utf8", maxBuffer: 1024 * 1024 * 10 }
);

if (browser.error) {
  console.error(browser.error.message);
  process.exit(1);
}

if (browser.status !== 0) {
  console.error(browser.stderr || browser.stdout);
  process.exit(browser.status || 1);
}

const match = browser.stdout.match(/<pre id="results">([\s\S]*?)<\/pre>/);
if (!match) {
  console.error("Could not find test results in browser output.");
  console.error(browser.stdout.slice(-4000));
  console.error(browser.stderr);
  process.exit(1);
}

const decoded = match[1]
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">");

console.log(decoded);
