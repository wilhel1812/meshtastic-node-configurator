import { describe, expect, it } from "vitest";
import { FALLBACK_INSTANCE, validateInstance } from "./config";

describe("instance configuration", () => {
  it("accepts a valid public instance", () => expect(validateInstance(FALLBACK_INSTANCE)).toBe(FALLBACK_INSTANCE));
  it("rejects a missing default preset", () => expect(() => validateInstance({ ...FALLBACK_INSTANCE, defaultPreset: "missing" })).toThrow(/Default preset/));
  it("rejects an unknown schema", () => expect(() => validateInstance({ ...FALLBACK_INSTANCE, schemaVersion: 99 })).toThrow(/Unsupported/));
  it("rejects malformed public collections before use", () => expect(() => validateInstance({ ...FALLBACK_INSTANCE, mqttProviders: [{ id: "broken" }] })).toThrow(/MQTT/));
});
