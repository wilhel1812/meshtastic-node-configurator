import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Config } from "@meshtastic/protobufs";
import QRCode from "qrcode";
import { AlertTriangle, Check, ChevronDown, Copy, Download, FileUp, Github, Globe2, MapPin, Monitor, Moon, Plus, QrCode, RotateCcw, Sun, Trash2, Upload } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { sections, sectionMap, FALLBACK_INSTANCE, MAX_PROFILE_BYTES, validateInstance } from "./config";
import { fieldLabel, sectionLabels, ui } from "./i18n";
import { MapPicker } from "./MapPicker";
import { QrScanner } from "./QrScanner";
import { base64ToBytes, bytesToBase64, channelUrlFromDraft, createDraft, encodeProfile, exportWarnings, importProfile, parseChannelUrl, profileJson, roleCodeForValue, shortNameSuggestions, unknownSummary, validateDraft } from "./profile";
import type { Draft, FieldValue, InstanceConfig, Language, SectionId, Theme } from "./types";
import { byteLength, generateName } from "../vendor/nodenavngenerator/src/nameGenerator";
import { municipalities } from "../vendor/nodenavngenerator/src/municipalities";
import { roles } from "../vendor/nodenavngenerator/src/roles";
import "./styles.css";

const STORAGE_KEY = "meshtastic-node-configurator:draft:v1";
const LANGUAGE_KEY = "meshtastic-node-configurator:language";
const THEME_KEY = "meshtastic-node-configurator:theme";
const emoji = [
  ["📡", "antenna radio"], ["🏔", "mountain"], ["🚗", "car"], ["🏠", "home"], ["🚲", "bike"], ["🛰", "satellite"],
  ["🦊", "fox"], ["🐻", "bear"], ["🐝", "bee"], ["🌲", "tree"], ["🔥", "fire"], ["⚡", "lightning"], ["☀", "sun"], ["☁", "cloud"],
] as const;

function initialLanguage(): Language {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved === "nb" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("no") || navigator.language.toLowerCase().startsWith("nb") || navigator.language.toLowerCase().startsWith("nn") ? "nb" : "en";
}

function loadSavedDraft(): Draft | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Draft | null;
    return parsed?.schemaVersion === 1 ? { ...parsed, preserveImported: parsed.preserveImported ?? { topLevel: true, config: true, moduleConfig: true } } : null;
  } catch { return null; }
}

function enumOptions(schema: any, fieldName: string) {
  return schema.fields.find((field: any) => field.localName === fieldName)?.enum?.values ?? [];
}

function FieldEditor({ sectionId, name, value, selected, language, sensitive, onSelected, onChange }: {
  sectionId: SectionId; name: string; value: FieldValue; selected: boolean; language: Language; sensitive: boolean;
  onSelected: (value: boolean) => void; onChange: (value: FieldValue) => void;
}) {
  const definition = sectionMap[sectionId];
  const field = definition.schema.fields.find((candidate) => candidate.localName === name);
  const id = `${sectionId}-${name}`;
  const label = fieldLabel(name, language);
  const enumValues = field?.fieldKind === "enum" ? enumOptions(definition.schema, name) : [];
  const isBoolean = field?.fieldKind === "scalar" && field.scalar === 8;
  const isBytes = field?.scalar === 12;
  const isString = field?.scalar === 9;
  const isList = field?.fieldKind === "list";

  return (
    <div className={`field-row${selected ? " selected" : ""}`}>
      <label className="field-select" title={ui[language].selected}>
        <input type="checkbox" checked={selected} onChange={(event) => onSelected(event.target.checked)} />
        <span className="sr-only">{ui[language].selected}: {label}</span>
      </label>
      <label className="control" htmlFor={id}><span>{label}{sensitive && <span className="sensitive"> · secret</span>}</span>
        {enumValues.length > 0 ? (
          <select id={id} value={String(value)} disabled={!selected} onChange={(event) => onChange(Number(event.target.value))}>
            {enumValues.map((option: any) => <option key={option.number} value={option.number}>{option.name}</option>)}
          </select>
        ) : isBoolean ? (
          <select id={id} value={String(Boolean(value))} disabled={!selected} onChange={(event) => onChange(event.target.value === "true")}>
            <option value="false">False</option><option value="true">True</option>
          </select>
        ) : isList || isBytes ? (
          <textarea id={id} value={Array.isArray(value) ? value.join("\n") : String(value)} disabled={!selected} spellCheck={false} placeholder="Base64" onChange={(event) => onChange(isList ? event.target.value.split(/\s+/).filter(Boolean) as unknown as Uint8Array[] : event.target.value)} />
        ) : (
          <input id={id} type={sensitive ? "password" : isString ? "text" : "number"} step={name === "overrideFrequency" ? "0.001" : "1"} value={String(value)} disabled={!selected} onChange={(event) => onChange(isString ? event.target.value : Number(event.target.value))} />
        )}
      </label>
    </div>
  );
}

