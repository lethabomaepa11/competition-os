export const SPORT_CATEGORIES = [
  { value: "football", label: "Football / Soccer" },
  { value: "futsal", label: "Futsal" },
  { value: "rugby", label: "Rugby" },
  { value: "basketball", label: "Basketball" },
  { value: "cricket", label: "Cricket" },
  { value: "esports", label: "Esports" },
  { value: "combat_sports", label: "Combat sports" },
  { value: "motorsport", label: "Motorsport" },
  { value: "other", label: "Other discipline" },
] as const;

export const TEAM_TYPES = [
  { value: "club", label: "Club" },
  { value: "academy", label: "Academy" },
  { value: "school", label: "School" },
  { value: "university", label: "University" },
  { value: "community", label: "Community team" },
  { value: "national_team", label: "National team" },
  { value: "esports_org", label: "Esports organization" },
] as const;

export function categoryLabel(value?: string) {
  return SPORT_CATEGORIES.find((item) => item.value === value)?.label ?? value?.replace(/_/g, " ") ?? "Competition";
}

export function teamTypeLabel(value?: string) {
  return TEAM_TYPES.find((item) => item.value === value)?.label ?? value?.replace(/_/g, " ") ?? "Team";
}
