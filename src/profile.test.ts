import { fromBinary } from "@bufbuild/protobuf";
import { AppOnly, ClientOnly } from "@meshtastic/protobufs";
import { describe, expect, it } from "vitest";
import { byteLength, generateName } from "../vendor/nodenavngenerator/src/nameGenerator";
import { base64ToBytes, createDraft, encodeProfile, importProfile, parseChannelUrl, profileJson, shortNameSuggestions, validateDraft } from "./profile";
import type { InstancePreset } from "./types";

const preset: InstancePreset = {
  id: "norway-recommended",
  label: { nb: "Anbefalt", en: "Recommended" },
  description: { nb: "", en: "" },
  defaults: {
    role: 1,
    timezone: "CET-1CEST,M3.5.0,M10.5.0/3",
    lora: { usePreset: false, bandwidth: 62, spreadFactor: 8, codingRate: 5, region: 3, hopLimit: 3, txEnabled: true, overrideFrequency: 869.618 },
  },
};

describe("native profile adapter", () => {
  it("encodes the recommended radio and standard primary channel", () => {
    const draft = createDraft(preset);
    draft.naming = { roleCode: "M", municipality: "OSL", location: "TEST", owner: "", suffix: "" };
    draft.longName = "M-OSL-TEST";
    draft.shortName = "TEST";
    const bytes = encodeProfile(draft);
    const profile = fromBinary(ClientOnly.DeviceProfileSchema, bytes) as any;
    expect(profile.config.lora).toMatchObject({ usePreset: false, bandwidth: 62, spreadFactor: 8, codingRate: 5, region: 3, hopLimit: 3 });
    expect(profile.config.lora.overrideFrequency).toBeCloseTo(869.618, 2);
    const channels = parseChannelUrl(profile.channelUrl);
    expect(channels.channels).toHaveLength(1);
    expect(channels.channels[0].name).toBe("");
    expect(Array.from(base64ToBytes(channels.channels[0].psk))).toEqual([1]);
    expect(channels.lora?.bandwidth).toBe(62);
  });

  it("preserves unknown wire fields across an import and export", () => {
    const draft = createDraft(preset);
    draft.identitySelected = { longName: false, shortName: false };
    const known = encodeProfile(draft);
    const withUnknown = new Uint8Array([...known, 0xa0, 0x06, 0x2a]);
    const imported = importProfile(withUnknown, "future.cfg");
    const decoded = fromBinary(ClientOnly.DeviceProfileSchema, encodeProfile(imported), { readUnknownFields: true }) as any;
    expect(decoded.$unknown).toHaveLength(1);
    expect(decoded.$unknown[0].no).toBe(100);
  });

  it("checks every supported imported field", () => {
    const imported = importProfile(encodeProfile(createDraft(preset)), "profile.cfg");
    expect(imported.sections.device.included).toBe(true);
    expect(imported.sections.lora.included).toBe(true);
    expect(Object.values(imported.sections.lora.selected).every(Boolean)).toBe(true);
  });

  it("allows a channels-only profile and omits LoRa from the URL", () => {
    const draft = createDraft(preset);
    draft.sections.lora.included = false;
    const profile = fromBinary(ClientOnly.DeviceProfileSchema, encodeProfile(draft)) as any;
    const payload = profile.channelUrl.split("#")[1];
    const channelSet = fromBinary(AppOnly.ChannelSetSchema, base64ToBytes(payload)) as any;
    expect(channelSet.loraConfig).toBeUndefined();
  });

  it("produces official JSON without default-only unchecked values", () => {
    const json = profileJson(createDraft(preset)) as any;
    expect(json.config.device.role).toBe("CLIENT_MUTE");
    expect(json.config.device.tzdef).toBeUndefined();
  });
});

describe("name contracts", () => {
  it("uses the pinned generator byte and truncation behavior", () => {
    const result = generateName({ role: "M", municipality: "OSL", location: "ET VELDIG LANGT STEDSNAVN", owner: "WF", suffix: "" });
    expect(result.copyable).toBe(true);
    expect(byteLength(result.displayName)).toBeLessThanOrEqual(24);
    expect(result.truncated).toBe(true);
  });

  it("suggests byte-safe short names", () => {
    for (const suggestion of shortNameSuggestions("Wilhelm Francke", "Årvoll")) expect(byteLength(suggestion)).toBeLessThanOrEqual(4);
  });

  it("rejects invalid selected identity values", () => {
    const draft = createDraft(preset);
    draft.longName = "";
    draft.shortName = "🛰️";
    expect(validateDraft(draft)).toContain("Long name must contain 1–24 UTF-8 bytes");
    expect(validateDraft(draft)).toContain("Short name must contain 1–4 UTF-8 bytes");
  });
});
