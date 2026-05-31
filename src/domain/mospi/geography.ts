import type { Geography } from "./types";

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findGeographyByName(
  registry: ReadonlyArray<Geography>,
  name: string,
): Geography | null {
  const target = normalizeName(name);
  return (
    registry.find((geo) => {
      if (normalizeName(geo.name) === target) return true;
      return geo.aliases.some((alias) => normalizeName(alias) === target);
    }) ?? null
  );
}

export function hasGeographyId(
  registry: ReadonlyArray<Geography>,
  geographyId: string,
): boolean {
  return registry.some((geo) => geo.geography_id === geographyId);
}
