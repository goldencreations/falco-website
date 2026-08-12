import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FILE_TOO_LARGE_MESSAGE,
  PHOTO_MAX_BYTES,
  POST_MAX_BYTES,
  UPLOAD_SERVER_ERROR_MESSAGE,
  batchFilesForPostLimit,
  formatUploadHttpError,
  largePhotoWarning,
  validateCombinedUploadSize,
} from "./upload-limits";

function fakeFile(name: string, size: number, type = "image/jpeg"): File {
  const buffer = new Uint8Array(Math.min(size, 8));
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("formatUploadHttpError", () => {
  it("maps 413 to the file-too-large message", () => {
    assert.equal(formatUploadHttpError(413, {}, "fallback"), FILE_TOO_LARGE_MESSAGE);
  });

  it("maps 500 to a generic server error that keeps the customer saved", () => {
    assert.equal(formatUploadHttpError(500, { message: "boom" }, "fallback"), UPLOAD_SERVER_ERROR_MESSAGE);
  });

  it("keeps API messages for other client errors", () => {
    assert.equal(formatUploadHttpError(422, { message: "Invalid type" }, "fallback"), "Invalid type");
  });
});

describe("validateCombinedUploadSize", () => {
  it("accepts a batch under the POST ceiling", () => {
    const check = validateCombinedUploadSize([fakeFile("a.jpg", 2 * 1024 * 1024)]);
    assert.equal(check.ok, true);
  });

  it("rejects a combined batch over the POST ceiling", () => {
    const check = validateCombinedUploadSize([
      fakeFile("a.jpg", 30 * 1024 * 1024),
      fakeFile("b.jpg", 30 * 1024 * 1024),
    ]);
    assert.equal(check.ok, false);
    if (!check.ok) assert.match(check.error, /together are/i);
  });
});

describe("batchFilesForPostLimit", () => {
  it("splits oversized batches", () => {
    const files = [
      fakeFile("a.jpg", 30 * 1024 * 1024),
      fakeFile("b.jpg", 30 * 1024 * 1024),
    ];
    const batches = batchFilesForPostLimit(files);
    assert.equal(batches.length, 2);
    assert.ok(batches.every((batch) => batch.reduce((s, f) => s + f.size, 0) <= POST_MAX_BYTES));
  });
});

describe("largePhotoWarning", () => {
  it("warns for large phone photos under the hard limit", () => {
    const warning = largePhotoWarning(fakeFile("IMG_0001.jpg", 12 * 1024 * 1024));
    assert.ok(warning);
    assert.match(warning ?? "", /compressed before upload/i);
    assert.ok(12 * 1024 * 1024 < PHOTO_MAX_BYTES);
  });

  it("does not warn for small photos", () => {
    assert.equal(largePhotoWarning(fakeFile("small.jpg", 400 * 1024)), null);
  });
});