function SectionEditor({ id, draft, language, onChange }: { id: SectionId; draft: Draft; language: Language; onChange: (draft: Draft) => void }) {
  const definition = sectionMap[id];
  const section = draft.sections[id];
  const [open, setOpen] = useState(id === "device" || id === "lora");
  const setSection = (next: typeof section) => onChange({ ...draft, sections: { ...draft.sections, [id]: next } });
  const generateDeviceKeys = async () => {
    if (!confirm(language === "nb" ? "Dette erstatter nøkkelparet i utkastet. Enheten får en ny kryptografisk identitet når profilen installeres." : "This replaces the key pair in the draft. The device receives a new cryptographic identity when the profile is installed.")) return;
    try {
      const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
      const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
      if (!privateJwk.d || !privateJwk.x) throw new Error("The browser did not export a complete Ed25519 key pair");
      setSection({ ...section, included: true, selected: { ...section.selected, publicKey: true, privateKey: true }, values: { ...section.values, publicKey: bytesToBase64(base64ToBytes(privateJwk.x)), privateKey: bytesToBase64(base64ToBytes(privateJwk.d)) } });
    } catch (reason) { alert(reason instanceof Error ? reason.message : String(reason)); }
  };
  return (
    <section className={`section-card${open ? " open" : ""}`}>
      <div className="section-summary">
        <button type="button" className="summary-title" aria-expanded={open} onClick={() => setOpen(!open)}><ChevronDown aria-hidden="true" />{sectionLabels[language][id]}</button>
        <label className="section-toggle">
          <input type="checkbox" checked={section.included} onChange={(event) => setSection({ ...section, included: event.target.checked })} />
          {ui[language].section}
        </label>
      </div>
      {open && <>{definition.compatibility && <p className="compatibility"><AlertTriangle aria-hidden="true" />{definition.compatibility}</p>}
      <div className="section-fields">
        {definition.editable.map((name) => (
          <FieldEditor key={name} sectionId={id} name={name} value={section.values[name]} selected={section.selected[name]} language={language} sensitive={definition.sensitive?.includes(name) ?? false}
            onSelected={(selected) => setSection({ ...section, selected: { ...section.selected, [name]: selected } })}
            onChange={(value) => {
              const next = { ...section, values: { ...section.values, [name]: value } };
              let nextDraft = { ...draft, sections: { ...draft.sections, [id]: next } };
              if (id === "device" && name === "role") nextDraft = { ...nextDraft, naming: { ...nextDraft.naming, roleCode: roleCodeForValue(Number(value)) } };
              if (id === "network" && name === "wifiEnabled" && value === true) {
                nextDraft.sections.bluetooth = { ...nextDraft.sections.bluetooth, included: true, selected: { ...nextDraft.sections.bluetooth.selected, enabled: true }, values: { ...nextDraft.sections.bluetooth.values, enabled: false } };
              }
              if (id === "bluetooth" && name === "enabled" && value === true) {
                nextDraft.sections.network = { ...nextDraft.sections.network, values: { ...nextDraft.sections.network.values, wifiEnabled: false } };
              }
              onChange(nextDraft);
            }} />
        ))}
      </div>
      {id === "security" && <div className="section-extra"><button type="button" className="secondary" onClick={() => void generateDeviceKeys()}>{language === "nb" ? "Lag Ed25519-nøkkelpar" : "Generate Ed25519 key pair"}</button><p className="help">{language === "nb" ? "Lisensiert modus finnes ikke i DeviceProfile-format 2.7.26 og eksporteres derfor ikke." : "Licensed mode is not part of DeviceProfile 2.7.26 and is therefore not exported."}</p></div>}
      {section.imported && definition.schema.fields.some((field) => !definition.editable.includes(field.localName)) && (
        <p className="preserved-note">{ui[language].importedOnly}: {definition.schema.fields.filter((field) => !definition.editable.includes(field.localName)).map((field) => field.name).join(", ")}</p>
      )}</>}
    </section>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme) || "system");
  const [instance, setInstance] = useState<InstanceConfig>(FALLBACK_INSTANCE);
  const [instanceError, setInstanceError] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => loadSavedDraft() ?? createDraft(FALLBACK_INSTANCE.presets[0]));
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const [channelPreview, setChannelPreview] = useState<ReturnType<typeof parseChannelUrl> | null>(null);
  const [importError, setImportError] = useState("");
  const [includeUrlLora, setIncludeUrlLora] = useState<boolean | null>(null);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [rawPreview, setRawPreview] = useState(false);
  const [qrData, setQrData] = useState("");
  const [emojiSearch, setEmojiSearch] = useState("");
  const [platform, setPlatform] = useState("apple");
  const fileInput = useRef<HTMLInputElement>(null);
  const text = ui[language];
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({});

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}instance.json`, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    }).then((value) => {
      const valid = validateInstance(value);
      setInstance(valid);
      if (!loadSavedDraft()) setDraft(createDraft(valid.presets.find((preset) => preset.id === valid.defaultPreset) ?? valid.presets[0]));
    }).catch(() => setInstanceError(true)).finally(() => setLoaded(true));
  }, []);

  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); }, [draft, loaded]);
  useEffect(() => { localStorage.setItem(LANGUAGE_KEY, language); document.documentElement.lang = language; document.title = instance.identity.name[language]; }, [language, instance]);
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = theme === "system" ? media.matches ? "dark" : "light" : theme; };
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const up = () => setOnline(true); const down = () => setOnline(false);
    addEventListener("online", up); addEventListener("offline", down); return () => { removeEventListener("online", up); removeEventListener("offline", down); };
  }, []);

  const generatedName = useMemo(() => generateName({ role: draft.naming.roleCode, municipality: draft.naming.municipality, location: draft.naming.location, owner: draft.naming.owner, suffix: draft.naming.suffix }), [draft.naming]);
  useEffect(() => {
    const generated = generatedName.copyable ? generatedName.displayName : "";
    if (draft.longNameMode === "convention" && draft.longName !== generated) setDraft((current) => ({ ...current, longName: generated }));
  }, [draft.longNameMode, draft.longName, generatedName.copyable, generatedName.displayName]);

  const errors = useMemo(() => validateDraft(draft), [draft]);
  const warnings = useMemo(() => exportWarnings(draft), [draft]);
  const json = useMemo(() => profileJson(draft), [draft]);
  const shortSuggestions = useMemo(() => shortNameSuggestions(draft.naming.owner, draft.naming.location), [draft.naming.owner, draft.naming.location]);
  const unknown = useMemo(() => unknownSummary(draft), [draft]);

  const reset = () => {
    if (!confirm(text.replaceConfirm)) return;
    const preset = instance.presets.find((item) => item.id === instance.defaultPreset) ?? instance.presets[0];
    setDraft(createDraft(preset));
  };
  const clear = () => {
    if (!confirm(text.clearConfirm)) return;
    localStorage.removeItem(STORAGE_KEY); reset();
  };

  const importBytes = async (file: File) => {
    setImportError("");
    if (file.size > MAX_PROFILE_BYTES) { setImportError("Profile exceeds the 512 KiB safety limit"); return; }
    try {
      const next = importProfile(new Uint8Array(await file.arrayBuffer()), file.name);
      if (confirm(text.replaceConfirm)) { setDraft(next); setImportOpen(false); }
    } catch (reason) { setImportError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const previewChannel = () => {
    try { const parsed = parseChannelUrl(channelInput); setChannelPreview(parsed); setIncludeUrlLora(parsed.lora ? null : false); setImportError(""); }
    catch (reason) { setImportError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const mergeChannel = () => {
    if (!channelPreview || (channelPreview.lora && includeUrlLora === null)) return;
    let next = { ...draft, channelsIncluded: true, channels: channelPreview.channels };
    if (channelPreview.lora && includeUrlLora) next = { ...next, sections: { ...next.sections, lora: { ...next.sections.lora, included: true, selected: Object.fromEntries(sectionMap.lora.editable.map((name) => [name, true])), values: { ...next.sections.lora.values, ...channelPreview.lora } } } };
    setDraft(next); setChannelPreview(null); setChannelInput(""); setImportOpen(false);
  };

  const updatePosition = (latitude: number, longitude: number) => setDraft((current) => ({ ...current, location: { ...current.location, latitude: latitude.toFixed(7), longitude: longitude.toFixed(7) }, sections: { ...current.sections, position: { ...current.sections.position, included: true } } }));
  const lookupPlace = async () => {
    if (!online) return;
    const lat = Number(draft.location.latitude); const lon = Number(draft.location.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setImportError("");
    const failures: string[] = [];
    const location = { ...draft.location };
    try {
      const response = await fetch(`https://ws.geonorge.no/kommuneinfo/v1/punkt?nord=${encodeURIComponent(lat)}&ost=${encodeURIComponent(lon)}&koordsys=4258`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      const number = String(data.kommunenummer ?? data.kommune?.kommunenummer ?? "");
      const match = municipalities.find((item) => item.number === number);
      location.municipalityNumber = number; location.municipalityName = match?.name ?? data.kommunenavn ?? ""; location.municipalityCode = match?.code ?? "";
    } catch { failures.push("municipality"); }
    try {
      const response = await fetch(`https://ws.geonorge.no/stedsnavn/v1/punkt?ost=${encodeURIComponent(lon)}&nord=${encodeURIComponent(lat)}&koordsys=4258&radius=1000`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      location.placeName = data.navn?.[0]?.skrivemåte ?? data.navn?.[0]?.skrivemate ?? "";
    } catch { failures.push("place name"); }
    try {
      const response = await fetch(`https://ws.geonorge.no/hoydedata/v1/punkt?x=${encodeURIComponent(lon)}&y=${encodeURIComponent(lat)}&koordsys=4258`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      location.altitude = String(Math.round(data.hoyde ?? data.punkter?.[0]?.z ?? 0));
    } catch { failures.push("elevation"); }
    setDraft((current) => ({ ...current, location, naming: { ...current.naming, municipality: location.municipalityCode || current.naming.municipality } }));
    if (failures.length) setImportError(`Lookup failed for: ${failures.join(", ")}. You can enter these values manually.`);
  };

  const openQr = async () => {
    const custom = draft.channels.some((channel) => !["", "AQ=="].includes(channel.psk));
    if (custom && !confirm(language === "nb" ? "QR-koden inneholder egendefinerte kanalnøkler. Vis den bare til mottakere du stoler på." : "The QR code contains custom channel keys. Show it only to trusted recipients.")) return;
    setQrData(await QRCode.toDataURL(channelUrlFromDraft(draft, draft.sections.lora.included), { width: 420, margin: 2 }));
  };

  const downloadProfile = () => {
    const bytes = encodeProfile(draft);
    const blobBytes = new Uint8Array(bytes.byteLength);
    blobBytes.set(bytes);
    const blob = new Blob([blobBytes.buffer], { type: "application/x-protobuf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url;
    const stem = (draft.longName || "meshtastic-profile").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "meshtastic-profile";
    anchor.download = `${stem}.cfg`; anchor.click(); URL.revokeObjectURL(url);
    setAcknowledged({}); setExportOpen(false); setSuccessOpen(true);
  };

  const setPreset = (presetId: string) => {
    if (!confirm(text.replaceConfirm)) return;
    const preset = instance.presets.find((item) => item.id === presetId);
    if (!preset) return;
    const fresh = createDraft(preset);
    setDraft({ ...draft, presetId, sections: { ...draft.sections, device: fresh.sections.device, lora: fresh.sections.lora }, naming: { ...draft.naming, roleCode: fresh.naming.roleCode } });
  };

  const dialogClose = useCallback(() => { setScanOpen(false); setImportOpen(false); }, []);

  return (
    <>
      <a className="skip-link" href="#editor">{text.skip}</a>
      <header className="app-header">
        <div><p className="eyebrow">Meshtastic · cfg {draft.profileFormat}</p><h1>{instance.identity.name[language]}</h1><p>{instance.identity.intro[language]}</p></div>
        <div className="header-controls">
          <select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="nb">Norsk</option><option value="en">English</option></select>
          <div className="segmented" aria-label="Theme">{([["system", Monitor], ["light", Sun], ["dark", Moon]] as const).map(([value, Icon]) => <button key={value} type="button" aria-label={value} aria-pressed={theme === value} onClick={() => setTheme(value)}><Icon /></button>)}</div>
          <a className="icon-button" href="https://github.com/wilhel1812/meshtastic-node-configurator" aria-label="GitHub"><Github /></a>
        </div>
      </header>
      {(instanceError || !online || needRefresh) && <div className="notices" aria-live="polite">{instanceError && <p><AlertTriangle />{text.invalidInstance}</p>}{!online && <p><Globe2 />{text.offline}</p>}{needRefresh && <p><Download />{text.updateReady}<button onClick={() => updateServiceWorker(true)}>{text.reload}</button></p>}</div>}
      <div className="privacy-strip"><span>{text.localNotice}</span><span>{text.secretNotice}</span></div>
      <div className="toolbar">
        <button type="button" className="secondary" onClick={() => setImportOpen(true)}><FileUp />{text.import}</button>
        <button type="button" className="secondary" onClick={reset}><RotateCcw />{text.newProfile}</button>
        <button type="button" className="danger-link" onClick={clear}><Trash2 />{text.clear}</button>
        <button type="button" className="primary" onClick={() => setExportOpen(true)}><Download />{text.export}</button>
      </div>
      <main id="editor" className="workspace">
        <div className="editor-column">
          {instance.presets.length > 1 && <label className="preset"><span>{text.profile}</span><select value={draft.presetId} onChange={(event) => setPreset(event.target.value)}>{instance.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label[language]}</option>)}</select></label>}
          <section className="identity-card card">
            <div className="card-heading"><div><p className="eyebrow">01</p><h2>{text.identity}</h2></div></div>
            <div className="mode-switch"><button type="button" className={draft.longNameMode === "convention" ? "active" : ""} onClick={() => setDraft({ ...draft, longNameMode: "convention" })}>{text.namingConvention}</button><button type="button" className={draft.longNameMode === "custom" ? "active" : ""} onClick={() => setDraft({ ...draft, longNameMode: "custom" })}>{text.customName}</button></div>
            {draft.longNameMode === "convention" && <div className="naming-grid">
              <label><span>{text.role}</span><select value={draft.naming.roleCode} onChange={(event) => {
                const role = roles.find((item) => item.code === event.target.value); const enumValue = Config.Config_DeviceConfig_RoleSchema.values.find((item: any) => item.name === role?.name)?.number ?? 0;
                setDraft({ ...draft, naming: { ...draft.naming, roleCode: event.target.value }, sections: { ...draft.sections, device: { ...draft.sections.device, included: true, selected: { ...draft.sections.device.selected, role: true }, values: { ...draft.sections.device.values, role: enumValue } } } });
              }}><option value="">{text.choose}</option>{roles.map((role) => <option value={role.code} key={role.code}>{role.name}</option>)}</select></label>
              {instance.helpers.norway && <label><span>{text.municipality}</span><select value={draft.naming.municipality} onChange={(event) => setDraft({ ...draft, naming: { ...draft.naming, municipality: event.target.value } })}><option value="">{text.choose}</option>{municipalities.map((item) => <option key={item.number} value={item.code}>{item.name} · {item.code}</option>)}</select></label>}
              <label><span>{text.location}</span><input value={draft.naming.location} onChange={(event) => setDraft({ ...draft, naming: { ...draft.naming, location: event.target.value } })} /></label>
              <label><span>{text.owner}</span><input value={draft.naming.owner} onChange={(event) => setDraft({ ...draft, naming: { ...draft.naming, owner: event.target.value } })} /></label>
              <label><span>{text.suffix}</span><input value={draft.naming.suffix} onChange={(event) => setDraft({ ...draft, naming: { ...draft.naming, suffix: event.target.value } })} /></label>
            </div>}
            <div className="identity-fields">
              <div className="field-row selected"><label className="field-select"><input type="checkbox" checked={draft.identitySelected.longName} onChange={(event) => setDraft({ ...draft, identitySelected: { ...draft.identitySelected, longName: event.target.checked } })} /><span className="sr-only">{text.selected}</span></label><label className="control"><span>{text.longName} · {byteLength(draft.longName)}/24 {text.bytes}</span><input value={draft.longName} disabled={!draft.identitySelected.longName || draft.longNameMode === "convention"} onChange={(event) => setDraft({ ...draft, longName: event.target.value })} /></label></div>
              <div className="field-row selected"><label className="field-select"><input type="checkbox" checked={draft.identitySelected.shortName} onChange={(event) => setDraft({ ...draft, identitySelected: { ...draft.identitySelected, shortName: event.target.checked } })} /><span className="sr-only">{text.selected}</span></label><div className="control"><label><span>{text.shortName} · {byteLength(draft.shortName)}/4 {text.bytes}</span><input value={draft.shortName} disabled={!draft.identitySelected.shortName} onChange={(event) => byteLength(event.target.value) <= 4 && setDraft({ ...draft, shortName: event.target.value.normalize("NFC") })} /></label><div className="suggestions">{shortSuggestions.map((item) => <button type="button" key={item} onClick={() => setDraft({ ...draft, shortName: item })}>{item}</button>)}<details className="emoji-picker"><summary>☺</summary><div className="emoji-popover"><input aria-label="Search emoji" placeholder="Search" value={emojiSearch} onChange={(event) => setEmojiSearch(event.target.value)} /> <div>{emoji.filter(([, label]) => label.includes(emojiSearch.toLowerCase())).map(([symbol, label]) => <button type="button" title={label} key={symbol} onClick={() => setDraft({ ...draft, shortName: symbol })}>{symbol}</button>)}</div></div></details></div></div></div>
            </div>
            {draft.longNameMode === "convention" && generatedName.missingRequired && <p className="help">{language === "nb" ? "Rolle, kommune og sted kreves av navnekonvensjonen." : "Role, municipality and location are required by the naming convention."}</p>}
          </section>

          <section className="card channel-card">
            <div className="card-heading"><div><p className="eyebrow">02</p><h2>{text.channels}</h2></div><label className="section-toggle"><input type="checkbox" checked={draft.channelsIncluded} onChange={(event) => setDraft({ ...draft, channelsIncluded: event.target.checked })} />{text.section}</label></div>
            <div className="channels">{draft.channels.map((channel, index) => <div className="channel" key={channel.id}>
              <div className="channel-top"><strong>{channel.primary ? text.primary : `${text.secondary} ${index}`}</strong><div><button type="button" aria-label={text.moveUp} disabled={index === 0} onClick={() => { const channels = [...draft.channels]; [channels[index - 1], channels[index]] = [channels[index], channels[index - 1]]; channels.forEach((item, itemIndex) => item.primary = itemIndex === 0); setDraft({ ...draft, channels }); }}>↑</button><button type="button" aria-label={text.moveDown} disabled={index === draft.channels.length - 1} onClick={() => { const channels = [...draft.channels]; [channels[index + 1], channels[index]] = [channels[index], channels[index + 1]]; channels.forEach((item, itemIndex) => item.primary = itemIndex === 0); setDraft({ ...draft, channels }); }}>↓</button><button type="button" aria-label={text.remove} disabled={draft.channels.length === 1} onClick={() => { const channels = draft.channels.filter((item) => item.id !== channel.id); channels[0].primary = true; setDraft({ ...draft, channels }); }}><Trash2 /></button></div></div>
              <div className="channel-grid"><label><span>{text.channelName}</span><input placeholder={channel.primary ? "LongFast" : ""} value={channel.name} onChange={(event) => { const channels = draft.channels.map((item) => item.id === channel.id ? { ...item, name: event.target.value } : item); setDraft({ ...draft, channels }); }} /></label><label><span>{text.key} · Base64</span><input type="password" value={channel.psk} onChange={(event) => { const channels = draft.channels.map((item) => item.id === channel.id ? { ...item, psk: event.target.value } : item); setDraft({ ...draft, channels }); }} /></label></div>
              <div className="channel-options"><label><input type="checkbox" checked={channel.uplinkEnabled} onChange={(event) => setDraft({ ...draft, channels: draft.channels.map((item) => item.id === channel.id ? { ...item, uplinkEnabled: event.target.checked } : item) })} /> MQTT uplink</label><label><input type="checkbox" checked={channel.downlinkEnabled} onChange={(event) => setDraft({ ...draft, channels: draft.channels.map((item) => item.id === channel.id ? { ...item, downlinkEnabled: event.target.checked } : item) })} /> MQTT downlink</label><label><span>Position precision</span><input type="number" min="0" max="32" value={channel.positionPrecision} onChange={(event) => setDraft({ ...draft, channels: draft.channels.map((item) => item.id === channel.id ? { ...item, positionPrecision: Number(event.target.value) } : item) })} /></label></div>
              <div className="channel-actions"><button type="button" onClick={() => setDraft({ ...draft, channels: draft.channels.map((item) => item.id === channel.id ? { ...item, psk: "AQ==" } : item) })}>{text.defaultKey}</button><button type="button" onClick={() => setDraft({ ...draft, channels: draft.channels.map((item) => item.id === channel.id ? { ...item, psk: "" } : item) })}>{text.noEncryption}</button><button type="button" onClick={() => { const bytes = crypto.getRandomValues(new Uint8Array(16)); setDraft({ ...draft, channels: draft.channels.map((item) => item.id === channel.id ? { ...item, psk: bytesToBase64(bytes) } : item) }); }}>{text.generate128}</button><button type="button" onClick={() => { const bytes = crypto.getRandomValues(new Uint8Array(32)); setDraft({ ...draft, channels: draft.channels.map((item) => item.id === channel.id ? { ...item, psk: bytesToBase64(bytes) } : item) }); }}>{text.generate256}</button></div>
            </div>)}</div>
            <div className="card-actions"><button type="button" className="secondary" disabled={draft.channels.length >= 8} onClick={() => setDraft({ ...draft, channels: [...draft.channels, { id: crypto.randomUUID(), name: "", psk: bytesToBase64(crypto.getRandomValues(new Uint8Array(32))), uplinkEnabled: false, downlinkEnabled: false, positionPrecision: 0, primary: false }] })}><Plus />{text.addChannel}</button><button type="button" className="secondary" onClick={openQr}><QrCode />QR</button></div>
            {qrData && <div className="qr-panel"><img src={qrData} alt="Meshtastic channel QR code" /><textarea readOnly value={channelUrlFromDraft(draft, draft.sections.lora.included)} /><div><button type="button" onClick={() => navigator.clipboard.writeText(channelUrlFromDraft(draft, draft.sections.lora.included))}><Copy />{text.copy}</button><a download="meshtastic-channel.png" href={qrData}><Download />{text.downloadQr}</a></div></div>}
          </section>

          <section className="card location-card">
            <div className="card-heading"><div><p className="eyebrow">03</p><h2>{text.positionMap}</h2></div></div>
            <MapPicker latitude={draft.location.latitude} longitude={draft.location.longitude} onPick={updatePosition} />
            <div className="location-grid"><label><span>{text.latitude}</span><input type="number" step="0.0000001" value={draft.location.latitude} onChange={(event) => setDraft({ ...draft, location: { ...draft.location, latitude: event.target.value }, sections: { ...draft.sections, position: { ...draft.sections.position, included: true } } })} /></label><label><span>{text.longitude}</span><input type="number" step="0.0000001" value={draft.location.longitude} onChange={(event) => setDraft({ ...draft, location: { ...draft.location, longitude: event.target.value }, sections: { ...draft.sections, position: { ...draft.sections.position, included: true } } })} /></label><label><span>{text.altitude}</span><input type="number" value={draft.location.altitude} onChange={(event) => setDraft({ ...draft, location: { ...draft.location, altitude: event.target.value } })} /></label><label><span>Mode</span><select value={draft.location.mode} onChange={(event) => setDraft({ ...draft, location: { ...draft.location, mode: event.target.value as "fixed" | "initial" } })}><option value="fixed">{text.fixed}</option><option value="initial">{text.initial}</option></select></label>{instance.helpers.norway && <label className="place-suggestion"><span>{language === "nb" ? "Stedsnavnforslag" : "Place-name suggestion"}</span><input value={draft.location.placeName} onChange={(event) => setDraft({ ...draft, location: { ...draft.location, placeName: event.target.value } })} /></label>}</div>
            <div className="card-actions"><button type="button" className="secondary" onClick={() => navigator.geolocation.getCurrentPosition((position) => updatePosition(position.coords.latitude, position.coords.longitude), (error) => setImportError(error.message))}><MapPin />{text.useLocation}</button>{instance.helpers.norway && <button type="button" className="secondary" disabled={!online} onClick={lookupPlace}><Globe2 />{text.lookUp}</button>}</div>
            {(draft.location.municipalityName || draft.location.placeName) && <div className="place-result"><span>{[draft.location.municipalityName, draft.location.municipalityCode].filter(Boolean).join(" · ")}</span>{draft.location.placeName && <button type="button" onClick={() => setDraft({ ...draft, naming: { ...draft.naming, location: draft.location.placeName } })}>{language === "nb" ? "Bruk stedsnavnet" : "Use place name"}</button>}</div>}
          </section>

          <div className="configuration-sections">{sections.map(({ id }) => <SectionEditor key={id} id={id} draft={draft} language={language} onChange={setDraft} />)}</div>
        </div>

        <aside className="preview card" aria-label={text.preview}>
          <div className="preview-header"><h2>{text.preview}</h2><div className="mode-switch"><button className={!rawPreview ? "active" : ""} onClick={() => setRawPreview(false)}>{text.readable}</button><button className={rawPreview ? "active" : ""} onClick={() => setRawPreview(true)}>{text.raw}</button></div></div>
          {rawPreview ? <pre>{JSON.stringify(json, null, 2)}</pre> : <div className="outline"><p><strong>{draft.longName || "—"}</strong><br />{draft.shortName || "—"}</p><dl><div><dt>{text.channels}</dt><dd>{draft.channelsIncluded ? draft.channels.length : text.omitted}</dd></div>{sections.map(({ id }) => <div key={id}><dt>{sectionLabels[language][id]}</dt><dd>{draft.sections[id].included ? text.included : text.omitted}</dd></div>)}</dl>{draft.importedBinary && <div className="import-summary"><strong>{draft.importedFileName}</strong><p>{unknown.topLevel} unknown top-level fields · {unknown.preservedBytes} preserved {text.bytes}</p><label><input type="checkbox" checked={draft.preserveImported.topLevel} onChange={(event) => setDraft({ ...draft, preserveImported: { ...draft.preserveImported, topLevel: event.target.checked } })} /> Preserve top-level extras</label><label><input type="checkbox" checked={draft.preserveImported.config} onChange={(event) => setDraft({ ...draft, preserveImported: { ...draft.preserveImported, config: event.target.checked } })} /> Preserve config extras</label><label><input type="checkbox" checked={draft.preserveImported.moduleConfig} onChange={(event) => setDraft({ ...draft, preserveImported: { ...draft.preserveImported, moduleConfig: event.target.checked } })} /> Preserve module extras</label></div>}</div>}
          {errors.length > 0 && <div className="validation" role="status"><strong>{errors.length} validation issue(s)</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
        </aside>
      </main>

      {importOpen && <dialog open className="dialog" onCancel={dialogClose}><div className="dialog-header"><h2>{text.importTitle}</h2><button onClick={dialogClose} aria-label={text.close}>×</button></div><div className="dialog-content">
        <button className="drop-zone" type="button" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void importBytes(file); }}><Upload />{text.drop}</button><input ref={fileInput} hidden type="file" accept=".cfg,application/octet-stream,application/x-protobuf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBytes(file); }} />
        <div className="divider"><span>or</span></div><label><span>{text.pasteUrl}</span><textarea value={channelInput} onChange={(event) => setChannelInput(event.target.value)} /></label><div className="card-actions"><button type="button" className="secondary" onClick={previewChannel}>{text.merge}</button><button type="button" className="secondary" onClick={() => setScanOpen(true)}><QrCode />{text.scanQr}</button></div>
        {scanOpen && <QrScanner onClose={() => setScanOpen(false)} onResult={(value) => { setChannelInput(value); setScanOpen(false); try { const parsed = parseChannelUrl(value); setChannelPreview(parsed); setIncludeUrlLora(parsed.lora ? null : false); } catch (reason) { setImportError(String(reason)); } }} />}
        {channelPreview && <div className="channel-preview"><p>{channelPreview.channels.length} channel(s)</p>{channelPreview.lora && <fieldset><legend>LoRa settings found</legend><label><input type="radio" checked={includeUrlLora === true} onChange={() => setIncludeUrlLora(true)} />Include LoRa settings</label><label><input type="radio" checked={includeUrlLora === false} onChange={() => setIncludeUrlLora(false)} />Channels only</label></fieldset>}<button type="button" className="primary" disabled={channelPreview.lora !== undefined && includeUrlLora === null} onClick={mergeChannel}>{text.confirm}</button></div>}
        {importError && <p className="error" role="alert">{importError}</p>}
      </div></dialog>}

      {exportOpen && <dialog open className="dialog"><div className="dialog-header"><h2>{text.exportReview}</h2><button onClick={() => { setExportOpen(false); setAcknowledged({}); }} aria-label={text.close}>×</button></div><div className="dialog-content"><p>{encodeProfile(draft).byteLength} {text.bytes} · DeviceProfile {draft.profileFormat}</p><ul className="review-list">{draft.identitySelected.longName && <li>{text.longName}</li>}{draft.identitySelected.shortName && <li>{text.shortName}</li>}{draft.channelsIncluded && <li>{draft.channels.length} {text.channels.toLowerCase()}</li>}{sections.filter(({ id }) => draft.sections[id].included).map(({ id }) => <li key={id}>{sectionLabels[language][id]}</li>)}</ul>{warnings.length > 0 && <div className="warnings"><h3>{text.acknowledgements}</h3>{warnings.map((warning) => warning.level === "strict" ? <label key={warning.id}><input type="checkbox" checked={Boolean(acknowledged[warning.id])} onChange={(event) => setAcknowledged({ ...acknowledged, [warning.id]: event.target.checked })} /><span><AlertTriangle />{warning.text}</span></label> : <p key={warning.id}><AlertTriangle />{warning.text}</p>)}</div>}{errors.length > 0 && <div className="validation"><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}<button type="button" className="primary wide" disabled={errors.length > 0 || warnings.some((warning) => warning.level === "strict" && !acknowledged[warning.id])} onClick={downloadProfile}><Download />{text.download}</button></div></dialog>}

      {successOpen && <dialog open className="dialog"><div className="dialog-header"><h2><Check />{text.success}</h2><button onClick={() => setSuccessOpen(false)} aria-label={text.close}>×</button></div><div className="dialog-content"><div className="platform-tabs">{["apple", "android", "web", "cli"].map((item) => <button type="button" className={platform === item ? "active" : ""} key={item} onClick={() => setPlatform(item)}>{item}</button>)}</div><div className="instructions">{platform === "apple" && <p>Open the downloaded file with the Meshtastic app, review the profile, connect to the target node, and confirm installation.</p>}{platform === "android" && <p>Open the downloaded file from Files with Meshtastic, review it, choose the connected node, and confirm installation.</p>}{platform === "web" && <p>Connect to the node in the official Meshtastic web client and use its profile import action to select the downloaded file.</p>}{platform === "cli" && <p><code>meshtastic --configure downloaded-profile.cfg</code></p>}<p><a href="https://meshtastic.org/docs/configuration/" target="_blank" rel="noreferrer">Official Meshtastic documentation</a></p></div><button type="button" className="primary wide" onClick={() => setSuccessOpen(false)}>{text.close}</button></div></dialog>}
    </>
  );
}
