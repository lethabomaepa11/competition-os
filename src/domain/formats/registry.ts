import { FormatType } from "../types";
import { type FormatStrategy } from "./interface";
import { LeagueFormat } from "./league";
import { SingleEliminationFormat } from "./single-elimination";
import { DoubleEliminationFormat } from "./double-elimination";
import { SwissFormat } from "./swiss";
import { GroupStageFormat } from "./group-stage";

const registry = new Map<string, FormatStrategy>();

export function registerFormat(type: string, strategy: FormatStrategy): void {
  registry.set(type, strategy);
}

export function getFormat(type: string): FormatStrategy {
  const strategy = registry.get(type);
  if (!strategy) throw new Error(`Unknown format: ${type}`);
  return strategy;
}

export function getRegisteredFormats(): string[] {
  return Array.from(registry.keys());
}

registerFormat(FormatType.League, new LeagueFormat());
registerFormat(FormatType.SingleElimination, new SingleEliminationFormat());
registerFormat(FormatType.DoubleElimination, new DoubleEliminationFormat());
registerFormat(FormatType.Swiss, new SwissFormat());
registerFormat(FormatType.GroupStage, new GroupStageFormat());
