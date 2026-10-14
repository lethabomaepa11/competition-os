"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Space, Tag, Typography } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import type { Bet } from "@/domain/bet";
import { MatchStatus } from "@/domain/types";
import { BetService } from "@/domain/services/bet.service";
import { calculatePredictionOdds } from "@/domain/prediction-odds";

const { Text } = Typography;

export function GuestPredictionPanel({ matches, participants, eventId }: { matches: Match[]; participants: Participant[]; eventId: string }) {
  const [name, setName] = useState("");
  const [bets, setBets] = useState<Bet[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const participantNames = useMemo(() => new Map(participants.map((participant) => [participant.id, participant.displayName])), [participants]);

  useEffect(() => {
    let active = true;
    void new BetService().getEventBets(eventId).then((data) => { if (active) setBets(data); }).catch(() => { if (active) setError("Predictions are temporarily unavailable."); });
    return () => { active = false; };
  }, [eventId]);

  const openMatches = matches.filter((match) => match.status === MatchStatus.Scheduled && match.participantIds.length === 2);
  const predict = async (match: Match) => {
    const participantId = selected[match.id];
    if (!participantId || name.trim().length < 2) return;
    setSubmitting(match.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/guest-predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, participantId, name }),
      });
      const data = await response.json() as { error?: string; odds?: number | null; name?: string };
      if (!response.ok) throw new Error(data.error ?? "Prediction could not be saved.");
      setSuccess(data.odds ? `Your prediction is saved at ${data.odds.toFixed(2)} illustrative odds.` : "Your prediction is saved. Odds will appear when enough results are available.");
      setBets((current) => [...current, { id: `guest-${match.id}`, matchId: match.id, eventId, participantId, betterId: null, betterName: data.name ?? name.trim(), pointsWagered: 0, placedAt: new Date().toISOString(), settled: false, won: false, pointsAwarded: 0, decimalOdds: data.odds ?? undefined }]);
      setSelected((current) => { const next = { ...current }; delete next[match.id]; return next; });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Prediction could not be saved.");
    } finally {
      setSubmitting(null);
    }
  };

  return <Card title={<Space><ThunderboltOutlined style={{ color: "var(--competition-accent, #1c5fd4)" }} /> Match predictions</Space>} style={{ marginTop: 16 }}>
    <Alert type="info" showIcon title="For the love of the game" description="Pick a winner and leave your name. No account, money or points required. Odds are illustrative event-form estimates, never a guarantee." />
    {error && <Alert style={{ marginTop: 12 }} type="error" showIcon title={error} />}
    {success && <Alert style={{ marginTop: 12 }} type="success" showIcon title={success} />}
    <div style={{ maxWidth: 380, margin: "16px 0" }}><Text strong>Your display name</Text><Input aria-label="Prediction display name" maxLength={48} minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="How should we show your pick?" /></div>
    <Space orientation="vertical" style={{ width: "100%" }}>
      {openMatches.map((match) => {
        const names = match.participantIds.map((id) => participantNames.get(id) ?? "Entrant");
        const prices = calculatePredictionOdds(matches, match.participantIds[0], match.participantIds[1]);
        const existing = bets.filter((bet) => bet.matchId === match.id);
        return <Card key={match.id} size="small" title={`${names[0]} vs ${names[1]}`} extra={prices ? <Space>{prices.map((price, index) => <Tag key={index} color="blue">{Math.round(price.probability * 100)}% · {price.decimalOdds.toFixed(2)}</Tag>)}</Space> : <Tag>Odds developing</Tag>}>
          {existing.length > 0 && <div style={{ marginBottom: 8 }}><Text type="secondary">Picks so far: </Text>{existing.slice(-5).map((bet) => <Tag key={bet.id} color="blue">{bet.betterName}: {participantNames.get(bet.participantId) ?? "Entrant"}</Tag>)}</div>}
          <Space wrap>
            {match.participantIds.map((id) => <Button key={id} type={selected[match.id] === id ? "primary" : "default"} aria-pressed={selected[match.id] === id} onClick={() => setSelected((current) => ({ ...current, [match.id]: id }))}>{participantNames.get(id) ?? "Entrant"}{prices && <span> · {prices[match.participantIds.indexOf(id)].decimalOdds.toFixed(2)}</span>}</Button>)}
            <Button type="primary" disabled={name.trim().length < 2 || !selected[match.id]} loading={submitting === match.id} onClick={() => void predict(match)}>Save prediction</Button>
          </Space>
        </Card>;
      })}
      {openMatches.length === 0 && <Text type="secondary">Predictions open for upcoming fixtures will appear here.</Text>}
    </Space>
  </Card>;
}
