# Group Stage Home & Away Fixtures — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\- [ ]\) syntax for tracking.

**Goal:** Add an optional "Home & Away Fixtures" toggle to group stages that enables double round-robin (each pair plays twice, positions swapped) with separate home/away statistics in the standings table.

**Architecture:** Add a boolean rule \double_round_robin\ to GroupStage's rule definitions. Pass it through \createStages()\ to the bracket engine's \generateGroupStage()\ which already supports \doubleRoundRobin\. Track home/away win/draw/loss/goals stats in \calculateStandings()\ when enabled. Show 6 new columns (HW/HD/HL/AW/AD/AL) in the standings table when home/away data is present.

**Tech Stack:** TypeScript, Next.js, Ant Design, @kurovu146/bracket-engine

## Global Constraints

- Group stage only — League format is out of scope
- \StandingsEntry.stats\ is \Record<string, number>\ — store all home/away stats there
- Position 1 in a match = home, position 2 = away
- Initialize home/away stats to 0 for all participants when enabled
- Detection in UI: \standings[0]?.stats.homeWins !== undefined\

---

### Task 1: Add \double_round_robin\ rule to GroupStage definitions

**Files:**
- Modify: \src/domain/rules.ts:41-46\

**Interfaces:**
- Consumes: \FormatType.GroupStage\ enum value, \RuleValueType.Boolean\
- Produces: New rule \double_round_robin\ with key \"double_round_robin"\, label \"Home & Away Fixtures"\, type \RuleValueType.Boolean\, defaultValue \alse\

- [ ] **Step 1: Add the rule**

Edit \src/domain/rules.ts\, add the \double_round_robin\ entry to the GroupStage array. The new rule goes after \draw_points\:

Before:
\\\	ypescript
{ key: "draw_points", label: "Draw Points", type: RuleValueType.Number, defaultValue: 1, validation: { min: 0, max: 100 } },
\\\

After:
\\\	ypescript
{ key: "draw_points", label: "Draw Points", type: RuleValueType.Number, defaultValue: 1, validation: { min: 0, max: 100 } },
{ key: "double_round_robin", label: "Home & Away Fixtures", type: RuleValueType.Boolean, defaultValue: false },
\\\

- [ ] **Step 2: Run tsc to verify**

Run: \
px tsc --noEmit\
Expected: No errors

---

### Task 2: Update \createStages()\ to pass \doubleRoundRobin\ to the engine

**Files:**
- Modify: \src/domain/formats/group-stage.ts:15-23\

**Interfaces:**
- Consumes: \getBoolRule\ from \../rules\, \generateGroupStage(ids, { numGroups, distribution, doubleRoundRobin })\
- Produces: When rule is enabled, the engine generates 2x matches per group with swapped positions for return legs

- [ ] **Step 1: Import \getBoolRule\**

Edit line 6 of \src/domain/formats/group-stage.ts\:
\\\	ypescript
import { getNumberRule, getBoolRule } from "../rules";
\\\

- [ ] **Step 2: Read the rule and pass to engine**

