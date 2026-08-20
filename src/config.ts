import { create } from "@bufbuild/protobuf";
import { Config, ModuleConfig } from "@meshtastic/protobufs";
import type { FieldValue, InstanceConfig, InstancePreset, SectionDef, SectionId } from "./types";

export const PROFILE_VERSION = "2.7.26" as const;
export const MAX_PROFILE_BYTES = 512 * 1024;
export const sections: SectionDef[] = [
  { id: "device", schema: Config.Config_DeviceConfigSchema, target: "config", targetKey: "device", editable: ["role", "rebroadcastMode", "nodeInfoBroadcastSecs", "tzdef"] },
  { id: "lora", schema: Config.Config_LoRaConfigSchema, target: "config", targetKey: "lora", editable: ["usePreset", "modemPreset", "bandwidth", "spreadFactor", "codingRate", "region", "hopLimit", "txEnabled", "txPower", "channelNum", "overrideDutyCycle", "overrideFrequency", "ignoreMqtt", "configOkToMqtt"] },
  { id: "position", schema: Config.Config_PositionConfigSchema, target: "config", targetKey: "position", editable: ["positionBroadcastSecs", "positionBroadcastSmartEnabled", "fixedPosition", "gpsUpdateInterval", "positionFlags", "broadcastSmartMinimumDistance", "broadcastSmartMinimumIntervalSecs", "gpsMode"] },
  { id: "power", schema: Config.Config_PowerConfigSchema, target: "config", targetKey: "power", editable: ["isPowerSaving", "onBatteryShutdownAfterSecs", "waitBluetoothSecs", "sdsSecs", "lsSecs", "minWakeSecs"] },
  { id: "network", schema: Config.Config_NetworkConfigSchema, target: "config", targetKey: "network", editable: ["wifiEnabled", "wifiSsid", "wifiPsk", "ntpServer", "rsyslogServer", "enabledProtocols", "ipv6Enabled"], sensitive: ["wifiPsk"] },
  { id: "bluetooth", schema: Config.Config_BluetoothConfigSchema, target: "config", targetKey: "bluetooth", editable: ["enabled", "mode", "fixedPin"] },
  { id: "security", schema: Config.Config_SecurityConfigSchema, target: "config", targetKey: "security", editable: ["publicKey", "privateKey", "adminKey", "isManaged", "serialEnabled", "debugLogApiEnabled", "adminChannelEnabled"], sensitive: ["publicKey", "privateKey", "adminKey"] },
  { id: "mqtt", schema: ModuleConfig.ModuleConfig_MQTTConfigSchema, target: "moduleConfig", targetKey: "mqtt", editable: ["enabled", "address", "username", "password", "encryptionEnabled", "jsonEnabled", "tlsEnabled", "root", "proxyToClientEnabled", "mapReportingEnabled"], sensitive: ["password"] },
  { id: "neighborInfo", schema: ModuleConfig.ModuleConfig_NeighborInfoConfigSchema, target: "moduleConfig", targetKey: "neighborInfo", editable: ["enabled", "updateInterval", "transmitOverLora"] },
  { id: "storeForward", schema: ModuleConfig.ModuleConfig_StoreForwardConfigSchema, target: "moduleConfig", targetKey: "storeForward", editable: ["enabled", "heartbeat", "records", "historyReturnMax", "historyReturnWindow", "isServer"] },
  { id: "telemetry", schema: ModuleConfig.ModuleConfig_TelemetryConfigSchema, target: "moduleConfig", targetKey: "telemetry", editable: ["deviceUpdateInterval", "deviceTelemetryEnabled"] },
  { id: "statusmessage", schema: ModuleConfig.ModuleConfig_StatusMessageConfigSchema, target: "moduleConfig", targetKey: "statusmessage", editable: ["nodeStatus"], compatibility: "Firmware 2.7.20+" },
  { id: "trafficManagement", schema: ModuleConfig.ModuleConfig_TrafficManagementConfigSchema, target: "moduleConfig", targetKey: "trafficManagement", editable: ["enabled", "positionDedupEnabled", "positionPrecisionBits", "positionMinIntervalSecs", "nodeinfoDirectResponse", "nodeinfoDirectResponseMaxHops", "rateLimitEnabled", "rateLimitWindowSecs", "rateLimitMaxPackets", "dropUnknownEnabled", "unknownPacketThreshold", "exhaustHopTelemetry", "exhaustHopPosition", "routerPreserveHops"], compatibility: "Firmware 2.8.0+; current client support varies" },
];
export const sectionMap = Object.fromEntries(sections.map((section) => [section.id, section])) as Record<SectionId, SectionDef>;
function normalize(value: unknown): FieldValue { if (value instanceof Uint8Array) return btoa(String.fromCharCode(...value)); if (Array.isArray(value)) return value as number[]; if (["string", "number", "boolean", "bigint"].includes(typeof value)) return value as FieldValue; return ""; }
export function protobufDefaults(id: SectionId): Record<string, FieldValue> { const def = sectionMap[id]; const message = create(def.schema) as unknown as Record<string, unknown>; return Object.fromEntries(def.editable.map((field) => [field, normalize(message[field])])); }
export function effectiveDefaults(instance: InstanceConfig, preset: InstancePreset, format: string, id: SectionId, role = preset.defaults.role): Record<string, FieldValue> { const result = { ...protobufDefaults(id), ...(instance.defaults[format]?.[id] ?? {}), ...(instance.roleDefaults["*"]?.[id] ?? {}), ...(instance.roleDefaults[String(role)]?.[id] ?? {}) }; if (id === "device") Object.assign(result, { role: preset.defaults.role, tzdef: preset.defaults.timezone }); if (id === "lora") Object.assign(result, preset.defaults.lora); return result; }

