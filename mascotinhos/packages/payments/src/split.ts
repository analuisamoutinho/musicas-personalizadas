export type AsaasSplit = {
  walletId: string;
  percentualValue?: number;
  fixedValue?: number;
};

export function buildSplitConfig(
  walletId: string,
  percentualValue: number
): AsaasSplit[] {
  return [{ walletId, percentualValue }];
}