Edit lines 15-22:
\\\	ypescript
createStages(eventId: string, participants: Participant[], rules: RuleOverride[]): StageResult[] {
    const doubleRR = getBoolRule(rules, "double_round_robin", FormatType.GroupStage);
    const numGroups = getNumberRule(rules, "group_count", FormatType.GroupStage) || 4;
    const qualifiersPerGroup = getNumberRule(rules, "qualifiers_per_group", FormatType.GroupStage) || 2;
    const winPts = getNumberRule(rules, "win_points", FormatType.GroupStage) || 3;
    const drawPts = getNumberRule(rules, "draw_points", FormatType.GroupStage) || 1;

    const participantIds = participants.map(p => p.id);
    const result = generateGroupStage(participantIds, { numGroups, distribution: "snake", doubleRoundRobin: doubleRR });
\\\

- [ ] **Step 3: Run tsc to verify**

Run: \
px tsc --noEmit\
Expected: No errors

---

### Task 3: Update \calculateStandings()\ to track home/away stats

**Files:**
- Modify: \src/domain/formats/group-stage.ts:122-204\

**Interfaces:**
- Consumes: \getBoolRule\ (already imported), \Match.participants[].position\ (1=home, 2=away)
- Produces: \StandingsEntry.stats\ with \homeWins\, \homeDraws\, \homeLosses\, \homeGoalsFor\, \homeGoalsAgainst\, \wayWins\, \wayDraws\, \wayLosses\, \wayGoalsFor\, \wayGoalsAgainst\

- [ ] **Step 1: Update the stats map type to include home/away fields**

Change line 138 to include home/away tracking:
\\\	ypescript
const stats = new Map<string, {
  pts: number; w: number; l: number; d: number; gf: number; ga: number;
  hw: number; hd: number; hl: number; hgf: number; hga: number;
  aw: number; ad: number; al: number; agf: number; aga: number;
}>();
\\\

- [ ] **Step 2: Initialize home/away fields to 0**

Change the initialization on line 140-142:
\\\	ypescript
for (const pid of groupPids) {
  stats.set(pid, {
    pts: 0, w: 0, l: 0, d: 0, gf: 0, ga: 0,
    hw: 0, hd: 0, hl: 0, hgf: 0, hga: 0,
    aw: 0, ad: 0, al: 0, agf: 0, aga: 0,
  });
}
\\\

- [ ] **Step 3: Read the \double_round_robin\ rule and track home/away stats per match**

After line 133 (\const matchesByGroup = this.buildGroupMatchMap(matches);\), add:
\\\	ypescript
const isDoubleRR = getBoolRule(rules, "double_round_robin", FormatType.GroupStage);
\\\

Then in the match loop (after line 163-167 where goals and wins/losses are recorded), add home/away tracking. Replace lines 155-167 with:

\\\	ypescript
const [p1, p2] = match.participantIds;
const s1 = stats.get(p1);
const s2 = stats.get(p2);
if (!s1 || !s2) continue;

const sc1 = match.result.scores.find(s => s.participantId === p1)?.value ?? 0;
const sc2 = match.result.scores.find(s => s.participantId === p2)?.value ?? 0;
s1.gf += sc1; s1.ga += sc2;
s2.gf += sc2; s2.ga += sc1;

if (match.result.winnerId === p1) { s1.pts += winPts; s1.w++; s2.l++; }
else if (match.result.winnerId === p2) { s2.pts += winPts; s2.w++; s1.l++; }
else { s1.pts += drawPts; s2.pts += drawPts; s1.d++; s2.d++; }

if (isDoubleRR) {
  const p1IsHome = match.participants.find(p => p.participantId === p1)?.position === 1;
  if (match.result.winnerId === p1) {
    if (p1IsHome) { s1.hw++; s2.al++; } else { s1.aw++; s2.hl++; }
  } else if (match.result.winnerId === p2) {
    if (p1IsHome) { s2.aw++; s1.hl++; } else { s2.hw++; s1.al++; }
  } else {
    if (p1IsHome) { s1.hd++; s2.ad++; } else { s1.ad++; s2.hd++; }
  }
  if (p1IsHome) { s1.hgf += sc1; s1.hga += sc2; s2.agf += sc2; s2.aga += sc1; }
  else { s1.agf += sc1; s1.aga += sc2; s2.hgf += sc2; s2.hga += sc1; }
}
\\\

- [ ] **Step 4: Include home/away stats in the returned StandingsEntry**

Replace the stats builder on line 181 with:
\\\	ypescript
stats: {
  goalsFor: s.gf, goalsAgainst: s.ga, goalDifference: s.gf - s.ga, groupIndex: gIdx,
  ...(isDoubleRR ? {
    homeWins: s.hw, homeDraws: s.hd, homeLosses: s.hl,
    homeGoalsFor: s.hgf, homeGoalsAgainst: s.hga,
    awayWins: s.aw, awayDraws: s.ad, awayLosses: s.al,
    awayGoalsFor: s.agf, awayGoalsAgainst: s.aga,
  } : {}),
},
\\\

- [ ] **Step 5: Run tsc to verify**

Run: \
px tsc --noEmit\
Expected: No errors

---

### Task 4: Update \StandingsTable\ to show home/away columns

**Files:**
- Modify: \src/components/standings/standings-table.tsx\

**Interfaces:**
- Consumes: \StandingsEntry.stats.homeWins\ (presence check)
- Produces: 6 new columns HW/HD/HL/AW/AD/AL visible when home/away data exists

- [ ] **Step 1: Add home/away columns after the Losses (L) column**

In \src/components/standings/standings-table.tsx\, after the Losses column (line 100), add:

\\\	ypescript
{ title: "L", dataIndex: "losses", key: "losses" },
...((standings[0]?.stats?.homeWins !== undefined) ? [
  { title: "HW", key: "homeWins", render: (_: unknown, r: StandingsEntry) => r.stats.homeWins ?? 0 },
  { title: "HD", key: "homeDraws", render: (_: unknown, r: StandingsEntry) => r.stats.homeDraws ?? 0 },
  { title: "HL", key: "homeLosses", render: (_: unknown, r: StandingsEntry) => r.stats.homeLosses ?? 0 },
  { title: "AW", key: "awayWins", render: (_: unknown, r: StandingsEntry) => r.stats.awayWins ?? 0 },
  { title: "AD", key: "awayDraws", render: (_: unknown, r: StandingsEntry) => r.stats.awayDraws ?? 0 },
  { title: "AL", key: "awayLosses", render: (_: unknown, r: StandingsEntry) => r.stats.awayLosses ?? 0 },
] : []),
\\\

- [ ] **Step 2: Run tsc to verify**

Run: \
px tsc --noEmit\
Expected: No errors

---

### Task 5: Build verification

- [ ] **Step 1: Run full build**

Run: \
px next build\
Expected: \✓ Compiled successfully\ with no errors

- [ ] **Step 2: Verify the logic**

The final code should produce:
1. A new "Home & Away Fixtures" toggle in the event creation form for GroupStage events
2. When toggled ON: double round-robin matches are generated
3. Standings show HW/HD/HL/AW/AD/AL columns
4. When toggled OFF: behavior unchanged from before