export const FALLBACK_INSTANCE: InstanceConfig = {
  schemaVersion: 2, identity: { name: { nb: "Meshtastic nodekonfigurator", en: "Meshtastic Node Configurator" }, intro: { nb: "Lag og inspiser en Meshtastic-profil lokalt i nettleseren.", en: "Create and inspect a Meshtastic profile locally in your browser." } }, helpers: { norway: false },
  defaultFormat: "2.8", formats: [{ id: "2.8", label: "Meshtastic 2.8", protobufVersion: PROFILE_VERSION }, { id: PROFILE_VERSION, label: `Meshtastic ${PROFILE_VERSION}`, protobufVersion: PROFILE_VERSION }], defaults: { "2.8": {}, [PROFILE_VERSION]: {} }, roleDefaults: {}, defaultPreset: "neutral",
  presets: [{ id: "neutral", label: { nb: "Nøytral profil", en: "Neutral profile" }, description: { nb: "Ingen vertsdefinerte anbefalinger.", en: "No host recommendations." }, defaults: { role: 0, timezone: "", lora: {} } }], channelBundles: [], mqttProviders: [], regions: [],
};
export function validateInstance(value: unknown): InstanceConfig {
  if (!value || typeof value !== "object") throw new Error("Instance configuration is not an object");
  const c = value as InstanceConfig;
  if (c.schemaVersion !== 2 || !c.identity?.name?.nb || !c.identity?.name?.en) throw new Error("Unsupported or incomplete instance configuration");
  if (!Array.isArray(c.formats) || !c.formats.some((format) => format.id === PROFILE_VERSION) || !c.formats.some((format) => format.id === c.defaultFormat) || c.formats.some((format) => !format.id || !format.label || format.protobufVersion !== PROFILE_VERSION)) throw new Error("Current profile format is missing or unsupported");
  if (!c.defaults || typeof c.defaults !== "object") throw new Error("Versioned defaults are missing");
  if (!c.roleDefaults || typeof c.roleDefaults !== "object") throw new Error("Role defaults are missing");
  if (!Array.isArray(c.presets) || !c.presets.some((preset) => preset.id === c.defaultPreset)) throw new Error("Default preset does not exist");
  if (c.presets.some((preset) => !preset.id || !preset.label?.nb || !preset.label?.en || typeof preset.defaults?.role !== "number" || typeof preset.defaults?.timezone !== "string" || !preset.defaults?.lora)) throw new Error("Invalid preset");
  if (!Array.isArray(c.channelBundles) || c.channelBundles.some((bundle) => !bundle.id || !bundle.label?.nb || !bundle.label?.en || !Array.isArray(bundle.channels) || bundle.channels.some((channel) => !channel.name || typeof channel.psk !== "string"))) throw new Error("Invalid channel bundle");
  if (!Array.isArray(c.mqttProviders) || c.mqttProviders.some((provider) => !provider.id || !provider.label?.nb || !provider.label?.en || !provider.address || typeof provider.root !== "string")) throw new Error("Invalid MQTT provider");
  if (!Array.isArray(c.regions) || c.regions.some((region) => !region.id || !region.label || !Array.isArray(region.counties))) throw new Error("Invalid region mapping");
  return c;
}
