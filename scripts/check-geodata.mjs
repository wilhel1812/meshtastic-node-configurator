const coordinates = { latitude: 59.91, longitude: 10.75 };
const endpoints = [
  `https://ws.geonorge.no/kommuneinfo/v1/punkt?nord=${coordinates.latitude}&ost=${coordinates.longitude}&koordsys=4258`,
  `https://ws.geonorge.no/stedsnavn/v1/punkt?ost=${coordinates.longitude}&nord=${coordinates.latitude}&koordsys=4258&radius=1000&treffPerSide=1`,
  `https://ws.geonorge.no/hoydedata/v1/punkt?lon=${coordinates.longitude}&lat=${coordinates.latitude}&koordsys=4258`,
];

let failed = false;
for (const endpoint of endpoints) {
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok || !String(response.headers.get("content-type")).includes("json")) throw new Error(`${response.status} ${response.statusText}`);
    const body = await response.json();
    if (!body || typeof body !== "object") throw new Error("non-object response");
  } catch (error) {
    failed = true;
    console.error(`${endpoint}: ${error instanceof Error ? error.message : error}`);
  }
}
if (failed) process.exitCode = 1;
