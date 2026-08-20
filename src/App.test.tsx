import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import instance from "../public/instance.json";

vi.mock("virtual:pwa-register/react", () => ({ useRegisterSW: () => ({ needRefresh: [false], updateServiceWorker: vi.fn() }) }));
vi.mock("leaflet", () => ({ default: { map: () => ({ setView() { return this; }, on: vi.fn(), remove: vi.fn(), panTo: vi.fn() }), tileLayer: () => ({ addTo: vi.fn() }), circleMarker: () => ({ addTo: () => ({ setLatLng: vi.fn() }) }) } }));

describe("app shell", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("meshtastic-node-configurator:language", "nb");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => instance }));
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });

  it("renders the generic editor and approved sections", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Meshtastic nodekonfigurator" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nodeidentitet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kanaler" })).toBeInTheDocument();
    expect(screen.getAllByText("LoRa-radio").length).toBeGreaterThan(0);
  });
});
