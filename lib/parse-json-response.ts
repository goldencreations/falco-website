/** Parse a fetch Response body as JSON; avoids "Unexpected end of JSON input" on empty bodies. */
export async function parseJsonResponse<T = unknown>(
 res: Response
): Promise<{ data: T | null; text: string }> {
 const text = await res.text();
 if (!text.trim()) {
 return { data: null, text };
 }
 try {
 return { data: JSON.parse(text) as T, text };
 } catch {
 throw new Error(
 res.ok
 ? "Server returned invalid JSON"
 : `Request failed (${res.status}) with a non-JSON response`
 );
 }
}
