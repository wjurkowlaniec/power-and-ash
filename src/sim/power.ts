/** Power network: nodes with ports, cables as edges, balance per connected component. */

export interface PowerNode {
  id: string;
  produce: number; // W
  demand: number;  // W
}

export interface NetworkState {
  nodes: string[];
  production: number;
  demand: number;
  balance: number;
  powered: boolean;
}

export function solveNetworks(nodes: PowerNode[], edges: [string, string][]): Map<string, NetworkState> {
  const parent = new Map<string, string>();
  const find = (a: string): string => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  for (const n of nodes) parent.set(n.id, n.id);
  for (const [a, b] of edges) if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b));

  const groups = new Map<string, PowerNode[]>();
  for (const n of nodes) {
    const r = find(n.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(n);
  }
  const out = new Map<string, NetworkState>();
  for (const g of groups.values()) {
    const production = g.reduce((s, n) => s + n.produce, 0);
    const demand = g.reduce((s, n) => s + n.demand, 0);
    const st: NetworkState = {
      nodes: g.map(n => n.id), production, demand,
      balance: production - demand,
      powered: production > 0 && production >= demand,
    };
    for (const n of g) out.set(n.id, st);
  }
  return out;
}
