// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useDrivingRoute } from "./services/useDrivingRoute";
import { getDrivingRoute } from "./services/routeService";

vi.mock("./services/routeService", () => ({ getDrivingRoute: vi.fn() }));

it("ignores a late route response after the destination changes", async () => {
  const originCity = { id: 1, latitude: 36.85, longitude: -76.29 };
  const boston = { id: 2, latitude: 42.36, longitude: -71.06 };
  const richmond = { id: 3, latitude: 37.54, longitude: -77.43 };
  const form = { originCity, destinationCity: boston, transportation: "car" };
  let resolveBoston;
  let resolveRichmond;
  getDrivingRoute
    .mockReturnValueOnce(new Promise((resolve) => { resolveBoston = resolve; }))
    .mockReturnValueOnce(new Promise((resolve) => { resolveRichmond = resolve; }));
  function Route({ trip }) {
    const result = useDrivingRoute(trip, "test-user");
    return result.loading ? "loading" : String(result.route?.distanceMiles ?? "");
  }
  const rootElement = document.createElement("div");
  const root = createRoot(rootElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  try {
    await act(async () => root.render(createElement(Route, { trip: form })));
    await act(async () => root.render(createElement(Route, { trip: { ...form, destinationCity: richmond } })));
    expect(rootElement.textContent).toBe("loading");
    await act(async () => resolveRichmond({ distanceMiles: 95 }));
    await act(async () => resolveBoston({ distanceMiles: 629 }));
    expect(rootElement.textContent).toBe("95");
    await act(async () => root.render(createElement(Route, { trip: { ...form, transportation: "train" } })));
    expect(rootElement.textContent).toBe("");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
