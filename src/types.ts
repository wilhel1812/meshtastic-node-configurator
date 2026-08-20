import type { DescMessage } from "@bufbuild/protobuf";

export type Language = "nb" | "en";
export type Theme = "system" | "light" | "dark";
export type Localized = Record<Language, string>;
export type FieldValue = string | number | boolean | bigint | Uint8Array | number[] | Uint8Array[];
export type InstancePreset = { id: string; label: Localized; description: Localized; sourceUrl?: string; defaults: { role: number; timezone: string; lora: Record<string, FieldValue> } };
export type ChannelDraft = { id: string; name: string; psk: string; uplinkEnabled: boolean; downlinkEnabled: boolean; positionPrecision: number; primary: boolean };
export type ChannelTemplate = Omit<ChannelDraft, "id" | "primary">;
export type ChannelBundle = { id: string; label: Localized; description: Localized; additive: boolean; channels: ChannelTemplate[] };
export type MqttProvider = { id: string; label: Localized; recommended?: boolean; address: string; username: string; password: string; root: string; regionalRoot?: string; encryptionEnabled: boolean; tlsEnabled: boolean };

export type SectionId = "device" | "lora" | "position" | "power" | "network" | "bluetooth" | "security" | "mqtt" | "neighborInfo" | "storeForward" | "telemetry" | "statusmessage" | "trafficManagement";
export type InstanceConfig = {
  schemaVersion: 2;
  identity: { name: Localized; intro: Localized; supportUrl?: string };
  helpers: { norway: boolean };
  namingConventionUrl?: string;
  formats: Array<{ id: "2.7.26"; label: string }>;
  defaults: Record<string, Partial<Record<SectionId, Record<string, FieldValue>>>>;
  defaultPreset: string;
  presets: InstancePreset[];
  channelBundles: ChannelBundle[];
  mqttProviders: MqttProvider[];
  regions: Array<{ id: string; label: string; counties: string[] }>;
};
export type SectionDef = { id: SectionId; schema: DescMessage; target: "config" | "moduleConfig"; targetKey: string; editable: string[]; sensitive?: string[]; compatibility?: string };
export type SectionDraft = { included: boolean; values: Record<string, FieldValue>; imported: boolean };
export type LocationDraft = { latitude: string; longitude: string; altitude: string; municipalityNumber: string; municipalityCode: string; municipalityName: string; countyName: string; placeName: string; placeNameEdited: boolean; municipalityOverride: boolean };
export type GuidedDraft = { radio: "community" | "custom"; roleChosen: boolean; gps: "" | "enabled" | "disabled" | "absent"; mapReporting: boolean; mqttConsent: boolean; mqttProvider: string; mqttRegionRequired: boolean; mqttTransport: "proxy" | "wifi"; mqttRegion: string };
export type Draft = {
  schemaVersion: 2; profileFormat: "2.7.26"; presetId: string; customLongName: boolean;
  naming: { roleCode: string; municipality: string; location: string; owner: string; suffix: string };
  longName: string; shortName: string; channelsIncluded: boolean; channels: ChannelDraft[];
  sections: Record<SectionId, SectionDraft>; location: LocationDraft; guided: GuidedDraft;
  importedBinary?: string; importedFileName?: string;
  preserveImported: { topLevel: boolean; config: boolean; moduleConfig: boolean };
};
export type ExportWarning = { id: string; level: "info" | "warning" | "strict"; text: string };
export type ChannelImport = { channels: ChannelDraft[]; lora?: Record<string, FieldValue>; additive: boolean };
