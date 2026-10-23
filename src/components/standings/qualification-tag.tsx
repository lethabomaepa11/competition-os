"use client";

import { Tag } from "antd";
import type { StandingsEntry } from "@/domain/formats/interface";

interface Props {
  entry: StandingsEntry;
  /** Full event standings, used to name the entrant a replacement stands in for. */
  standings: StandingsEntry[];
}

/** Group-stage qualification label shared by the standings and rankings views. */
export function QualificationTag({ entry, standings }: Props) {
  const status = entry.qualificationStatus ?? (entry.qualified ? "projected" : "outside");
  if (status === "withdrawn") return <Tag color="red">Withdrawn</Tag>;
  if (status === "replacement") {
    const replaced = standings.find((e) => e.participantId === entry.replacesParticipantId)?.displayName.trim();
    return <Tag color="blue">{replaced ? `Replaces ${replaced}` : "Replacement"}</Tag>;
  }
  const label = status === "clinched" ? "Qualified" : status === "projected" ? "In place" : "Outside";
  return <Tag color={status === "outside" ? "default" : "blue"}>{label}</Tag>;
}
