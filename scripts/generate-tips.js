const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const rawPath = path.join(rootDir, "data", "raw-matches.json");
const outputPath = path.join(rootDir, "data", "matches.json");

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function confidenceFromDiff(diff, injuryImpact) {
  if (Math.abs(diff) >= 16 && injuryImpact <= 3) {
    return "High";
  }
  if (Math.abs(diff) >= 7) {
    return "Medium";
  }
  return "Low";
}

function probabilityFromDiff(diff) {
  const probability = 50 + clamp(Math.round(diff * 1.2), -24, 24);
  return `${probability}%`;
}

function marginFromDiff(diff) {
  const absDiff = Math.abs(diff);
  if (absDiff >= 18) {
    return "20 to 35";
  }
  if (absDiff >= 12) {
    return "18 to 30";
  }
  if (absDiff >= 8) {
    return "8 to 16";
  }
  if (absDiff >= 5) {
    return "10 to 18";
  }
  return "1 to 12";
}

function injuryBand(impact) {
  if (impact >= 8) {
    return "high";
  }
  if (impact >= 4) {
    return "moderate";
  }
  return "low";
}

function scoringCopy(scoringTrend, teamName) {
  switch (scoringTrend) {
    case "rising":
      return `${teamName} scoring profile is trending up.`;
    case "low":
      return `${teamName} is projected into a lower-scoring game script.`;
    case "volatile":
      return `${teamName} projects with more scoring volatility than the rest of the round.`;
    default:
      return `${teamName} scoring trend looks stable.`;
  }
}

function buildStats(match, winner) {
  const { home, away, inputs } = match;
  const homeFormText = `${home} ${inputs.homeForm >= 7 ? "1-0" : "0-1"}`;
  const awayFormText = `${away} ${inputs.awayForm >= 7 ? "1-0" : "0-1"}`;
  const homeScoring = inputs.scoringTrend === "rising" && winner === home ? "Rising" : inputs.scoringTrend === "low" ? "Low" : "Stable";
  const awayScoring = inputs.scoringTrend === "rising" && winner === away ? "Rising" : inputs.scoringTrend === "low" ? "Low" : inputs.scoringTrend === "volatile" ? "Volatile" : "Stable";

  return [
    ["Stoppage edge", `${home} ${inputs.stoppageEdge >= 0 ? "+" : ""}${inputs.stoppageEdge.toFixed(1)}`, "Transition edge", `${away} ${(-inputs.transitionEdge) >= 0 ? "+" : ""}${(-inputs.transitionEdge).toFixed(1)}`],
    ["Recent form", homeFormText, "Recent form", awayFormText],
    ["Scoring trend", homeScoring, "Scoring trend", awayScoring]
  ];
}

function buildReasons(match, winner, loser, diff) {
  const { home, away, venue, inputs } = match;
  const venueTeam = diff >= 0 ? home : away;
  const reasons = [];

  reasons.push(`${winner} rates better on combined team strength and current form.`);

  if (Math.abs(inputs.stoppageEdge) >= 1) {
    const team = inputs.stoppageEdge >= 0 ? home : away;
    reasons.push(`${team} carries the clearer stoppage edge, which shapes territory and first use.`);
  }

  if (Math.abs(inputs.transitionEdge) >= 1) {
    const team = inputs.transitionEdge >= 0 ? home : away;
    reasons.push(`${team} looks cleaner in transition, which matters in this matchup.`);
  }

  reasons.push(`${venueTeam} gets the stronger venue profile at ${venue}.`);

  if (inputs.injuryImpact >= 7) {
    reasons.push("Confidence is reduced because final teams could materially change the balance.");
  } else {
    reasons.push(scoringCopy(inputs.scoringTrend, winner));
  }

  return reasons.slice(0, 4);
}

function buildChanges(match, winner, loser) {
  const { home, away, inputs } = match;
  return [
    `A major late out for ${winner} would tighten the tip quickly.`,
    `If ${loser} improves its contest exits, the margin band narrows sharply.`,
    inputs.injuryImpact >= 7
      ? "Final team confirmation still matters because this game is structurally sensitive."
      : "Weather or late selection shifts could soften the current edge."
  ];
}

