import assert from "node:assert/strict";
import { it } from "node:test";
import { toMediaPreviewUrl, toProxyUrl } from "./document-proxy";

it("uses stable authenticated thumbnails instead of expiring customer preview signatures", () => {
  process.env.FALCO_API_BASE_URL = "https://falco.goldencreations.online";
  const auth = "https://falco.goldencreations.online/customers/213/documents/2227";
  const signed = `${auth}/preview?expires=123&signature=old`;
  const first = toMediaPreviewUrl(signed, auth, 128);
  assert.equal(first, toMediaPreviewUrl(signed.replace("old", "new"), auth, 128));
  const params = new URLSearchParams(first!.split("?")[1]);
  assert.equal(params.get("url"), auth);
  assert.equal(params.get("width"), "128");
  assert.equal(new URLSearchParams(toProxyUrl(auth)!.split("?")[1]).has("width"), false);
});

it("preserves public, local and legacy media without forcing a customer thumbnail endpoint", () => {
  process.env.FALCO_API_BASE_URL = "https://falco.goldencreations.online";
  assert.equal(toMediaPreviewUrl("blob:local-photo", null), "blob:local-photo");
  assert.equal(toMediaPreviewUrl("https://cdn.example.com/photo.jpg", null), "https://cdn.example.com/photo.jpg");
  assert.equal(toMediaPreviewUrl(null, "https://falco.goldencreations.online/documents/123"), toProxyUrl("https://falco.goldencreations.online/documents/123"));
});
