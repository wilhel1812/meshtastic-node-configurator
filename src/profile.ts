import { clone, create, fromBinary, toBinary, toJson } from "@bufbuild/protobuf";
import { AppOnly, Channel, ClientOnly, LocalOnly, Mesh } from "@meshtastic/protobufs";
import { PROFILE_VERSION, sectionMap, sections } from "./config";
import type { ChannelDraft, Draft, ExportWarning, FieldValue, InstancePreset, LocationDraft, SectionDraft, SectionId } from "./types";
import { byteLength } from "../vendor/nodenavngenerator/src/nameGenerator";

const DEFAULT_CHANNEL_KEY = "AQ==";

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function base64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fieldDefaults(sectionId: SectionId): Record<string, FieldValue> {
  const definition = sectionMap[sectionId];
  const message = create(definition.schema) as unknown as Record<string, FieldValue>;
  return Object.fromEntries(definition.editable.map((name) => [name, normalizeValue(message[name])]));
}

function normalizeValue(value: unknown): FieldValue {
  if (value instanceof Uint8Array) return bytesToBase64(value);
  if (Array.isArray(value)) {
    if (value.every((item) => item instanceof Uint8Array)) return value.map((item) => bytesToBase64(item)) as unknown as Uint8Array[];
    return value as number[];
  }
  if (typeof value === "bigint" || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  return "";
}

function denormalizeValue(value: FieldValue, scalar?: number, list = false): unknown {
  if (scalar === 12) {
    if (list) return Array.isArray(value) ? value.map((item) => base64ToBytes(String(item))) : [];
    return base64ToBytes(String(value));
  }
  if (scalar === 4 || scalar === 6 || scalar === 18) return BigInt(String(value || 0));
  return value;
}

export function createSection(sectionId: SectionId, included = false): SectionDraft {
  const definition = sectionMap[sectionId];
  return {
    included,
    imported: false,
    selected: Object.fromEntries(definition.editable.map((name) => [name, false])),
    values: fieldDefaults(sectionId),
  };
}

export function createDraft(preset: InstancePreset): Draft {
  const draftSections = Object.fromEntries(sections.map(({ id }) => [id, createSection(id)])) as Record<SectionId, SectionDraft>;
  draftSections.device.included = true;
  draftSections.device.selected.role = true;
  draftSections.device.values.role = preset.defaults.role;
  draftSections.device.values.tzdef = preset.defaults.timezone;
  draftSections.lora.included = true;
  for (const [key, value] of Object.entries(preset.defaults.lora)) {
    if (key in draftSections.lora.values) {
      draftSections.lora.values[key] = value;
      draftSections.lora.selected[key] = true;
    }
  }

  return {
    schemaVersion: 1,
    profileFormat: PROFILE_VERSION,
    presetId: preset.id,
    longNameMode: "convention",
    naming: { roleCode: roleCodeForValue(preset.defaults.role), municipality: "", location: "", owner: "", suffix: "" },
    longName: "",
    shortName: "",
    identitySelected: { longName: true, shortName: true },
    channelsIncluded: true,
    channels: [{ id: crypto.randomUUID(), name: "", psk: DEFAULT_CHANNEL_KEY, uplinkEnabled: false, downlinkEnabled: false, positionPrecision: 0, primary: true }],
    sections: draftSections,
    location: emptyLocation(),
    preserveImported: { topLevel: true, config: true, moduleConfig: true },
  };
}

export function emptyLocation(): LocationDraft {
  return { latitude: "", longitude: "", altitude: "", municipalityNumber: "", municipalityCode: "", municipalityName: "", placeName: "", mode: "fixed" };
}

export function roleCodeForValue(value: number): string {
  return ({ 0: "C", 1: "M", 2: "R", 5: "T", 6: "S", 8: "H", 9: "F", 10: "E", 11: "L", 12: "B" } as Record<number, string>)[value] ?? "";
}

function channelSettings(channel: ChannelDraft) {
  return create(Channel.ChannelSettingsSchema, {
    name: channel.name,
    psk: base64ToBytes(channel.psk),
    uplinkEnabled: channel.uplinkEnabled,
    downlinkEnabled: channel.downlinkEnabled,
    moduleSettings: create(Channel.ModuleSettingsSchema, { positionPrecision: channel.positionPrecision }),
  });
}

export function channelUrlFromDraft(draft: Draft, includeLora: boolean): string {
  const ordered = [...draft.channels].sort((a, b) => Number(b.primary) - Number(a.primary));
  const input: Record<string, unknown> = { settings: ordered.map(channelSettings) };
  if (includeLora && draft.sections.lora.included) input.loraConfig = buildSectionMessage(draft.sections.lora, "lora");
  const set = create(AppOnly.ChannelSetSchema, input);
  return `https://meshtastic.org/e/#${base64Url(toBinary(AppOnly.ChannelSetSchema, set))}`;
}

export function parseChannelUrl(value: string): { channels: ChannelDraft[]; lora?: Record<string, FieldValue> } {
  const payload = value.trim().includes("#") ? value.trim().split("#").pop() ?? "" : value.trim();
  if (!payload) throw new Error("The channel URL does not contain a payload");
  const set = fromBinary(AppOnly.ChannelSetSchema, base64ToBytes(payload)) as Record<string, any>;
  if (!Array.isArray(set.settings) || set.settings.length === 0 || set.settings.length > 8) throw new Error("The channel set must contain between one and eight channels");
  const channels = set.settings.map((settings: Record<string, any>, index: number) => ({
    id: crypto.randomUUID(),
    name: settings.name ?? "",
    psk: bytesToBase64(settings.psk ?? new Uint8Array()),
    uplinkEnabled: Boolean(settings.uplinkEnabled),
    downlinkEnabled: Boolean(settings.downlinkEnabled),
    positionPrecision: Number(settings.moduleSettings?.positionPrecision ?? 0),
    primary: index === 0,
  }));
  const lora = set.loraConfig ? readFields("lora", set.loraConfig) : undefined;
  return { channels, lora };
}

function buildSectionMessage(section: SectionDraft, id: SectionId, imported?: unknown): Record<string, unknown> {
  const definition = sectionMap[id];
  const message = imported ? clone(definition.schema, imported as never) as Record<string, unknown> : create(definition.schema) as Record<string, unknown>;
  const defaults = create(definition.schema) as Record<string, unknown>;
  for (const field of definition.schema.fields) {
    if (!definition.editable.includes(field.localName)) continue;
    const value = section.selected[field.localName] ? section.values[field.localName] : normalizeValue(defaults[field.localName]);
    message[field.localName] = denormalizeValue(value, field.scalar, field.fieldKind === "list");
  }
  if (id === "lora") {
    if (message.usePreset) {
      message.bandwidth = 0;
      message.spreadFactor = 0;
      message.codingRate = 0;
    } else {
      message.modemPreset = 0;
    }
  }
  return message;
}

function readFields(id: SectionId, message: Record<string, unknown>): Record<string, FieldValue> {
  const definition = sectionMap[id];
  return Object.fromEntries(definition.editable.map((field) => [field, normalizeValue(message[field])]));
}

function decodedBase(draft: Draft): Record<string, any> {
  if (!draft.importedBinary) return create(ClientOnly.DeviceProfileSchema) as Record<string, any>;
  return fromBinary(ClientOnly.DeviceProfileSchema, base64ToBytes(draft.importedBinary), { readUnknownFields: true }) as Record<string, any>;
}

export function buildProfile(draft: Draft): Record<string, any> {
  const profile = decodedBase(draft);
  if (!draft.preserveImported.topLevel) {
    profile.ringtone = undefined;
    profile.cannedMessages = undefined;
    profile.$unknown = [];
  }
  profile.longName = draft.identitySelected.longName ? draft.longName : undefined;
  profile.shortName = draft.identitySelected.shortName ? draft.shortName : undefined;
  profile.channelUrl = draft.channelsIncluded ? channelUrlFromDraft(draft, draft.sections.lora.included) : undefined;

  const configSections = sections.filter(({ target }) => target === "config");
  const moduleSections = sections.filter(({ target }) => target === "moduleConfig");
  const hasConfig = configSections.some(({ id }) => draft.sections[id].included) || (draft.preserveImported.config && Boolean(profile.config));
  const hasModules = moduleSections.some(({ id }) => draft.sections[id].included) || (draft.preserveImported.moduleConfig && Boolean(profile.moduleConfig));
  const existingConfig = profile.config;
  const existingModules = profile.moduleConfig;
  profile.config = hasConfig ? (draft.preserveImported.config && existingConfig ? clone(LocalOnly.LocalConfigSchema, existingConfig) : create(LocalOnly.LocalConfigSchema)) : undefined;
  profile.moduleConfig = hasModules ? (draft.preserveImported.moduleConfig && existingModules ? clone(LocalOnly.LocalModuleConfigSchema, existingModules) : create(LocalOnly.LocalModuleConfigSchema)) : undefined;

  for (const definition of sections) {
    const container = profile[definition.target] as Record<string, unknown> | undefined;
    if (!container) continue;
    if (!draft.sections[definition.id].included) {
      container[definition.targetKey] = undefined;
      continue;
    }
    const existing = (profile[definition.target] as Record<string, unknown> | undefined)?.[definition.targetKey];
    container[definition.targetKey] = buildSectionMessage(draft.sections[definition.id], definition.id, existing);
  }

  const latitude = Number(draft.location.latitude);
  const longitude = Number(draft.location.longitude);
  if (draft.sections.position.included && Number.isFinite(latitude) && Number.isFinite(longitude) && draft.location.latitude !== "" && draft.location.longitude !== "") {
    profile.fixedPosition = create(Mesh.PositionSchema, {
      latitudeI: Math.round(latitude * 1e7),
      longitudeI: Math.round(longitude * 1e7),
      altitude: draft.location.altitude === "" ? 0 : Math.round(Number(draft.location.altitude)),
    });
    if (profile.config?.position) profile.config.position.fixedPosition = draft.location.mode === "fixed";
  } else {
    profile.fixedPosition = undefined;
  }
  return profile;
}

export function encodeProfile(draft: Draft): Uint8Array {
  return toBinary(ClientOnly.DeviceProfileSchema, buildProfile(draft) as never, { writeUnknownFields: true });
}

export function profileJson(draft: Draft): unknown {
  return toJson(ClientOnly.DeviceProfileSchema, buildProfile(draft) as never, { emitDefaultValues: false, enumAsInteger: false });
}

export function importProfile(bytes: Uint8Array, fileName: string): Draft {
  const profile = fromBinary(ClientOnly.DeviceProfileSchema, bytes, { readUnknownFields: true }) as Record<string, any>;
  const neutral: InstancePreset = { id: "imported", label: { nb: "Importert", en: "Imported" }, description: { nb: "", en: "" }, defaults: { role: 0, timezone: "", lora: {} } };
  const draft = createDraft(neutral);
  draft.presetId = "imported";
  draft.importedBinary = bytesToBase64(bytes);
  draft.importedFileName = fileName;
  draft.longName = profile.longName ?? "";
  draft.shortName = profile.shortName ?? "";
  draft.longNameMode = "custom";
  draft.identitySelected = { longName: profile.longName !== undefined, shortName: profile.shortName !== undefined };

  for (const definition of sections) {
    const message = profile[definition.target]?.[definition.targetKey] as Record<string, unknown> | undefined;
    const section = draft.sections[definition.id];
    section.included = Boolean(message);
    section.imported = Boolean(message);
    if (message) {
      section.values = readFields(definition.id, message);
      section.selected = Object.fromEntries(definition.editable.map((name) => [name, true]));
    }
  }

  draft.channelsIncluded = Boolean(profile.channelUrl);
  if (profile.channelUrl) {
    try {
      const imported = parseChannelUrl(profile.channelUrl);
      draft.channels = imported.channels;
    } catch {
      draft.channels = [{ id: crypto.randomUUID(), name: "", psk: DEFAULT_CHANNEL_KEY, uplinkEnabled: false, downlinkEnabled: false, positionPrecision: 0, primary: true }];
    }
  }
  if (profile.fixedPosition) {
    draft.location.latitude = String(Number(profile.fixedPosition.latitudeI ?? 0) / 1e7);
    draft.location.longitude = String(Number(profile.fixedPosition.longitudeI ?? 0) / 1e7);
    draft.location.altitude = String(profile.fixedPosition.altitude ?? "");
    draft.location.mode = profile.config?.position?.fixedPosition ? "fixed" : "initial";
  }
  return draft;
}

export function shortNameSuggestions(owner: string, location: string): string[] {
  const suggestions: string[] = [];
  for (const source of [owner, location]) {
    const words = source.normalize("NFC").trim().split(/[\s-]+/).filter(Boolean);
    const initials = words.map((word) => Array.from(word)[0]).join("").toLocaleUpperCase("nb-NO");
    if (initials && byteLength(initials) <= 4) suggestions.push(initials);
    let leading = "";
    for (const character of Array.from(source.normalize("NFC").toLocaleUpperCase("nb-NO").replace(/\s/g, ""))) {
      if (byteLength(leading + character) > 4) break;
      leading += character;
    }
    if (leading) suggestions.push(leading);
  }
  return [...new Set(suggestions)].slice(0, 4);
}

export function validateDraft(draft: Draft): string[] {
  const errors: string[] = [];
  if (draft.longNameMode === "convention" && draft.identitySelected.longName && (!draft.naming.roleCode || !draft.naming.municipality || !draft.naming.location)) errors.push("The naming convention requires role, municipality, and location");
  if (draft.identitySelected.longName && (!draft.longName || byteLength(draft.longName) > 24)) errors.push("Long name must contain 1–24 UTF-8 bytes");
  if (draft.identitySelected.shortName && (!draft.shortName || byteLength(draft.shortName) > 4)) errors.push("Short name must contain 1–4 UTF-8 bytes");
  if (draft.channelsIncluded && (draft.channels.length < 1 || draft.channels.length > 8)) errors.push("A channel set must contain 1–8 channels");
  for (const channel of draft.channels) {
    if (byteLength(channel.name) > 11) errors.push("Channel names must be shorter than 12 UTF-8 bytes");
    try {
      const length = base64ToBytes(channel.psk).length;
      if (![0, 1, 16, 32].includes(length)) errors.push("Channel keys must contain 0, 1, 16, or 32 bytes");
    } catch { errors.push("Channel keys must be valid Base64"); }
  }
  const hasAnything = draft.identitySelected.longName || draft.identitySelected.shortName || draft.channelsIncluded || Object.values(draft.sections).some((section) => section.included);
  if (!hasAnything) errors.push("Select at least one value or section");
  const hop = Number(draft.sections.lora.values.hopLimit);
  if (hop < 0 || hop > 7) errors.push("Hop limit must be between 0 and 7");
  const lat = draft.location.latitude === "" ? NaN : Number(draft.location.latitude);
  const lon = draft.location.longitude === "" ? NaN : Number(draft.location.longitude);
  if ((Number.isFinite(lat) && (lat < -90 || lat > 90)) || (Number.isFinite(lon) && (lon < -180 || lon > 180))) errors.push("Coordinates are outside valid ranges");
  if (draft.sections.security.included) {
    for (const field of ["publicKey", "privateKey"] as const) {
      if (!draft.sections.security.selected[field]) continue;
      try { if (base64ToBytes(String(draft.sections.security.values[field])).length !== 32) errors.push(`${field} must contain exactly 32 bytes`); }
      catch { errors.push(`${field} must be valid Base64`); }
    }
  }
  return errors;
}

export function exportWarnings(draft: Draft): ExportWarning[] {
  const warnings: ExportWarning[] = [];
  if (draft.sections.device.included && Number(draft.sections.device.values.role) === 2) warnings.push({ id: "router", level: "strict", text: "Router is an infrastructure role. Use it only for a deliberately placed, continuously available node." });
  if (draft.sections.lora.included && Number(draft.sections.lora.values.hopLimit) > 3) warnings.push({ id: "hops", level: "strict", text: "Hop limits above 3 increase mesh traffic and must be used deliberately." });
  if (draft.channelsIncluded && !draft.sections.lora.included) warnings.push({ id: "channel-only", level: "warning", text: "This channel-only profile is not applied consistently by current Apple clients." });
  if (draft.channels.some((channel) => !["", DEFAULT_CHANNEL_KEY].includes(channel.psk))) warnings.push({ id: "channel-key", level: "strict", text: "This artifact contains custom channel keys. Anyone who receives it can join those channels." });
  const sensitive = sections.some((definition) => definition.sensitive?.some((field) => draft.sections[definition.id].included && draft.sections[definition.id].selected[field] && String(draft.sections[definition.id].values[field] ?? "") !== ""));
  if (sensitive) warnings.push({ id: "secrets", level: "strict", text: "This profile contains passwords or cryptographic keys. Share it only with trusted recipients." });
  if (draft.location.latitude && draft.location.longitude) warnings.push({ id: "location", level: "warning", text: "This profile contains exact coordinates." });
  return warnings;
}

export function unknownSummary(draft: Draft): { topLevel: number; preservedBytes: number } {
  if (!draft.importedBinary) return { topLevel: 0, preservedBytes: 0 };
  const profile = decodedBase(draft);
  const unknown = Array.isArray(profile.$unknown) ? profile.$unknown : [];
  return { topLevel: unknown.length, preservedBytes: unknown.reduce((sum: number, field: { data?: Uint8Array }) => sum + (field.data?.byteLength ?? 0), 0) };
}
