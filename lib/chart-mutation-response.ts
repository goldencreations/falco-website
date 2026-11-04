const unavailable = "The General Ledger service could not complete this request. Please try again.";

export async function readChartMutationResponse(response: Response): Promise<void> {
  let payload: { message?: unknown; errors?: Record<string, unknown>; error?: { message?: string; details?: { message?: string }[] } };
  try {
    payload = await response.json();
  } catch {
    throw new Error(unavailable);
  }
  if (!payload || typeof payload !== "object") throw new Error(unavailable);
  if (!response.ok) {
    const messages = Object.values(payload.errors ?? {}).flat().filter((value): value is string => typeof value === "string");
    throw new Error(payload.error?.details?.[0]?.message ?? messages[0] ?? payload.error?.message ?? (typeof payload.message === "string" ? payload.message : "The account change could not be saved."));
  }
}
