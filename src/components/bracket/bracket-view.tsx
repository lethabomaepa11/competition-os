"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import { Empty, Button, message, Modal, Descriptions } from "antd";
import { Bracket } from "bracketkit";
import type { BracketRound } from "bracketkit";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import type { Round } from "@/domain/event";
import { MatchStatus } from "@/domain/types";
import styles from "./bracket-view.module.css";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

interface Props {
  matches: Match[];
  participants: Participant[];
  rounds?: Round[];
}

interface BracketMatchData {
  id: string;
  p1Name: string;
  p2Name: string;
  p1Score?: number;
  p2Score?: number;
  winner?: string;
  status: MatchStatus;
  fixtureNumber?: number;
  bracketGroup?: string;
  winnerTarget?: string;
  loserTarget?: string;
}

export function BracketView({ matches, participants, rounds }: Props) {
  const [selectedMatch, setSelectedMatch] = useState<BracketMatchData | null>(null);
  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p.displayName])),
    [participants],
  );

  const roundOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    rounds?.forEach((r, idx) => map.set(r.id, r.roundNumber ?? idx));
    return map;
  }, [rounds]);

  const roundNameMap = useMemo(
    () => new Map(rounds?.map((r) => [r.id, r.name]) ?? []),
    [rounds],
  );

  const renderKey = useMemo(() => {
    let hash = 0;
    for (const m of matches) {
      const scoreStr = (m.result?.scores ?? [])
        .map((s) => `${s.participantId}:${s.value}`)
        .join(",");
      hash = ((hash << 5) - hash + (m.status + scoreStr).length * 31) | 0;
    }
    return `bracket-${hash}`;
  }, [matches]);

  const bracketRounds: BracketRound<BracketMatchData>[] = useMemo(() => {
    const roundMap = new Map<string, BracketMatchData[]>();
    const targetLabels = new Map<string, string>();
    for (const match of matches) {
      const engineKey = match.config.engineMatchKey;
      if (typeof engineKey !== "string") continue;
      const roundName = roundNameMap.get(match.roundId) ?? "Next round";
      const engineIndex = match.config.engineMatchIndex;
      const fixture = typeof engineIndex === "number" ? `Fixture ${String(engineIndex + 1).padStart(2, "0")}` : "Next fixture";
      targetLabels.set(engineKey, `${roundName} · ${fixture}`);
    }

    for (const m of matches) {
      const [p1, p2] = m.participants;
      const scores = m.result?.scores ?? [];
      const data: BracketMatchData = {
        id: m.id,
        p1Name: p1 ? (participantMap.get(p1.participantId) ?? "BYE") : "TBD",
        p2Name: p2 ? (participantMap.get(p2.participantId) ?? "BYE") : "TBD",
        p1Score: scores.find((s) => s.participantId === p1?.participantId)
          ?.value,
        p2Score: scores.find((s) => s.participantId === p2?.participantId)
          ?.value,
        winner: m.result?.winnerId
          ? participantMap.get(m.result.winnerId)
          : undefined,
        status: m.status,
        fixtureNumber: typeof m.config.matchIndex === "number"
          ? m.config.matchIndex
          : typeof m.config.engineMatchIndex === "number" ? m.config.engineMatchIndex + 1 : undefined,
        bracketGroup: m.bracketGroup,
        winnerTarget: typeof m.config.nextMatchKey === "string" ? targetLabels.get(m.config.nextMatchKey) : undefined,
        loserTarget: typeof m.config.loserNextMatchKey === "string" ? targetLabels.get(m.config.loserNextMatchKey) : undefined,
      };
      const list = roundMap.get(m.roundId) ?? [];
      list.push(data);
      roundMap.set(m.roundId, list);
    }
    return Array.from(roundMap.entries())
      .map(([roundId, roundMatches]) => ({
        id: roundId,
        name: roundNameMap.get(roundId) ?? `Round ${roundId.slice(0, 4)}`,
        matches: roundMatches,
      }))
      .sort(
        (a, b) =>
          (roundOrderMap.get(a.id) ?? 0) - (roundOrderMap.get(b.id) ?? 0),
      );
  }, [matches, participantMap, roundNameMap, roundOrderMap]);

  const bracketSections = useMemo(() => {
    const isDoubleElimination = matches.some((match) => match.bracketGroup);
    if (!isDoubleElimination) return [{ id: "main", name: "Knockout bracket", rounds: bracketRounds }];

    return ([
      { id: "winners", name: "Winners pathway" },
      { id: "losers", name: "Losers pathway" },
      { id: "finals", name: "Grand final" },
    ] as const).map((section) => ({
      ...section,
      rounds: bracketRounds.map((round) => ({
        ...round,
        matches: round.matches.filter((match) => match.bracketGroup === section.id),
      })).filter((round) => round.matches.length > 0),
    })).filter((section) => section.rounds.length > 0);
  }, [bracketRounds, matches]);
  const isDoubleElimination = matches.some((match) => match.bracketGroup);

  const bracketRef = useRef<HTMLDivElement>(null);

  const exportBracket = useCallback(async (format: "png" | "pdf") => {
    if (!bracketRef.current) return;
    try {
      const dataUrl = await toPng(bracketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      if (format === "png") {
        const link = document.createElement("a");
        link.download = "bracket.png";
        link.href = dataUrl;
        link.click();
      } else {
        const pdf = new jsPDF({ orientation: "landscape", unit: "px" });
        const imgProps = pdf.getImageProperties(dataUrl);
        pdf.addImage(dataUrl, "PNG", 0, 0, imgProps.width, imgProps.height);
        pdf.save("bracket.pdf");
      }
      message.success(`Bracket exported as ${format.toUpperCase()}`);
    } catch {
      message.error("Failed to export bracket");
    }
  }, []);

  if (matches.length === 0 || !rounds || rounds.length === 0) {
    return <Empty description="No bracket data available yet." />;
  }

  return (
    <section className={styles.shell} aria-label="Competition bracket">
      <header className={styles.heading}>
        <div><span className={styles.headingLabel}>Knockout pathway</span><h2 className={styles.headingTitle}>Road to the final</h2></div>
        <div className={styles.summary}>
          <span>{bracketSections.length > 1 ? `${bracketSections.length} pathways` : `${rounds.length} ${rounds.length === 1 ? "round" : "rounds"}`}</span>
          <span>{matches.length} {matches.length === 1 ? "fixture" : "fixtures"}</span>
        </div>
      </header>
      <div className={styles.toolbar}>
        <Button size="small" onClick={() => exportBracket("png")}>
          Export PNG
        </Button>
        <Button size="small" onClick={() => exportBracket("pdf")}>
          Export PDF
        </Button>
      </div>
      <div ref={bracketRef} className={styles.canvas}>
        {bracketSections.map((section) => (
          <div className={styles.pathway} key={section.id}>
            {bracketSections.length > 1 && <h3 className={styles.pathwayTitle}>{section.name}</h3>}
            {isDoubleElimination && <p className={styles.pathwayHint}>Select a fixture to see the exact winner and loser destination.</p>}
            {isDoubleElimination ? (
              <div className={styles.roundColumns}>
                {section.rounds.map((round) => <div className={styles.roundColumn} key={round.id}>
                  <h4 className={styles.roundHeader}>{round.name}</h4>
                  <div className={styles.roundFixtures}>{round.matches.map((match) => <MatchCard key={match.id} match={match} onClick={() => setSelectedMatch(match)} />)}</div>
                </div>)}
              </div>
            ) : (
              <Bracket
                key={`${renderKey}-${section.id}`}
                className={styles.bracketRoot}
                rounds={section.rounds}
                matchWidth={220}
                connectorWidth={48}
                matchGap={12}
                renderRoundHeader={(round) => <div className={styles.roundHeader}>{round.name}</div>}
                renderMatch={(match) => <MatchCard match={match} onClick={() => setSelectedMatch(match)} />}
              />
            )}
          </div>
        ))}
      </div>
      <Modal
        title="Fixture details"
        open={selectedMatch !== null}
        onCancel={() => setSelectedMatch(null)}
        className={styles.modal}
        footer={<Button type="primary" onClick={() => setSelectedMatch(null)}>Done</Button>}
      >
        {selectedMatch && <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Fixture">{selectedMatch.p1Name} vs {selectedMatch.p2Name}</Descriptions.Item>
          <Descriptions.Item label="Status">{selectedMatch.status.replaceAll("_", " ")}</Descriptions.Item>
          {(selectedMatch.p1Score !== undefined || selectedMatch.p2Score !== undefined) && <Descriptions.Item label="Score">{selectedMatch.p1Score ?? "—"} – {selectedMatch.p2Score ?? "—"}</Descriptions.Item>}
          {selectedMatch.winner && <Descriptions.Item label="Winner">{selectedMatch.winner}</Descriptions.Item>}
          {selectedMatch.winnerTarget && <Descriptions.Item label="Winner advances to">{selectedMatch.winnerTarget}</Descriptions.Item>}
          {selectedMatch.loserTarget && <Descriptions.Item label="Loser drops to">{selectedMatch.loserTarget}</Descriptions.Item>}
        </Descriptions>}
      </Modal>
    </section>
  );
}

