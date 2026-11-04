export type ChartNode = { id: number; code: string; name: string; description?: string | null; origin?: string; type: string; parent_id: number | null; account_id: number | null; deleted_at?: string | null; next_code?: string | null; has_posted_history?: boolean; posting_rule_ready?: boolean; account?: { code: string; is_active: boolean; is_postable: boolean; normal_balance: string; report_category?: string | null; metadata?: { guided_setup?: { mode: string; register: string; help: string } } } | null };

export function chartDeleteConfirmation(node: ChartNode): string {
  return `Are you sure you want to delete this ${node.account_id === null ? "group" : "account"}?`;
}

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

export type AccountPurpose = { value: string; label: string; report_label: string; report_line: string; account_types: string[]; mode: "register" | "settlement" | "review"; register: string; normal_balance: string; help: string };

export function compatibleAccountPurposes(purposes: AccountPurpose[], type: string): AccountPurpose[] {
  return purposes.filter(purpose => purpose.account_types.includes(type));
}

export function chartAccountReadiness(node: ChartNode): string {
  if (!node.account_id || node.origin === "loan_system") return "";
  if (!node.account?.report_category) return "Needs setup";
  if (node.account.metadata?.guided_setup?.mode === "review") return "Needs accounting review";
  if (node.account.metadata?.guided_setup?.mode === "settlement" || node.account.report_category.startsWith("bs.cash.")) return "Money account ready";
  return node.posting_rule_ready ? "Ready to record" : "Needs setup";
}
