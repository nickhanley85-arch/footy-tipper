let matchData = {};
let cards = [];

const confidenceRank = { high: 3, medium: 2, low: 1 };
const defaultMatchId = "bulldogs-gws";

const state = {
  activeFilter: "all",
  secondaryFilter: "round-2",
  search: "",
  selectedMatchId: defaultMatchId,
  lateOutActive: false,
  showFullReasoning: false
};

const matchesList = document.getElementById("matchesList");
const emptyState = document.getElementById("emptyState");
const matchSearch = document.getElementById("matchSearch");
const selectedMatchPill = document.getElementById("selectedMatchPill");
const detailUpdatedPill = document.getElementById("detailUpdatedPill");
const lateOutBanner = document.getElementById("lateOutBanner");
const gamesCount = document.getElementById("gamesCount");
const highConfidenceCount = document.getElementById("highConfidenceCount");
const upsetCount = document.getElementById("upsetCount");
const lastUpdatedBtn = document.getElementById("lastUpdatedBtn");
const lateOutToggle = document.getElementById("lateOutToggle");
const injuryRefreshBtn = document.getElementById("injuryRefreshBtn");
const mobileSectionNav = document.getElementById("mobileSectionNav");
const sideNavLinks = Array.from(document.querySelectorAll("#sideNav a"));
const secondaryFilterChips = Array.from(document.querySelectorAll("#secondaryFilters .chip"));

function getAllMatches() {
  return Object.values(matchData);
}

async function loadMatchData() {
  const response = await fetch("./data/matches.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load match data (${response.status})`);
  }

  const data = await response.json();
  const matches = Array.isArray(data.matches) ? data.matches : [];
  matchData = Object.fromEntries(matches.map((match) => [match.id, match]));
}

