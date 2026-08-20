import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  latitude: string;
  longitude: string;
  onPick: (latitude: number, longitude: number) => void;
};

export function MapPicker({ latitude, longitude, onPick }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const callback = useRef(onPick);

  useEffect(() => { callback.current = onPick; }, [onPick]);

  useEffect(() => {
    if (!element.current || map.current) return;
    const initial: L.LatLngExpression = [59.91, 10.75];
    const instance = L.map(element.current, { scrollWheelZoom: false }).setView(initial, 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(instance);
    instance.on("click", (event: L.LeafletMouseEvent) => callback.current(event.latlng.lat, event.latlng.lng));
    map.current = instance;
    return () => { instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!map.current || !Number.isFinite(lat) || !Number.isFinite(lon) || latitude === "" || longitude === "") return;
    const point: L.LatLngExpression = [lat, lon];
    if (!marker.current) marker.current = L.circleMarker(point, { radius: 8, color: "#087f68", fillOpacity: 1 }).addTo(map.current);
    else marker.current.setLatLng(point);
    map.current.panTo(point);
  }, [latitude, longitude]);

  return <div className="map" ref={element} aria-label="Map position picker" />;
}
