import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/api/files/authorize-upload/route.ts", "utf8");
const sharedSource = readFileSync("lib/upload-authorization.ts", "utf8");
const legacyUploadSource = readFileSync(
  "app/api/files/upload/route.ts",
  "utf8",
);
const deleteSource = readFileSync("app/api/files/delete/route.ts", "utf8");

test("upload authorization route enforces authenticated actor and file validation", () => {
  // The authorize endpoint delegates to the shared authorization module.
  assert.match(source, /authorizeUploadRequest\(/);
  assert.match(sharedSource, /requireActorContext/);
  assert.match(sharedSource, /validateFileUpload/);
  assert.match(sharedSource, /ALLOWED_ENTITY_TYPES/);
});

test("upload authorization route generates scoped R2 keys server-side", () => {
  assert.match(sharedSource, /buildKey\(/);
  assert.doesNotMatch(sharedSource, /formData\.get\(["']path["']\)/);
  assert.doesNotMatch(sharedSource, /body\.path/);
});

test("upload route authorizes inline through the shared authorization module", () => {
  // SECURITY: the upload route must NOT self-fetch the authorize endpoint
  // (Host-header sensitive). It re-authorizes directly with the same shared
  // code path and re-validates the actual bytes with magic-byte sniffing.
  assert.match(legacyUploadSource, /authorizeUploadRequest\(/);
  assert.match(legacyUploadSource, /validateBufferMagicBytes\(/);
  assert.doesNotMatch(legacyUploadSource, /new URL\("\/api\/files\/authorize-upload", req\.url\)/);
  assert.doesNotMatch(legacyUploadSource, /buildKey\(/);
});

test("file delete route only deletes private uploads within the actor tenant", () => {
  assert.match(
    deleteSource,
    /requireFeatureAccess\(access\.context, "files", "delete"\)/,
  );
  assert.match(deleteSource, /bucket !== "uploads"/);
  assert.match(deleteSource, /normalizedKey\.includes\("\.\."\)/);
  assert.match(
    deleteSource,
    /normalizedKey\.startsWith\(`\$\{access\.context\.schoolId\}\/`\)/,
  );
  assert.match(deleteSource, /deleteFile\(normalizedKey, "uploads"\)/);
});
