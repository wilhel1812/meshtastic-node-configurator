import type { Language, SectionId } from "./types";

export const ui = {
  nb: {
    skip: "Hopp til innhold", import: "Importer", newProfile: "Ny profil", clear: "Slett lokale data", export: "Eksporter .cfg",
    profile: "Profil", identity: "Nodeidentitet", namingConvention: "Navnekonvensjon", customName: "Egendefinert navn", longName: "Langt navn", shortName: "Kort navn", suggestion: "Forslag",
    role: "Rolle", municipality: "Kommune", location: "Sted", owner: "Eier", suffix: "Suffiks", choose: "Velg…",
    channels: "Kanaler", addChannel: "Legg til kanal", primary: "Primær", secondary: "Sekundær", channelName: "Kanalnavn", key: "Nøkkel", generate128: "Lag AES-128", generate256: "Lag AES-256", defaultKey: "Standardnøkkel", noEncryption: "Ingen kryptering", remove: "Fjern", moveUp: "Flytt opp", moveDown: "Flytt ned",
    positionMap: "Plassering", latitude: "Breddegrad", longitude: "Lengdegrad", altitude: "Høyde", useLocation: "Bruk min posisjon", lookUp: "Finn stedsdata", fixed: "Fast posisjon", initial: "Startposisjon",
    preview: "Forhåndsvisning", readable: "Lesbar", raw: "Rådata", included: "Inkludert", omitted: "Utelatt", importedOnly: "Importert, skrivebeskyttet", bytes: "byte",
    localNotice: "Alt behandles lokalt. Kart- og stedsoppslag sender koordinater til tjenesteleverandøren.", secretNotice: "Denne nettleseren lagrer hele utkastet, også passord, nøkler og koordinater, til du sletter det.",
    importTitle: "Importer Meshtastic-profil", drop: "Slipp en .cfg-fil her, eller velg fil", pasteUrl: "Lim inn kanal-URL", scanQr: "Skann QR", merge: "Forhåndsvis og slå sammen", cancel: "Avbryt", confirm: "Bekreft", close: "Lukk",
    exportReview: "Kontroller eksport", download: "Last ned profil", acknowledgements: "Bekreftelser", success: "Profilen er lastet ned", instructions: "Slik importerer du", clearConfirm: "Dette sletter utkastet, også lokale passord og nøkler.", replaceConfirm: "Dette erstatter gjeldende utkast.",
    invalidInstance: "Vertsoppsettet kunne ikke lastes. En nøytral redigerer brukes.", offline: "Frakoblet: kart og stedsoppslag er utilgjengelige.", updateReady: "En ny versjon er klar.", reload: "Last inn på nytt", compatibility: "Kompatibilitet", required: "Påkrevd", selected: "Ta med", section: "Ta med seksjonen", details: "Detaljer", copied: "Kopiert", copy: "Kopier", downloadQr: "Last ned QR", channelUrl: "Kanal-URL", inspect: "Inspiser",
  },
  en: {
    skip: "Skip to content", import: "Import", newProfile: "New profile", clear: "Clear local data", export: "Export .cfg",
    profile: "Profile", identity: "Node identity", namingConvention: "Naming convention", customName: "Custom name", longName: "Long name", shortName: "Short name", suggestion: "Suggestion",
    role: "Role", municipality: "Municipality", location: "Location", owner: "Owner", suffix: "Suffix", choose: "Choose…",
    channels: "Channels", addChannel: "Add channel", primary: "Primary", secondary: "Secondary", channelName: "Channel name", key: "Key", generate128: "Generate AES-128", generate256: "Generate AES-256", defaultKey: "Default key", noEncryption: "No encryption", remove: "Remove", moveUp: "Move up", moveDown: "Move down",
    positionMap: "Location", latitude: "Latitude", longitude: "Longitude", altitude: "Elevation", useLocation: "Use my location", lookUp: "Look up place data", fixed: "Fixed position", initial: "Initial position",
    preview: "Preview", readable: "Readable", raw: "Raw", included: "Included", omitted: "Omitted", importedOnly: "Imported, read-only", bytes: "bytes",
    localNotice: "Everything is processed locally. Map and place lookups send coordinates to the service provider.", secretNotice: "This browser stores the complete draft, including passwords, keys and coordinates, until you clear it.",
    importTitle: "Import Meshtastic profile", drop: "Drop a .cfg file here, or choose a file", pasteUrl: "Paste channel URL", scanQr: "Scan QR", merge: "Preview and merge", cancel: "Cancel", confirm: "Confirm", close: "Close",
    exportReview: "Review export", download: "Download profile", acknowledgements: "Acknowledgements", success: "Profile downloaded", instructions: "How to import", clearConfirm: "This removes the draft, including locally stored passwords and keys.", replaceConfirm: "This replaces the current draft.",
    invalidInstance: "The host configuration could not be loaded. A neutral editor is being used.", offline: "Offline: maps and place lookups are unavailable.", updateReady: "A new version is ready.", reload: "Reload", compatibility: "Compatibility", required: "Required", selected: "Include", section: "Include section", details: "Details", copied: "Copied", copy: "Copy", downloadQr: "Download QR", channelUrl: "Channel URL", inspect: "Inspect",
  },
} as const;

export const sectionLabels: Record<Language, Record<SectionId, string>> = {
  nb: { device: "Enhet", lora: "LoRa-radio", position: "Posisjon og GPS", power: "Strøm", network: "Wi-Fi og nettverk", bluetooth: "Bluetooth", security: "Sikkerhet", mqtt: "MQTT", neighborInfo: "Naboinformasjon", storeForward: "Lagre og videresend", telemetry: "Enhetstelemetri", statusmessage: "Statusmelding", trafficManagement: "Trafikkstyring" },
  en: { device: "Device", lora: "LoRa radio", position: "Position and GPS", power: "Power", network: "Wi-Fi and network", bluetooth: "Bluetooth", security: "Security", mqtt: "MQTT", neighborInfo: "Neighbor info", storeForward: "Store and forward", telemetry: "Device telemetry", statusmessage: "Status message", trafficManagement: "Traffic management" },
};

const fieldNb: Record<string, string> = {
  role: "Rolle", rebroadcastMode: "Videresendingsmodus", nodeInfoBroadcastSecs: "Nodeinfo-intervall (sek)", tzdef: "Tidssone (POSIX)", usePreset: "Bruk modempreset", modemPreset: "Modempreset", bandwidth: "Båndbredde", spreadFactor: "Spredningsfaktor", codingRate: "Koderate", region: "Region", hopLimit: "Hop-grense", txEnabled: "Sending aktivert", txPower: "Sendeeffekt", channelNum: "Kanalnummer", overrideDutyCycle: "Overstyr arbeidssyklus", overrideFrequency: "Overstyr frekvens (MHz)", ignoreMqtt: "Ignorer MQTT-pakker", configOkToMqtt: "Tillat MQTT", wifiEnabled: "Wi-Fi aktivert", wifiSsid: "Wi-Fi-navn", wifiPsk: "Wi-Fi-passord", ntpServer: "NTP-tjener", enabled: "Aktivert", password: "Passord", username: "Brukernavn", address: "Adresse", publicKey: "Offentlig nøkkel", privateKey: "Privat nøkkel", adminKey: "Adminnøkler" };

export function fieldLabel(name: string, language: Language): string {
  if (language === "nb" && fieldNb[name]) return fieldNb[name];
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
}
