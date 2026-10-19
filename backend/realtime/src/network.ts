export const REGION_CENTERS = {
  wnam: [37, -122], enam: [39, -77], weur: [51, 0], eeur: [52, 25],
  apac: [25, 121], oc: [-33, 151],
} as const;
export type NetworkRegion = keyof typeof REGION_CENTERS;
export const isNetworkRegion = (value: unknown): value is NetworkRegion => typeof value === "string" && value in REGION_CENTERS;
const distance = (a: readonly number[], b: readonly number[]) => {
  const radians = Math.PI / 180;
  const lat = (a[0] + b[0]) / 2 * radians;
  const longitude = Math.min(Math.abs(a[1] - b[1]), 360 - Math.abs(a[1] - b[1]));
  return Math.hypot(a[0] - b[0], longitude * Math.cos(lat));
};
export const regionDistance = (a?: NetworkRegion, b?: NetworkRegion) => a && b ? distance(REGION_CENTERS[a], REGION_CENTERS[b]) : 180;
export const ingressRegion = (request: Request): NetworkRegion => {
  const cf = request.cf;
  const lat = Number(cf?.latitude), lon = Number(cf?.longitude);
  if (!cf?.latitude || !cf?.longitude || !Number.isFinite(lat) || !Number.isFinite(lon)) return "enam";
  if (cf.continent === "NA") return lon < -100 ? "wnam" : "enam";
  return (Object.keys(REGION_CENTERS) as NetworkRegion[]).sort((a, b) => distance([lat, lon], REGION_CENTERS[a]) - distance([lat, lon], REGION_CENTERS[b]))[0];
};
export const matchRegion = (players: Array<{ isBot?: boolean; networkRegion?: NetworkRegion }>): NetworkRegion => {
  const regions = players.filter((p) => !p.isBot).map((p) => p.networkRegion).filter(isNetworkRegion);
  if (!regions.length) return "enam";
  return (Object.keys(REGION_CENTERS) as NetworkRegion[]).sort((a, b) => {
    const score = (region: NetworkRegion) => Math.max(...regions.map((r) => regionDistance(r, region)));
    return score(a) - score(b) || Number(b === regions[0]) - Number(a === regions[0]);
  })[0];
};
