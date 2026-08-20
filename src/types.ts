import type { DescMessage } from "@bufbuild/protobuf";

export type Language = "nb" | "en";
export type Theme = "system" | "light" | "dark";

export type InstancePreset = {
  id: string;
  label: Record<Language, string>;
  description: Record<Language, string>;
  sourceUrl?: string;
  defaults: {
    role: number;
    timezone: string;
    lora: Record<string, boolean | number | string>;
  };
};

export type InstanceConfig = {
  schemaVersion: 1;
  identity: {
    name: Record<Language, string>;
    intro: Record<Language, string>;
    supportUrl?: string;
  };
  helpers: { norway: boolean };
  defaultPreset: string;
  presets: InstancePreset[];
};

export type FieldValue = string | number | boolean | bigint | Uint8Array | number[] | Uint8Array[];

export type SectionId =
  | "device"
  | "lora"
  | "position"
  | "power"
  | "network"
  | "bluetooth"
  | "security"
  | "mqtt"
  | "neighborInfo"
  | "storeForward"
  | "telemetry"
  | "statusmessage"
  | "trafficManagement";

export type SectionDef = {
  id: SectionId;
  schema: DescMessage;
  target: "config" | "moduleConfig";
  targetKey: string;
  editable: string[];
  sensitive?: string[];
  compatibility?: string;
};

export type SectionDraft = {
  included: boolean;
  selected: Record<string, boolean>;
  values: Record<string, FieldValue>;
  imported: boolean;
};

export type ChannelDraft = {
  id: string;
  name: string;
  psk: string;
  uplinkEnabled: boolean;
  downlinkEnabled: boolean;
  positionPrecision: number;
  primary: boolean;
};

export type LocationDraft = {
  latitude: string;
  longitude: string;
  altitude: string;
  municipalityNumber: string;
  municipalityCode: string;
  municipalityName: string;
  placeName: string;
  mode: "fixed" | "initial";
};

export type Draft = {
  schemaVersion: 1;
  profileFormat: "2.7.26";
  presetId: string;
  longNameMode: "convention" | "custom";
  naming: { roleCode: string; municipality: string; location: string; owner: string; suffix: string };
  longName: string;
  shortName: string;
  identitySelected: { longName: boolean; shortName: boolean };
  channelsIncluded: boolean;
  channels: ChannelDraft[];
  sections: Record<SectionId, SectionDraft>;
  location: LocationDraft;
  importedBinary?: string;
  importedFileName?: string;
  preserveImported: { topLevel: boolean; config: boolean; moduleConfig: boolean };
};

export type ExportWarning = {
  id: string;
  level: "info" | "warning" | "strict";
  text: string;
};
