export type ChartNode = { id: number; code: string; name: string; description?: string | null; type: string; parent_id: number | null; account_id: number | null; deleted_at?: string | null; next_code?: string | null; account?: { code: string; is_active: boolean; is_postable: boolean; normal_balance: string } | null };

export function nextChartCode(parent: ChartNode, nodes: ChartNode[]): string | null {
  if (parent.next_code !== undefined) return parent.next_code;
  const step = parent.parent_id === null ? 100 : 1;
  const start = Number(parent.code);
  const used = new Set(nodes.filter(node => node.parent_id === parent.id).map(node => node.code));
  const end = start + (step === 100 ? 900 : 99);
  for (let code = start + step; code <= end; code += step) {
    if (!used.has(String(code))) return String(code);
  }
  return null;
}

export function matchingChartNodes(nodes: ChartNode[], search: string): ChartNode[] {
  const term = search.trim().toLowerCase();
  if (!term) return nodes;
  const ids = new Set(nodes.filter(node => `${node.code} ${node.name} ${node.account?.code ?? ""}`.toLowerCase().includes(term)).map(node => node.id));
  for (const node of nodes) {
    if (!ids.has(node.id)) continue;
    let parent = nodes.find(candidate => candidate.id === node.parent_id);
    const visited = new Set<number>();
    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id);
      ids.add(parent.id);
      parent = nodes.find(candidate => candidate.id === parent!.parent_id);
    }
  }
  return nodes.filter(node => ids.has(node.id));
}
