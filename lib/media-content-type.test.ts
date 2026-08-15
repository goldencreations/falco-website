import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isGenericBinaryContentType,
  resolveImageContentType,
  sniffImageMimeType,
} from "./media-content-type";

describe("sniffImageMimeType", () => {
  it("detects jpeg", () => {
    assert.equal(sniffImageMimeType(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0)), "image/jpeg");
  });

  it("detects png", () => {
    assert.equal(
      sniffImageMimeType(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0)),
      "image/png"
    );
  });

  it("detects webp", () => {
    const bytes = new Uint8Array(12);
    bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    assert.equal(sniffImageMimeType(bytes), "image/webp");
  });
});

describe("resolveImageContentType", () => {
  it("keeps a real image content-type when magic bytes match", () => {
    const jpeg = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0);
    assert.equal(resolveImageContentType("image/jpeg", jpeg), "image/jpeg");
  });

  it("replaces octet-stream with sniffed jpeg", () => {
    const jpeg = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0);
    assert.equal(resolveImageContentType("application/octet-stream", jpeg), "image/jpeg");
    assert.equal(isGenericBinaryContentType("application/octet-stream"), true);
  });

  it("uses filename hint when bytes are not sniffed", () => {
    const empty = new Uint8Array(12);
    assert.equal(
      resolveImageContentType("application/octet-stream", empty, "IMG_6629.jpeg"),
      "image/jpeg"
    );
  });
});
