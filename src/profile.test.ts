import { fromBinary } from "@bufbuild/protobuf";
import { ClientOnly } from "@meshtastic/protobufs";
import { describe, expect, it } from "vitest";
import publicInstance from "../public/instance.json";
import { byteLength, generateName } from "../vendor/nodenavngenerator/src/nameGenerator";
import { applyChannelImport, buildProfile, createDraft, encodeProfile, importProfile, migrateDraft, parseChannelUrl, previewAdditiveChannels, resetField, shortNameSuggestions } from "./profile";
import type { ChannelDraft, InstanceConfig } from "./types";

const instance = publicInstance as unknown as InstanceConfig;
function validDraft() { const draft = createDraft(instance); draft.guided.roleChosen = true; draft.guided.gps = "enabled"; draft.naming = { roleCode: "M", municipality: "OSL", location: "TEST", owner: "", suffix: "" }; draft.longName = "M-OSL-TEST"; draft.shortName = "TEST"; return draft; }
const channel = (name: string, uplinkEnabled = true): ChannelDraft => ({ id: crypto.randomUUID(), name, psk: "AQ==", uplinkEnabled, downlinkEnabled: true, positionPrecision: 0, primary: false });

describe("full-section profile encoding", () => {
  it("encodes every current LoRa value and exact Norway settings", () => { const profile = buildProfile(validDraft()); expect(profile.config.lora).toMatchObject({ usePreset: false, bandwidth: 62, spreadFactor: 8, codingRate: 5, region: 3, txEnabled: true, txPower: 27, channelNum: 4 }); expect(profile.config.lora.overrideFrequency).toBeCloseTo(869.618, 3); });
  it("omits a whole unchecked section", () => { const draft = validDraft(); draft.sections.lora.included = false; expect(buildProfile(draft).config.lora).toBeUndefined(); });
  it("always exports an entered initial position while GPS controls later behavior", () => { const draft = validDraft(); draft.location.latitude = "59.91"; draft.location.longitude = "10.75"; draft.sections.position.values.gpsMode = 1; draft.sections.position.values.fixedPosition = false; const profile = buildProfile(draft); expect(profile.fixedPosition.latitudeI).toBe(599100000); expect(profile.config.position).toMatchObject({ gpsMode: 1, fixedPosition: false }); });
  it.each([["enabled", 1, false], ["disabled", 0, true], ["absent", 2, true]] as const)("encodes the %s GPS answer", (_answer, mode, fixed) => { const draft = validDraft(); draft.sections.position.values.gpsMode = mode; draft.sections.position.values.fixedPosition = fixed; expect(buildProfile(draft).config.position).toMatchObject({ gpsMode: mode, fixedPosition: fixed }); });
  it("exports map defaults and MQTT consent", () => { const draft = validDraft(); draft.sections.mqtt.included = true; draft.guided.mapReporting = true; draft.sections.mqtt.values.enabled = true; draft.sections.lora.values.configOkToMqtt = true; const profile = buildProfile(draft); expect(profile.moduleConfig.mqtt.mapReportSettings).toMatchObject({ shouldReportLocation: true, positionPrecision: 14, publishIntervalSecs: 3600 }); expect(profile.config.lora.configOkToMqtt).toBe(true); });
});

describe("defaults, migration, and preservation", () => {
  it.each([[2, 14400, false], [11, 14400, false], [12, 14400, false], [0, 3600, true], [1, 3600, true], [5, 3600, true]] as const)("uses the role-specific position defaults for role %s", (role, interval, smart) => { const draft = validDraft(); draft.sections.device.values.role = role; const resetInterval = resetField(draft, instance, "positionBroadcastSecs", "position"); const resetSmart = resetField(draft, instance, "positionBroadcastSmartEnabled", "position"); expect(resetInterval.sections.position.values.positionBroadcastSecs).toBe(interval); expect(resetSmart.sections.position.values.positionBroadcastSmartEnabled).toBe(smart); });
  it("resets imported edits to the effective instance default", () => { const draft = validDraft(); draft.sections.lora.values.txPower = 9; expect(resetField(draft, instance, "txPower", "lora").sections.lora.values.txPower).toBe(27); });
  it("migrates selected v1 values and defaults unselected values", () => { const old: any = validDraft(); old.schemaVersion = 1; old.sections.lora.selected = { txPower: true, bandwidth: false }; old.sections.lora.values.txPower = 12; old.sections.lora.values.bandwidth = 250; const migrated = migrateDraft(old, instance); expect(migrated.sections.lora.values.txPower).toBe(12); expect(migrated.sections.lora.values.bandwidth).toBe(62); expect(migrated.schemaVersion).toBe(2); });
  it("preserves unknown wire fields across import and re-export", () => { const known = encodeProfile(validDraft()); const future = new Uint8Array([...known, 0xa0, 0x06, 0x2a]); const imported = importProfile(future, "future.cfg", instance); const decoded = fromBinary(ClientOnly.DeviceProfileSchema, encodeProfile(imported), { readUnknownFields: true }) as any; expect(decoded.$unknown[0].no).toBe(100); });
  it("allows an imported profile to be edited and re-exported", () => { const imported = importProfile(encodeProfile(validDraft()), "node.cfg", instance); imported.sections.device.values.role = 2; const decoded = fromBinary(ClientOnly.DeviceProfileSchema, encodeProfile(imported)) as any; expect(decoded.config.device.role).toBe(2); });
});