function MatchCard({ match, onClick }: { match: BracketMatchData; onClick: () => void }) {
  const isP1Winner = match.winner === match.p1Name;
  const isP2Winner = match.winner === match.p2Name;
  const isEmpty = match.p1Name === "TBD" && match.p2Name === "TBD";

  const isWalkover = match.status === MatchStatus.Walkover;
  const isCompleted = match.status === MatchStatus.Completed;

  const statusLabel = match.status === MatchStatus.Completed
    ? "Full time"
    : match.status === MatchStatus.InProgress
      ? "Live now"
      : match.status === MatchStatus.Walkover
        ? "Walkover"
        : "Upcoming";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View fixture: ${match.p1Name} versus ${match.p2Name}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={styles.matchCard}
      data-completed={isCompleted}
      data-walkover={isWalkover}
    >
      <div className={styles.fixtureMeta}><span>{match.fixtureNumber ? `Fixture ${String(match.fixtureNumber).padStart(2, "0")}` : "Match fixture"}</span><span className={match.status === MatchStatus.InProgress ? `${styles.status} ${styles.statusLive}` : styles.status}>{statusLabel}</span></div>
      {isEmpty ? (
        <div className={styles.empty}>Awaiting qualified entrants</div>
      ) : (
        <>
          <TeamRow name={match.p1Name} score={match.p1Score} winner={isP1Winner} loser={isP2Winner && !!match.winner} />
          <TeamRow name={match.p2Name} score={match.p2Score} winner={isP2Winner} loser={isP1Winner && !!match.winner} />
        </>
      )}
    </div>
  );
}

function TeamRow({ name, score, winner, loser }: { name: string; score?: number; winner: boolean; loser: boolean }) {
  return <div className={`${styles.teamRow} ${winner ? styles.teamWinner : ""} ${loser ? styles.teamLoser : ""}`}>
    <span className={styles.teamName}>{name}</span>
    {score !== undefined && <span className={styles.score}>{score}</span>}
  </div>;
}
