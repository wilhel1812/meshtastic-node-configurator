import { Config, ModuleConfig } from "@meshtastic/protobufs";
import type { InstanceConfig, SectionDef } from "./types";

export const PROFILE_VERSION = "2.7.26";
export const MAX_PROFILE_BYTES = 512 * 1024;

export const FALLBACK_INSTANCE: InstanceConfig = {
  schemaVersion: 1,
  identity: {
    name: { nb: "Meshtastic nodekonfigurator", en: "Meshtastic Node Configurator" },
    intro: {
      nb: "Lag og inspiser en Meshtastic-profil lokalt i nettleseren.",
      en: "Create and inspect a Meshtastic profile locally in your browser.",
    },
  },
  helpers: { norway: false },
  defaultPreset: "neutral",
  presets: [
    {
      id: "neutral",
      label: { nb: "Nøytral profil", en: "Neutral profile" },
      description: { nb: "Ingen vertsdefinerte anbefalinger.", en: "No host recommendations." },
      defaults: { role: 0, timezone: "", lora: {} },
    },
  ],
};

export function validateInstance(value: unknown): InstanceConfig {
  if (!value || typeof value !== "object") throw new Error("Instance configuration is not an object");
  const candidate = value as InstanceConfig;
  if (candidate.schemaVersion !== 1 || !candidate.identity?.name?.nb || !candidate.identity?.name?.en) {
    throw new Error("Unsupported or incomplete instance configuration");
  }
  if (!Array.isArray(candidate.presets) || candidate.presets.length === 0) throw new Error("At least one preset is required");
  if (!candidate.presets.some((preset) => preset.id === candidate.defaultPreset)) throw new Error("Default preset does not exist");
  for (const preset of candidate.presets) {
    if (!preset.id || !preset.label?.nb || !preset.label?.en || !preset.defaults || typeof preset.defaults.role !== "number") {
      throw new Error("Invalid preset");
    }
  }
  return candidate;
}

export const sections: SectionDef[] = [
  {
    id: "device",
    schema: Config.Config_DeviceConfigSchema,
    target: "config",
    targetKey: "device",
    editable: ["role", "rebroadcastMode", "nodeInfoBroadcastSecs", "tzdef"],
  },
  {
    id: "lora",
    schema: Config.Config_LoRaConfigSchema,
    target: "config",
    targetKey: "lora",
    editable: ["usePreset", "modemPreset", "bandwidth", "spreadFactor", "codingRate", "region", "hopLimit", "txEnabled", "txPower", "channelNum", "overrideDutyCycle", "overrideFrequency", "ignoreMqtt", "configOkToMqtt"],
  },
  {
    id: "position",
    schema: Config.Config_PositionConfigSchema,
    target: "config",
    targetKey: "position",
    editable: ["positionBroadcastSecs", "positionBroadcastSmartEnabled", "fixedPosition", "gpsUpdateInterval", "positionFlags", "broadcastSmartMinimumDistance", "broadcastSmartMinimumIntervalSecs", "gpsMode"],
  },
  {
    id: "power",
    schema: Config.Config_PowerConfigSchema,
    target: "config",
    targetKey: "power",
    editable: ["isPowerSaving", "onBatteryShutdownAfterSecs", "waitBluetoothSecs", "sdsSecs", "lsSecs", "minWakeSecs"],
  },
  {
    id: "network",
    schema: Config.Config_NetworkConfigSchema,
    target: "config",
    targetKey: "network",
    editable: ["wifiEnabled", "wifiSsid", "wifiPsk", "ntpServer", "rsyslogServer", "enabledProtocols", "ipv6Enabled"],
    sensitive: ["wifiPsk"],
  },
  {
    id: "bluetooth",
    schema: Config.Config_BluetoothConfigSchema,
    target: "config",
    targetKey: "bluetooth",
    editable: ["enabled", "mode", "fixedPin"],
  },
  {
    id: "security",
    schema: Config.Config_SecurityConfigSchema,
    target: "config",
    targetKey: "security",
    editable: ["publicKey", "privateKey", "adminKey", "isManaged", "serialEnabled", "debugLogApiEnabled", "adminChannelEnabled"],
    sensitive: ["publicKey", "privateKey", "adminKey"],
  },
  {
    id: "mqtt",
    schema: ModuleConfig.ModuleConfig_MQTTConfigSchema,
    target: "moduleConfig",
    targetKey: "mqtt",
    editable: ["enabled", "address", "username", "password", "encryptionEnabled", "jsonEnabled", "tlsEnabled", "root", "proxyToClientEnabled", "mapReportingEnabled"],
    sensitive: ["password"],
  },
  {
    id: "neighborInfo",
    schema: ModuleConfig.ModuleConfig_NeighborInfoConfigSchema,
    target: "moduleConfig",
    targetKey: "neighborInfo",
    editable: ["enabled", "updateInterval", "transmitOverLora"],
  },
  {
    id: "storeForward",
    schema: ModuleConfig.ModuleConfig_StoreForwardConfigSchema,
    target: "moduleConfig",
    targetKey: "storeForward",
    editable: ["enabled", "heartbeat", "records", "historyReturnMax", "historyReturnWindow", "isServer"],
  },
  {
    id: "telemetry",
    schema: ModuleConfig.ModuleConfig_TelemetryConfigSchema,
    target: "moduleConfig",
    targetKey: "telemetry",
    editable: ["deviceUpdateInterval", "deviceTelemetryEnabled"],
  },
  {
    id: "statusmessage",
    schema: ModuleConfig.ModuleConfig_StatusMessageConfigSchema,
    target: "moduleConfig",
    targetKey: "statusmessage",
    editable: ["nodeStatus"],
    compatibility: "Firmware 2.7.20+",
  },
  {
    id: "trafficManagement",
    schema: ModuleConfig.ModuleConfig_TrafficManagementConfigSchema,
    target: "moduleConfig",
    targetKey: "trafficManagement",
    editable: ["enabled", "positionDedupEnabled", "positionPrecisionBits", "positionMinIntervalSecs", "nodeinfoDirectResponse", "nodeinfoDirectResponseMaxHops", "rateLimitEnabled", "rateLimitWindowSecs", "rateLimitMaxPackets", "dropUnknownEnabled", "unknownPacketThreshold", "exhaustHopTelemetry", "exhaustHopPosition", "routerPreserveHops"],
    compatibility: "Firmware 2.8.0+; current client support varies",
  },
];

export const sectionMap = Object.fromEntries(sections.map((section) => [section.id, section]));