function buildSummaries(match, winner, loser, confidence, diff) {
  const { home, away, venue, inputs } = match;
  const homeLean = diff >= 0;

  return {
    summaryHome: homeLean
      ? `${home} gets the cleaner projected path at ${venue}.`
      : `${home} still has enough home shape to keep the game competitive.`,
    summaryAway: !homeLean
      ? `${away} carries the stronger current profile and a narrow model edge.`
      : `${away} needs cleaner transition and availability to overturn the lean.`,
    summaryModel: confidence === "Low"
      ? "This is a volatile tip and should be rechecked when final teams land."
      : confidence === "Medium"
        ? "The model has a clear lean, but not enough to call it a lock."
        : "This is one of the stronger positions on the board and projects cleanly."
  };
}

function buildInjuryText(match, winner, loser, injuryImpact) {
  const { home, away } = match;
  const band = injuryBand(injuryImpact);
  const homeWinning = winner === home;

  return {
    injuryHomeTitle: home,
    injuryHomeText: homeWinning
      ? `${home} looks structurally cleaner right now, which supports the current edge.`
      : `${home} still has enough quality to stay live, but list risk is part of the drag.`,
    injuryAwayTitle: away,
    injuryAwayText: !homeWinning
      ? `${away} looks slightly cleaner on availability, which helps the away lean.`
      : `${away} needs stronger availability to offset the broader rating gap.`,
    injuryModelText: band === "high"
      ? "This match is marked injury-sensitive. Re-run the tip once final teams land."
      : band === "moderate"
        ? "Moderate injury sensitivity. One team change can move confidence, but not always the winner."
        : "Low injury sensitivity. The margin is more likely to move than the winner."
  };
}

function buildLateOut(match, baseDiff, winner) {
  if (!match.lateOut) {
    return undefined;
  }

  const swingDirection = match.lateOut.team === match.home ? -1 : 1;
  const adjustedDiff = baseDiff + match.lateOut.ratingSwing * swingDirection;
  const lateWinner = adjustedDiff >= 0 ? match.home : match.away;
  const lateLoser = lateWinner === match.home ? match.away : match.home;
  const lateConfidence = confidenceFromDiff(adjustedDiff, 9);

  const summaries = buildSummaries(match, lateWinner, lateLoser, lateConfidence, adjustedDiff);
  const injuries = buildInjuryText(match, lateWinner, lateLoser, 9);

  return {
    winner: lateWinner,
    probability: probabilityFromDiff(adjustedDiff),
    confidence: lateConfidence,
    margin: adjustedDiff === 0 ? "1 to 9" : marginFromDiff(adjustedDiff),
    reasons: [
      match.lateOut.summary,
      `${lateWinner} becomes more influential in a tighter contest after the adjustment.`,
      "The venue still keeps the game close, so confidence does not improve."
    ],
    changes: [
      `If ${winner} absorbs the late change well, the model could swing back.`,
      `Another availability issue for ${lateWinner} would reverse the gain quickly.`,
      "Final weather and sub decisions remain important."
    ],
    ...summaries,
    ...injuries,
    stats: buildStats(match, lateWinner)
  };
}

function transformMatch(match) {
  const { inputs } = match;
  const diff =
    (inputs.homeRating - inputs.awayRating) +
    inputs.venueEdge +
    (inputs.homeForm - inputs.awayForm) * 0.7 -
    inputs.injuryImpact * 0.15;

  const winner = diff >= 0 ? match.home : match.away;
  const loser = winner === match.home ? match.away : match.home;
  const confidence = confidenceFromDiff(diff, inputs.injuryImpact);
  const summaries = buildSummaries(match, winner, loser, confidence, diff);
  const injuries = buildInjuryText(match, winner, loser, inputs.injuryImpact);

  return {
    id: match.id,
    title: `${match.home} vs ${match.away}`,
    home: match.home,
    away: match.away,
    venue: match.venue,
    schedule: match.schedule,
    winner,
    probability: probabilityFromDiff(diff),
    confidence,
    margin: marginFromDiff(diff),
    injury: injuryBand(inputs.injuryImpact),
    upset: confidence === "Low" || (winner === match.away && inputs.venueEdge > 0),
    updated: match.updated,
    reasons: buildReasons(match, winner, loser, diff),
    changes: buildChanges(match, winner, loser),
    ...summaries,
    ...injuries,
    stats: buildStats(match, winner),
    lateOut: buildLateOut(match, diff, winner)
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  const matches = (raw.matches || []).map(transformMatch);
  const output = {
    round: raw.round,
    generatedAt: new Date().toISOString(),
    matches
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Generated ${matches.length} matches to ${path.relative(rootDir, outputPath)}`);
}

main();
