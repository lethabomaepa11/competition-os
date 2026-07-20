import { NextRequest, NextResponse } from "next/server";

interface ParticipantData {
  id: string;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  avgScoreFor: number;
  avgScoreAgainst: number;
  highestScore: number;
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  last5Results: string[];
  comebackWins: number;
  dominantWins: number;
  closeWins: number;
  winProb: number;
  predictedScore: number;
}

interface MatchData {
  p1Name: string;
  p2Name: string;
  p1Score?: number;
  p2Score?: number;
  winner?: string;
}

interface AiRequestBody {
  type: "win_probability" | "head_to_head" | "matchup_analysis" | "insights";
  participants: [ParticipantData, ParticipantData];
  recentMatches: MatchData[];
  headToHeadMatches: MatchData[];
  eventName: string;
  interestingFacts?: string[];
}

function getFormEmoji(form: string): string {
  if (form === "win") return "✅";
  if (form === "loss") return "❌";
  return "➖";
}

function buildInsightsPrompt(data: AiRequestBody): string {
  const [p1, p2] = data.participants;
  const p1FormStr = p1.last5Results.map(r => getFormEmoji(r)).join(" ");
  const p2FormStr = p2.last5Results.map(r => getFormEmoji(r)).join(" ");
  const factsBullets = data.interestingFacts?.map(f => `- ${f}`).join("\n") ?? "";

  return `You are a world-class esports/sports analyst. Analyze this upcoming match in "${data.eventName}" with deep statistical insight.

## Player 1: ${p1.displayName}
- Record: ${p1.wins}W ${p1.losses}L ${p1.draws > 0 ? p1.draws + "D" : ""} (${p1.totalMatches} matches)
- Win Rate: ${p1.totalMatches > 0 ? Math.round((p1.wins / p1.totalMatches) * 100) : 0}%
- Avg Score For/Against: ${p1.avgScoreFor} / ${p1.avgScoreAgainst}
- Highest Score: ${p1.highestScore}
- Recent Form: ${p1FormStr}
- Streak: ${p1.currentWinStreak > 0 ? `${p1.currentWinStreak} wins in a row 🔥` : p1.currentLossStreak > 0 ? `${p1.currentLossStreak} losses in a row` : "No active streak"}
- Comeback Wins: ${p1.comebackWins} | Dominant Wins: ${p1.dominantWins} | Close Wins: ${p1.closeWins}
- Computed Win Probability: ${p1.winProb}%
- Predicted Score: ${p1.predictedScore}

## Player 2: ${p2.displayName}
- Record: ${p2.wins}W ${p2.losses}L ${p2.draws > 0 ? p2.draws + "D" : ""} (${p2.totalMatches} matches)
- Win Rate: ${p2.totalMatches > 0 ? Math.round((p2.wins / p2.totalMatches) * 100) : 0}%
- Avg Score For/Against: ${p2.avgScoreFor} / ${p2.avgScoreAgainst}
- Highest Score: ${p2.highestScore}
- Recent Form: ${p2FormStr}
- Streak: ${p2.currentWinStreak > 0 ? `${p2.currentWinStreak} wins in a row 🔥` : p2.currentLossStreak > 0 ? `${p2.currentLossStreak} losses in a row` : "No active streak"}
- Comeback Wins: ${p2.comebackWins} | Dominant Wins: ${p2.dominantWins} | Close Wins: ${p2.closeWins}
- Computed Win Probability: ${p2.winProb}%
- Predicted Score: ${p2.predictedScore}

## Head-to-Head
${data.headToHeadMatches.length > 0 ? `${data.headToHeadMatches.length} previous meeting(s):
${data.headToHeadMatches.map(m => `- ${m.p1Name} vs ${m.p2Name} → Winner: ${m.winner ?? "Draw"}`).join("\n")}` : "No previous meetings — first encounter."}

## Event Context
- Total Completed Matches: ${data.recentMatches.length}
${factsBullets ? `\n## Interesting Facts\n${factsBullets}` : ""}

## Your Analysis Task
Provide a **comprehensive match analysis** with:

1. **Win Probability** — Display both players' probabilities prominently with reasoning
2. **Key Stats Comparison** — Compare the most relevant stats
3. **Form Analysis** — Recent performance trends
4. **X-Factors** — Key things that could swing the match
5. **Prediction** — Final verdict with predicted scoreline

Keep it under 200 words. Use conversational, analyst tone. Bold the key numbers.`;
}

function buildWinProbabilityPrompt(data: AiRequestBody): string {
  const [p1, p2] = data.participants;
  return `You are a tournament analyst. Analyze this upcoming match in "${data.eventName}".

Player 1: ${p1.displayName} (Wins: ${p1.wins}, Losses: ${p1.losses}, Avg Score: ${p1.avgScoreFor})
Player 2: ${p2.displayName} (Wins: ${p2.wins}, Losses: ${p2.losses}, Avg Score: ${p2.avgScoreFor})

Head-to-head: ${data.headToHeadMatches.length} previous matches.
Recent form: ${p1.displayName} recent: ${p1.last5Results.join(", ")} | ${p2.displayName} recent: ${p2.last5Results.join(", ")}.

Provide:
1. Win probability percentage for each player
2. Key factors that might influence the outcome
3. A short prediction summary
Keep it concise, under 150 words.`;
}

function buildHeadToHeadPrompt(data: AiRequestBody): string {
  const [p1, p2] = data.participants;
  const h2h = data.headToHeadMatches;
  const p1Wins = h2h.filter(m => m.winner === p1.displayName).length;
  const p2Wins = h2h.filter(m => m.winner === p2.displayName).length;

  return `You are a tournament analyst. Provide head-to-head analysis for these two competitors in "${data.eventName}".

${p1.displayName} vs ${p2.displayName}
Head-to-head record: ${h2h.length} matches total. ${p1.displayName} leads ${p1Wins}-${p2Wins}${h2h.length === 0 ? " (first meeting)" : ""}.

Tournament form:
- ${p1.displayName}: ${p1.wins}W - ${p1.losses}L (streak: ${p1.currentWinStreak}W)
- ${p2.displayName}: ${p2.wins}W - ${p2.losses}L (streak: ${p2.currentWinStreak}W)

Provide:
1. Head-to-head summary
2. Any interesting patterns or facts
3. What each player needs to do to win
Keep it under 150 words.`;
}

export async function POST(request: NextRequest) {
  try {
    const body: AiRequestBody = await request.json();

    if (!body.type || !body.participants || body.participants.length < 2) {
      return NextResponse.json({ error: "Missing required fields: type, participants" }, { status: 400 });
    }

    const prompt = body.type === "head_to_head"
      ? buildHeadToHeadPrompt(body)
      : body.type === "insights"
        ? buildInsightsPrompt(body)
        : buildWinProbabilityPrompt(body);

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      const [p1, p2] = body.participants;
      const p1Form = p1.last5Results.map(r => getFormEmoji(r)).join("");
      const p2Form = p2.last5Results.map(r => getFormEmoji(r)).join("");
      let fallback = `## ${p1.displayName} vs ${p2.displayName}\n\n`;
      fallback += `**Win Probability:** ${p1.displayName} ${p1.winProb}% — ${p2.displayName} ${p2.winProb}%\n\n`;
      fallback += `**Predicted Score:** ${p1.predictedScore} — ${p2.predictedScore}\n\n`;
      if (p1.currentWinStreak >= 2) fallback += `🔥 ${p1.displayName} on a ${p1.currentWinStreak}-match win streak!\n`;
      if (p2.currentWinStreak >= 2) fallback += `🔥 ${p2.displayName} on a ${p2.currentWinStreak}-match win streak!\n`;
      fallback += `\n**Form:** ${p1.displayName} ${p1Form} | ${p2.displayName} ${p2Form}\n`;
      fallback += `\n**Stats:** ${p1.displayName} (${p1.wins}W-${p1.losses}L, avg ${p1.avgScoreFor}) vs ${p2.displayName} (${p2.wins}W-${p2.losses}L, avg ${p2.avgScoreFor})\n`;
      if (body.interestingFacts?.length) {
        fallback += `\n**Facts:**\n${body.interestingFacts.map(f => `- ${f}`).join("\n")}\n`;
      }
      fallback += `\n*AI analysis requires GROQ_API_KEY to be configured.*`;
      return NextResponse.json({ analysis: fallback, fallback: true });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a precise tournament analyst. Keep responses concise and data-driven. Output in plain markdown. Be engaging and highlight interesting patterns.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API error:", response.status, errText);
      return NextResponse.json({ error: "AI service temporarily unavailable" }, { status: 502 });
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content ?? "Unable to generate analysis.";

    return NextResponse.json({ analysis, fallback: false });
  } catch (err) {
    console.error("AI route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
