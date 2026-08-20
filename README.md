# Meshtastic Node Configurator

A client-side editor for creating, importing, inspecting, and exporting native Meshtastic `DeviceProfile` `.cfg` files and channel URLs/QR codes.

The application logic is deployment-agnostic. The bundled public instance provides the recommended Norwegian radio profile and optional municipality/name assistance. A rehost can replace `public/instance.json` to provide different public defaults and guidance without changing the editor.

## Capabilities

- Native binary `.cfg` import/export using official Meshtastic protobufs 2.7.26
- Lossless preservation of unknown protobuf fields
- Native channel URL and QR import/export
- Exact long-name behavior from the pinned [`nodenavngenerator`](https://github.com/wilhel1812/nodenavngenerator)
- Field and section inclusion controls with resolved-value preview
- Hardware-neutral radio, position, power, Wi-Fi, Bluetooth, security, and selected module settings
- Optional OpenStreetMap and Kartverket location assistance
- Bokmål and English, light/dark/system themes, responsive and offline-capable PWA
- No backend, accounts, analytics, or telemetry

The browser stores one complete draft in local storage until it is cleared. That draft can contain Wi-Fi/MQTT credentials, private keys, channel keys, names, and exact coordinates.

## Development

Requirements: Node.js 22+, npm, and Git with recursive submodule support.

```sh
git clone --recurse-submodules https://github.com/wilhel1812/meshtastic-node-configurator.git
cd meshtastic-node-configurator
npm ci
npm run dev
```

Validation:

```sh
npm run check
npm run lint
npm run build
npm run test:e2e
```

## Instance configuration

Copy and edit `public/instance.json`. Its public schema is `public/instance.schema.json`. It may define:

- bilingual site identity and guidance;
- ordered presets and a default preset;
- recommended role, timezone, and LoRa values;
- whether Norwegian municipality/name helpers are enabled.

Instance configuration must never contain secrets. It cannot hide or lock editor fields. Invalid configuration causes a visible warning and neutral fallback editor.

## Format and compatibility policy

The initial adapter baseline is the published `@meshtastic/protobufs@2.7.26`. No older format is supported. Future adapters remain selectable once more than one exists. Client limitations are shown where relevant rather than silently suppressing schema-supported settings.

`isLicensed` is not a field in the published 2.7.26 `DeviceProfile` message and is therefore not invented or exported by this adapter.

## Privacy and security

Profile parsing and generation happen in the browser. Map tiles and requested Kartverket lookups receive coordinates. Never attach an unredacted `.cfg` file to a public issue: profiles can contain credentials, cryptographic keys, identity, and exact location.

See [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

GPL-3.0-only. See [LICENSE](LICENSE). Third-party notices are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
