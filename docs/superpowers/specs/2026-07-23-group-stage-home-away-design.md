# Group Stage Home & Away Fixtures

**Date:** 2026-07-23
**Status:** Draft

## Summary

Add home-and-away (double round-robin) support to the Group Stage format. Each pair of participants plays twice — once at home (position 1) and once away (position 2). The standings table displays separate home/away win-draw-loss statistics.

## Motivation

Group stages currently use single round-robin (each pair plays once). For league-style competitions, home and away fixtures are standard, providing a fairer competition and richer statistics.

## Changes

### 1. New Rule Definition

**File:** `src/domain/rules.ts`

Add a `double_round_robin` boolean rule to `FormatRuleDefinitions` for `FormatType.GroupStage`:

```typescript
{ key: "double_round_robin", label: "Home & Away Fixtures", type: RuleValueType.Boolean, defaultValue: false }
```

This appears as a toggle in the event creation/edit form's rules configuration. When enabled, the group stage generates double the matches (each pair plays twice with swapped positions).

### 2. Match Generation

**File:** `src/domain/formats/group-stage.ts`

In `createStages()`, read the `double_round_robin` rule and pass it to the bracket engine:

```typescript
const doubleRR = getBoolRule(rules, "double_round_robin", FormatType.GroupStage);
const result = generateGroupStage(participantIds, { numGroups, distribution: "snake", doubleRoundRobin: doubleRR });
```

The bracket engine's `generateGroupStage()` already supports `doubleRoundRobin` — it passes the option through to `generateRoundRobin()`, which creates a second pass of matches with player1/player2 swapped (home/away reversal).

**Effect:** A group of 4 participants generates 12 matches instead of 6 (each of the 6 pairings appears twice).

### 3. Standings Calculation

**File:** `src/domain/formats/group-stage.ts`

In `calculateStandings()`, when `double_round_robin` is enabled, track per-participant:

| Stats key | Description |
|-----------|-------------|
| `homeWins` | Wins as home (position 1) |
| `homeDraws` | Draws as home |
| `homeLosses` | Losses as home |
| `homeGoalsFor` | Goals scored as home |
| `homeGoalsAgainst` | Goals conceded as home |
| `awayWins` | Wins as away (position 2) |
| `awayDraws` | Draws as away |
| `awayLosses` | Losses as away |
| `awayGoalsFor` | Goals scored as away |
| `awayGoalsAgainst` | Goals conceded as away |

Home/away determination: position 1 in the match = home, position 2 = away. In single round-robin, these are just slot positions (not semantically meaningful), so home/away stats are only tracked when `double_round_robin` is enabled.

When `double_round_robin` is enabled, `calculateStandings()` initializes home/away stats to 0 for **all** participants (not just those with completed matches), so the presence check (`stats.homeWins !== undefined`) in the UI works reliably.

### 4. Standings Table UI

**File:** `src/components/standings/standings-table.tsx`

When standings entries contain `homeWins` (i.e., double round-robin is active), insert **6 new columns** after the Losses (L) column and before GF/GA/GD:

| Column | Key | Description |
|--------|-----|-------------|
| HW | `homeWins` | Home Wins |
| HD | `homeDraws` | Home Draws |
| HL | `homeLosses` | Home Losses |
| AW | `awayWins` | Away Wins |
| AD | `awayDraws` | Away Draws |
| AL | `awayLosses` | Away Losses |

Detection: check `standings[0]?.stats.homeWins !== undefined` to decide whether to show these columns.

### 5. No Changes To

- `StandingsEntry` interface — `stats` is already `Record<string, number>`
- `StandingsService` — no changes needed; it delegates to the format
- `EventService.initializeEvent()` — no changes; format handles it internally
- `ProgressionService` — no changes; advancement is unaffected
- League format — its `double_round_robin` rule reading is left as-is (naming mismatch with `"rounds"` rule exists but is out of scope)

## Data Flow

```
Event form (toggle Home & Away Fixtures)
  → stage.config rules include double_round_robin=true
  → StageResult[] with double matches (swapped positions)
  → Matches created in DB

Later:
  → StandingsService.calculate()
    → GroupStageFormat.calculateStandings()
      → reads double_round_robin rule
      → tracks homeWins, awayWins, etc. in stats
  → StandingsTable renders HW/HD/HL/AW/AD/AL columns
```

## Edge Cases

- **Odd participants in a group:** BYE matches have no opponent, so home/away is irrelevant. No home/away stats tracked for BYE matches.
- **Switching from single to double mid-competition:** The `clearEventFixtures` + `initializeEvent` flow regenerates all matches. Existing completed matches are lost. This is acceptable — the toggle is meant to be set before the competition starts.
- **Same rule for League format:** The League format already reads `double_round_robin` but the rules definition uses `"rounds"` instead. Fixing that mismatch is a separate concern.