function getMatchView(matchId) {
  const base = matchData[matchId];
  if (!base) {
    return null;
  }

  if (state.lateOutActive && base.lateOut && matchId === state.selectedMatchId) {
    return { ...base, ...base.lateOut };
  }

  return base;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function setList(id, items) {
  const list = document.getElementById(id);
  if (!list) {
    return;
  }

  list.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
}

function renderStats(stats) {
  const [row1, row2, row3] = stats;
  setText("statLabel1Left", row1[0]);
  setText("statValue1Left", row1[1]);
  setText("statLabel1Right", row1[2]);
  setText("statValue1Right", row1[3]);
  setText("statLabel2Left", row2[0]);
  setText("statValue2Left", row2[1]);
  setText("statLabel2Right", row2[2]);
  setText("statValue2Right", row2[3]);
  setText("statLabel3Left", row3[0]);
  setText("statValue3Left", row3[1]);
  setText("statLabel3Right", row3[2]);
  setText("statValue3Right", row3[3]);
}

function createMatchCard(match) {
  const reasonItems = match.reasons.slice(0, 3).map((reason) => `<li>${reason}</li>`).join("");
  const confidenceClass = match.confidence.toLowerCase();
  const isSelected = match.id === state.selectedMatchId;
  const selectedClass = isSelected ? " highlight" : "";
  const buttonClass = isSelected ? "btn primary select-match" : "btn select-match";
  const buttonLabel = isSelected ? "Selected" : "Open detail";

  return `
    <article
      class="match-card${selectedClass}"
      data-match="${match.id}"
      data-home="${match.home}"
      data-away="${match.away}"
      data-venue="${match.venue}"
      data-confidence="${confidenceClass}"
      data-injury="${match.injury}"
      data-upset="${String(match.upset)}"
      data-updated="${String(match.updated)}"
    >
      <div class="match-main">
        <div class="match-fixture">${match.title}</div>
        <div class="match-meta">${match.venue} • ${match.schedule}</div>
        <ul class="reason-list compact">
          ${reasonItems}
        </ul>
      </div>
      <div class="tip-block">
        <strong>Tip: ${match.winner}</strong>
        <span>Win probability ${match.probability}</span>
      </div>
      <div>
        <div class="confidence ${confidenceClass}">${match.confidence}</div>
        <div class="tiny">Margin ${match.margin}</div>
      </div>
      <div>
        <strong>Injury impact</strong>
        <div class="tiny">${match.injury.charAt(0).toUpperCase() + match.injury.slice(1)}</div>
      </div>
      <div>
        <button class="${buttonClass}">${buttonLabel}</button>
      </div>
    </article>
  `;
}

function renderMatchCards() {
  matchesList.innerHTML = getAllMatches().map(createMatchCard).join("");
  cards = Array.from(document.querySelectorAll(".match-card"));
  updateReasoningVisibility();
}

function updateSelectedCardStyles() {
  cards.forEach((card) => {
    const isSelected = card.dataset.match === state.selectedMatchId;
    card.classList.toggle("highlight", isSelected);

    const button = card.querySelector(".select-match");
    if (!button) {
      return;
    }

    button.textContent = isSelected ? "Selected" : "Open detail";
    button.classList.toggle("primary", isSelected);
  });
}

function updateReasoningVisibility() {
  document.querySelectorAll(".match-card .reason-list").forEach((list) => {
    list.classList.toggle("compact", !state.showFullReasoning);
  });
}

function renderRoundSummary() {
  gamesCount.textContent = String(cards.length);
  highConfidenceCount.textContent = String(cards.filter((card) => card.dataset.confidence === "high").length);
  upsetCount.textContent = String(cards.filter((card) => card.dataset.upset === "true").length);
}

function renderMatchDetail() {
  const match = getMatchView(state.selectedMatchId);
  if (!match) {
    return;
  }

  selectedMatchPill.textContent = `Selected match: ${match.title}`;
  detailUpdatedPill.textContent = state.lateOutActive && match.lateOut ? "Last updated 5:58 PM" : "Last updated 5:42 PM";

  setText("metricWinner", match.winner);
  setText("metricProbability", match.probability);
  setText("metricConfidence", match.confidence);
  setText("metricMargin", match.margin);
  setText("overviewReasonsTitle", `Top reasons for ${match.winner}`);
  setList("overviewReasons", match.reasons);
  setList("tipChangeList", match.changes);
  setText("summaryHome", match.summaryHome);
  setText("summaryAway", match.summaryAway);
  setText("summaryModel", match.summaryModel);
  setText("injuryHomeTitle", match.injuryHomeTitle);
  setText("injuryHomeText", match.injuryHomeText);
  setText("injuryAwayTitle", match.injuryAwayTitle);
  setText("injuryAwayText", match.injuryAwayText);
  setText("injuryModelText", match.injuryModelText);
  renderStats(match.stats);

  const showLateOutBanner = state.lateOutActive && Boolean(match.lateOut);
  lateOutBanner.style.display = showLateOutBanner ? "flex" : "none";

  updateSelectedCardStyles();
}

function matchesFilter(card) {
  const query = state.search.trim().toLowerCase();
  const haystack = [card.dataset.home, card.dataset.away, card.dataset.venue].join(" ").toLowerCase();
  const queryMatch = !query || haystack.includes(query);

  let filterMatch = true;
  if (state.activeFilter === "injury") {
    filterMatch = card.dataset.injury === "high";
  } else if (state.activeFilter === "upset") {
    filterMatch = card.dataset.upset === "true";
  }

  let secondaryMatch = true;
  if (state.secondaryFilter === "updated") {
    secondaryMatch = card.dataset.updated === "true";
  }

  return queryMatch && filterMatch && secondaryMatch;
}

function applySortIfNeeded(visibleCards) {
  if (state.activeFilter === "sort-confidence") {
    visibleCards.sort((a, b) => {
      const aRank = confidenceRank[a.dataset.confidence] || 0;
      const bRank = confidenceRank[b.dataset.confidence] || 0;
      return bRank - aRank;
    });
  }

  if (state.secondaryFilter === "venues") {
    visibleCards.sort((a, b) => a.dataset.venue.localeCompare(b.dataset.venue));
  }

  visibleCards.forEach((card) => matchesList.appendChild(card));
}

function renderMatches() {
  const visibleCards = cards.filter(matchesFilter);

  cards.forEach((card) => {
    card.classList.toggle("hidden", !visibleCards.includes(card));
  });

  applySortIfNeeded(visibleCards);
  updateReasoningVisibility();
  emptyState.style.display = visibleCards.length ? "none" : "block";
}

function setActiveFilterChip(filter) {
  document.querySelectorAll("#primaryFilters .chip").forEach((chip) => {
    if (chip.dataset.filter === "reasoning") {
      chip.classList.toggle("active", state.showFullReasoning);
      return;
    }

    chip.classList.toggle("active", chip.dataset.filter === filter);
  });
}

function setSecondaryFilterChip(filter) {
  secondaryFilterChips.forEach((chip) => {
    chip.classList.toggle("secondary-active", chip.dataset.secondary === filter);
  });
}

function setActiveTab(tabId) {
  document.querySelectorAll("#tabBar .tab[data-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function refreshTimestamp() {
  const now = new Date();
  const label = now.toLocaleTimeString("en-AU", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  });

  lastUpdatedBtn.textContent = `Last updated: ${label}`;
  detailUpdatedPill.textContent = `Last updated ${now.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit"
  })}`;
}

function updateNavState() {
  const sections = sideNavLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const current = sections.find((section) => {
    const rect = section.getBoundingClientRect();
    return rect.top <= 140 && rect.bottom >= 140;
  }) || sections[0];

  if (!current) {
    return;
  }

  sideNavLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${current.id}`);
  });

  if (mobileSectionNav) {
    mobileSectionNav.value = current.id;
  }
}

function bindEvents() {
  document.querySelectorAll("#primaryFilters .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (chip.dataset.filter === "reasoning") {
        state.showFullReasoning = !state.showFullReasoning;
        setActiveFilterChip(state.activeFilter);
        renderMatches();
        return;
      }

      state.activeFilter = chip.dataset.filter;
      setActiveFilterChip(state.activeFilter);
      renderMatches();
    });
  });

  secondaryFilterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.secondaryFilter = chip.dataset.secondary;
      setSecondaryFilterChip(state.secondaryFilter);
      renderMatches();
    });
  });

  matchesList.addEventListener("click", (event) => {
    const button = event.target.closest(".select-match");
    if (!button) {
      return;
    }

    const card = button.closest(".match-card");
    if (!card) {
      return;
    }

    state.selectedMatchId = card.dataset.match;
    renderMatchDetail();
    location.hash = "match-detail";
  });

  matchSearch.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderMatches();
  });

  document.querySelectorAll("#tabBar .tab[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.tab);
    });
  });

  lateOutToggle.addEventListener("click", () => {
    state.lateOutActive = !state.lateOutActive;
    lateOutToggle.textContent = state.lateOutActive ? "Reset late out" : "Simulate late out";
    renderMatchDetail();
  });

  injuryRefreshBtn.addEventListener("click", () => {
    refreshTimestamp();
    injuryRefreshBtn.textContent = "Injury refresh complete";

    window.setTimeout(() => {
      injuryRefreshBtn.textContent = "Injury refresh";
    }, 1800);
  });

  mobileSectionNav.addEventListener("change", (event) => {
    const section = document.getElementById(event.target.value);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  window.addEventListener("scroll", updateNavState, { passive: true });
}

function handleLoadError(error) {
  console.error(error);
  matchesList.innerHTML = "";
  emptyState.style.display = "block";
  emptyState.textContent = "Could not load match data. Check data/matches.json and reload.";
}

async function initApp() {
  try {
    await loadMatchData();

    if (!matchData[state.selectedMatchId]) {
      state.selectedMatchId = getAllMatches()[0]?.id || "";
    }

    renderMatchCards();
    renderMatches();
    renderRoundSummary();
    renderMatchDetail();
    setActiveTab("overview-tab");
    setSecondaryFilterChip(state.secondaryFilter);
    updateNavState();
    lateOutBanner.style.display = "none";
    bindEvents();
  } catch (error) {
    handleLoadError(error);
  }
}

initApp();
