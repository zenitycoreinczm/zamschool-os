import test from "node:test";
import assert from "node:assert/strict";

import {
  humanizeFetchFailure,
  humanizeHttpError,
  isRetriableNetworkError,
  NETWORK_ERROR_MESSAGE,
  RATE_LIMIT_MESSAGE,
  SERVER_UNAVAILABLE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from "../../lib/client-api-errors.ts";

test("humanizeHttpError maps common statuses", () => {
  assert.equal(humanizeHttpError(401), SESSION_EXPIRED_MESSAGE);
  assert.equal(humanizeHttpError(429), RATE_LIMIT_MESSAGE);
  assert.equal(humanizeHttpError(503), SERVER_UNAVAILABLE_MESSAGE);
  assert.equal(humanizeHttpError(400, "Class number is required"), "Class number is required");
});

test("humanizeFetchFailure classifies network and timeout", () => {
  assert.equal(
    humanizeFetchFailure(new TypeError("Failed to fetch")),
    NETWORK_ERROR_MESSAGE,
  );
  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.equal(humanizeFetchFailure(abort), TIMEOUT_ERROR_MESSAGE);
});

test("isRetriableNetworkError only matches transient failures", () => {
  assert.equal(isRetriableNetworkError(new TypeError("Failed to fetch")), true);
  const abort = new Error("timeout");
  abort.name = "AbortError";
  assert.equal(isRetriableNetworkError(abort), false);
});