describe("public instance contracts", () => {
  it("targets 2.8 by default while retaining the 2.7.26 baseline", () => { expect(instance.defaultFormat).toBe("2.8"); expect(instance.formats).toEqual([{ id: "2.8", label: "Meshtastic 2.8", protobufVersion: "2.7.26" }, { id: "2.7.26", label: "Meshtastic 2.7.26", protobufVersion: "2.7.26" }]); expect(createDraft(instance).profileFormat).toBe("2.8"); });
  it("keeps both MQTT providers and exact 868.no topic credentials", () => { expect(instance.mqttProviders.map((p) => p.id)).toEqual(["868", "official"]); expect(instance.mqttProviders[0]).toMatchObject({ address: "mqtt.868.no:1883", username: "meshdev", password: "large4cats", regionalRoot: "msh/EU_868/NO/<region>", encryptionEnabled: true, tlsEnabled: false }); });
  it("keeps the additive five-channel Norway bundle exact", () => { const bundle = instance.channelBundles[0]; expect(bundle.additive).toBe(true); expect(bundle.channels.map((c) => c.name)).toEqual(["Nord-Norge", "Trøndelag", "Østlandet", "Vestlandet", "Sørlandet"]); expect(bundle.channels.every((c) => c.psk === "AQ==" && c.uplinkEnabled && c.downlinkEnabled && c.positionPrecision === 0)).toBe(true); });
});

describe("additive channels", () => {
  it("detects duplicates and same-name conflicts without mutating", () => { const current = [channel("Primary"), channel("Nord-Norge")]; current[0].primary = true; const duplicate = channel("Nord-Norge"), conflict = channel("Primary", false), fresh = channel("Vestlandet"); const preview = previewAdditiveChannels(current, [duplicate, conflict, fresh]); expect(preview.duplicates).toHaveLength(1); expect(preview.conflicts).toHaveLength(1); expect(preview.additions.map((c) => c.name)).toEqual(["Vestlandet"]); expect(current).toHaveLength(2); });
  it("preserves channel zero and observes the eight-channel limit", () => { const current = Array.from({ length: 7 }, (_, i) => channel(i ? `C${i}` : "Primary")); current[0].primary = true; const result = applyChannelImport(current, [channel("A"), channel("B")], true); expect(result).toHaveLength(8); expect(result[0].name).toBe("Primary"); expect(result[0].primary).toBe(true); });
  it("honours add=true URL semantics", () => { const draft = validDraft(); draft.channelsIncluded = true; draft.channels = [channel("Nord-Norge")]; draft.channels[0].primary = true; const parsed = parseChannelUrl((awaitImportUrl(draft))); expect(parsed.additive).toBe(true); });
});
function awaitImportUrl(draft: ReturnType<typeof validDraft>) { const url = new URL("https://meshtastic.org/e/?add=true"); const normal = buildProfile(draft).channelUrl as string; url.hash = normal.split("#")[1]; return url.toString(); }

describe("unchanged name generator", () => {
  it("retains exact pinned output and byte truncation", () => { const result = generateName({ role: "M", municipality: "OSL", location: "ET VELDIG LANGT STEDSNAVN", owner: "WF", suffix: "" }); expect(result.displayName).toBe("M-OSL-ET VELDIG LANGT-WF"); expect(byteLength(result.displayName)).toBeLessThanOrEqual(24); });
  it("provides byte-safe short suggestions including Unicode inputs", () => { for (const suggestion of shortNameSuggestions("Wilhelm Francke", "Årvoll")) expect(byteLength(suggestion)).toBeLessThanOrEqual(4); });
});
