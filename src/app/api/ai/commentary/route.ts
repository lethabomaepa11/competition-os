import { NextRequest, NextResponse } from "next/server";

function pickOne(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

function generateCommentary(matchName: string, participants: { name: string; score: number }[]): string {
  if (participants.length === 2) {
    const [a, b] = participants;
    const diff = Math.abs(a.score - b.score);

    if (a.score === 0 && b.score === 0) return pickOne([
      `${matchName} is underway! Both sides feeling each other out.`,
      `The match has started! Scoreless so far in ${matchName}.`,
    ]);

    if (a.score === b.score) return pickOne([
      `Tied up at ${a.score}-${b.score}! This ${matchName} matchup is heating up.`,
      `We're all square! ${a.score} apiece in ${matchName}.`,
    ]);

    if (diff >= 5) return pickOne([
      `${a.name} is pulling away! ${a.score}-${b.score} — can ${b.name} mount a comeback?`,
      `Big lead building here! ${a.score}-${b.score} in ${matchName}.`,
      `Dominant performance from ${a.name}, leading ${a.score}-${b.score}!`,
    ]);

    if (a.score > b.score) return pickOne([
      `${a.name} edges ahead ${a.score}-${b.score}! Close match in ${matchName}.`,
      `${a.name} takes the lead ${a.score}-${b.score}! Tense moments here.`,
      `Slight advantage to ${a.name}, ${a.score}-${b.score}. Every point counts!`,
    ]);

    return pickOne([
      `${a.name} leads ${a.score}-${b.score} in ${matchName}. Still anyone's game!`,
      `Close contest! ${a.name} ${a.score}, ${b.name} ${b.score}.`,
    ]);
  }

  const leader = participants[0];
  return pickOne([
    `${leader.name} leads with ${leader.score} points! ${matchName} is wide open.`,
    `Current standings in ${matchName}: ${participants.map(p => `${p.name} ${p.score}`).join(", ")}`,
  ]);
}

export async function POST(request: NextRequest) {
  try {
    const { matchId, matchName, participants } = await request.json();

    if (!matchId || !participants) {
      return NextResponse.json({ error: "Missing matchId or participants" }, { status: 400 });
    }

    const text = generateCommentary(matchName ?? "this match", participants);

    const res = await fetch(`${request.nextUrl.origin}/api/match_comments/crud/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: {
          matchId,
          text,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    const json = await res.json();
    if (json.error) {
      return NextResponse.json({ data: { text } });
    }

    return NextResponse.json({ data: { text, id: json.data?.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
