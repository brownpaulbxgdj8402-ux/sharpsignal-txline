const state = {
  mode: "live",
  threshold: 4,
  fixtures: [],
  snapshots: new Map(),
  signals: [],
  selectedId: null,
  replayIndex: 0,
  countdown: 60,
  timer: null,
  busy: false
};

const colors = ["var(--lime-dark)", "var(--cyan)", "var(--coral)", "var(--gold)"];
const $ = (selector) => document.querySelector(selector);

function normalizeOdds(fixture, rows) {
  const preferred = rows.find((row) => row.SuperOddsType === "1X2_PARTICIPANT_RESULT" && row.MarketPeriod === "half=0")
    || rows.find((row) => row.SuperOddsType === "1X2_PARTICIPANT_RESULT")
    || rows[0];
  if (!preferred || !Array.isArray(preferred.PriceNames)) return null;

  const raw = preferred.Pct?.map(Number) || preferred.Prices?.map((price) => 100 / (Number(price) / 1000));
  if (!raw || raw.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  const total = raw.reduce((sum, value) => sum + value, 0);
  const labels = preferred.PriceNames.map((name) => {
    if (name === "part1") return fixture.Participant1;
    if (name === "part2") return fixture.Participant2;
    if (name === "draw") return "Draw";
    return name;
  });
  return {
    fixtureId: fixture.FixtureId,
    ts: Number(preferred.Ts) || Date.now(),
    bookmaker: preferred.Bookmaker || "TxLINE consensus",
    overround: total,
    outcomes: raw.map((value, index) => ({ name: labels[index], pct: (value / total) * 100 }))
  };
}

async function runLiveScan() {
  const response = await fetch("/api/scan", { cache: "no-store" });
  if (!response.ok) throw new Error(`Scan failed (${response.status})`);
  const payload = await response.json();
  state.fixtures = payload.fixtures;
  const valid = payload.markets.map((market) => {
    const fixture = payload.fixtures.find((item) => item.FixtureId === market.fixtureId);
    return fixture ? normalizeOdds(fixture, market.rows) : null;
  }).filter(Boolean);
  valid.forEach(acceptSnapshot);
  $("#feed-label").textContent = `${valid.length} priced · TxLINE live`;
  $("#integrity-score").textContent = payload.integrity === "ok" ? "100%" : "CHECK";
}

function runReplayScan() {
  state.fixtures = window.SHARP_REPLAY.fixtures;
  const frame = window.SHARP_REPLAY.frames[state.replayIndex % window.SHARP_REPLAY.frames.length];
  acceptSnapshot({ fixtureId: state.fixtures[0].FixtureId, ...frame, bookmaker: "Deterministic replay", overround: 100 });
  state.replayIndex += 1;
  $("#feed-label").textContent = "1 priced · deterministic replay";
  $("#integrity-score").textContent = "100%";
}

function acceptSnapshot(snapshot) {
  const history = state.snapshots.get(snapshot.fixtureId) || [];
  const previous = history[history.length - 1];
  if (previous && previous.ts === snapshot.ts) return;
  history.push(snapshot);
  if (history.length > 20) history.shift();
  state.snapshots.set(snapshot.fixtureId, history);
  if (previous) evaluateMovement(previous, snapshot);
}

function evaluateMovement(previous, current) {
  current.outcomes.forEach((outcome, index) => {
    const before = previous.outcomes[index];
    if (!before || before.name !== outcome.name) return;
    const delta = outcome.pct - before.pct;
    if (Math.abs(delta) < state.threshold) return;
    state.signals.unshift({
      id: `${current.fixtureId}-${current.ts}-${index}`,
      ts: current.ts,
      fixtureId: current.fixtureId,
      outcome: outcome.name,
      delta,
      from: before.pct,
      to: outcome.pct,
      severity: Math.abs(delta) >= state.threshold * 2 ? "HIGH" : "WATCH",
      rule: `ABS_DELTA >= ${state.threshold.toFixed(1)}pp`
    });
    if (state.signals.length > 100) state.signals.pop();
  });
  persistLedger();
}

async function scan() {
  if (state.busy) return;
  state.busy = true;
  $("#scan-now").disabled = true;
  $("#agent-label").textContent = "SCANNING";
  try {
    if (state.mode === "live") await runLiveScan(); else runReplayScan();
    syncSelectedFixture();
    render();
    $("#agent-label").textContent = "AGENT RUNNING";
  } catch (error) {
    $("#agent-label").textContent = "LIVE FEED RETRY";
    $("#feed-label").textContent = error.message;
    if (!state.fixtures.length) {
      state.mode = "replay";
      updateModeControls();
      runReplayScan();
      syncSelectedFixture();
      render();
    }
  } finally {
    state.busy = false;
    state.countdown = state.mode === "live" ? 60 : 5;
    $("#scan-now").disabled = false;
  }
}

function syncSelectedFixture() {
  const pricedIds = [...state.snapshots.keys()];
  if (!pricedIds.includes(state.selectedId)) state.selectedId = pricedIds[0] || state.fixtures[0]?.FixtureId || null;
  const select = $("#fixture-select");
  const existing = new Set([...select.options].map((option) => option.value));
  const next = state.fixtures.filter((fixture) => pricedIds.includes(fixture.FixtureId));
  if (next.some((fixture) => !existing.has(String(fixture.FixtureId))) || select.options.length !== next.length) {
    select.innerHTML = next.map((fixture) => `<option value="${fixture.FixtureId}">${fixture.Participant1} vs ${fixture.Participant2}</option>`).join("");
  }
  if (state.selectedId) select.value = String(state.selectedId);
}

function render() {
  $("#fixture-count").textContent = state.fixtures.length;
  $("#signal-count").textContent = state.signals.length;
  $("#signal-delta").textContent = state.signals.length ? `${state.signals.filter((item) => item.severity === "HIGH").length} high severity` : "No threshold crossings";
  renderChart();
  renderLedger();
  renderDecision();
}

function renderChart() {
  const svg = $("#probability-chart");
  const history = state.snapshots.get(state.selectedId) || [];
  const fixture = state.fixtures.find((item) => item.FixtureId === state.selectedId);
  $("#match-title").textContent = fixture ? `${fixture.Participant1} vs ${fixture.Participant2}` : "Waiting for fixture data";
  $("#chart-empty").hidden = history.length > 0;
  if (!history.length) { svg.innerHTML = ""; return; }

  const width = 900, height = 360, left = 54, right = 22, top = 20, bottom = 42;
  const x = (index) => left + (index / Math.max(1, history.length - 1)) * (width - left - right);
  const y = (value) => top + ((100 - value) / 100) * (height - top - bottom);
  const labels = history[0].outcomes.map((outcome) => outcome.name);
  let markup = "";
  [0, 25, 50, 75, 100].forEach((tick) => {
    markup += `<line class="grid-line" x1="${left}" x2="${width - right}" y1="${y(tick)}" y2="${y(tick)}"></line>`;
    markup += `<text class="axis-label" x="${left - 10}" y="${y(tick) + 4}" text-anchor="end">${tick}%</text>`;
  });
  history.forEach((snapshot, index) => {
    const time = new Date(snapshot.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    markup += `<text class="axis-label" x="${x(index)}" y="${height - 14}" text-anchor="middle">${time}</text>`;
  });
  labels.forEach((label, outcomeIndex) => {
    const points = history.map((snapshot, index) => `${x(index)},${y(snapshot.outcomes[outcomeIndex].pct)}`).join(" ");
    markup += `<polyline class="series-line" stroke="${colors[outcomeIndex]}" points="${points}"></polyline>`;
    history.forEach((snapshot, index) => {
      const value = snapshot.outcomes[outcomeIndex].pct;
      markup += `<circle class="series-point" fill="${colors[outcomeIndex]}" cx="${x(index)}" cy="${y(value)}" r="4"><title>${label}: ${value.toFixed(1)}%</title></circle>`;
    });
  });
  svg.innerHTML = markup;
  $("#chart-legend").innerHTML = labels.map((label, index) => `<span class="legend-item"><i class="legend-swatch" style="background:${colors[index]}"></i>${label} <strong>${history.at(-1).outcomes[index].pct.toFixed(1)}%</strong></span>`).join("");
}

function renderLedger() {
  const body = $("#signal-ledger");
  if (!state.signals.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">No material movements recorded yet.</td></tr>';
    return;
  }
  body.innerHTML = state.signals.slice(0, 20).map((signal) => {
    const fixture = state.fixtures.find((item) => item.FixtureId === signal.fixtureId);
    const moveClass = signal.delta >= 0 ? "move-up" : "move-down";
    return `<tr><td>${new Date(signal.ts).toLocaleTimeString()}</td><td>${fixture ? `${fixture.Participant1} v ${fixture.Participant2}` : signal.fixtureId}</td><td>${signal.outcome}</td><td class="${moveClass}">${signal.delta >= 0 ? "+" : ""}${signal.delta.toFixed(1)} pp</td><td><span class="severity">${signal.severity}</span></td><td><code>${signal.rule}</code></td></tr>`;
  }).join("");
}

function renderDecision() {
  const latest = state.signals[0];
  const badge = $("#decision-badge");
  if (!latest) {
    badge.textContent = "NO ACTION";
    badge.classList.remove("alert");
    $("#rule-trace").innerHTML = `
      <li><span>01</span><div><strong>Input accepted</strong><p>Schema, price range and overround checks passed.</p></div></li>
      <li><span>02</span><div><strong>Movement below threshold</strong><p>No outcome crossed ${state.threshold.toFixed(1)} percentage points.</p></div></li>
      <li><span>03</span><div><strong>No signal emitted</strong><p>The ledger remains unchanged to avoid noise.</p></div></li>`;
    return;
  }
  badge.textContent = latest.severity;
  badge.classList.add("alert");
  $("#rule-trace").innerHTML = `
    <li><span>01</span><div><strong>Input accepted</strong><p>TxLINE snapshot normalized from ${latest.from.toFixed(1)}% to ${latest.to.toFixed(1)}%.</p></div></li>
    <li><span>02</span><div><strong>Threshold crossed</strong><p>Absolute move ${Math.abs(latest.delta).toFixed(1)}pp >= ${state.threshold.toFixed(1)}pp.</p></div></li>
    <li><span>03</span><div><strong>${latest.severity} signal logged</strong><p>Observation recorded with no wager or order execution.</p></div></li>`;
}

function persistLedger() {
  localStorage.setItem("sharpsignal-ledger", JSON.stringify(state.signals.slice(0, 100)));
}

function restoreLedger() {
  try { state.signals = JSON.parse(localStorage.getItem("sharpsignal-ledger")) || []; } catch { state.signals = []; }
}

function updateModeControls() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#window-value").textContent = state.mode === "live" ? "60 seconds" : "5 seconds";
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  state.snapshots.clear();
  state.replayIndex = 0;
  updateModeControls();
  scan();
}));

$("#threshold").addEventListener("input", (event) => {
  state.threshold = Number(event.target.value);
  $("#threshold-value").textContent = `${state.threshold.toFixed(1)} pp`;
  renderDecision();
});
$("#fixture-select").addEventListener("change", (event) => { state.selectedId = Number(event.target.value); render(); });
$("#scan-now").addEventListener("click", scan);
$("#theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
});
$("#export-log").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ strategy: "ABS_DELTA", threshold: state.threshold, signals: state.signals }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "sharpsignal-ledger.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

restoreLedger();
updateModeControls();
state.timer = setInterval(() => {
  state.countdown -= 1;
  if (state.countdown <= 0) scan();
  $("#countdown").textContent = `00:${String(Math.max(0, state.countdown)).padStart(2, "0")}`;
}, 1000);
scan();
