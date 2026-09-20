import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import React from "react";
import { JSDOM } from "jsdom";
import { buildJourneyStages, JourneyShell, stageFor, type JourneyFeatures } from "./JourneyShell";
import { FEATURES } from "@shared/featureFlags";
import { availableClientRoutes, hasAvailableClientRoute, routePathMatches, type ClientFeatures } from "../../routes";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/dashboard",
});
Object.assign(globalThis, {
  React,
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  location: dom.window.location,
  history: dom.window.history,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver,
  addEventListener: dom.window.addEventListener.bind(dom.window),
  removeEventListener: dom.window.removeEventListener.bind(dom.window),
});

const { cleanup, render, screen } = await import("@testing-library/react");

const enabled: JourneyFeatures = {
  contextCraftPage: true,
  trainingProviders: true,
  arkResume: true,
  executiveReport: true,
  bookCompanion: true,
};

afterEach(() => cleanup());

test("maps every primary route and representative nested routes to its ATOMIC stage", () => {
  const stages = buildJourneyStages(enabled);
  const cases = [
    ["/", "L0"], ["/upload", "L1"], ["/upload/history", "L1"],
    ["/assessment", "L2"], ["/dashboard", "L3"], ["/dashboard/detail", "L3"],
    ["/pathways", "L4"], ["/training/p/provider", "L4"],
    ["/context-craft/level/2", "L5"], ["/book/chapter/1", "L5"], ["/play/session", "L5"],
    ["/ark-resume/edit", "L6"], ["/confirm/token", "L6"],
    ["/report", "L7"], ["/r/shared-token", "L7"],
    ["/profile", "L8"], ["/ark/history/item", "L8"], ["/u/person", "L8"],
    ["/marketplace/listing", "L9"], ["/merlin", "L9.5"],
  ] as const;

  for (const [route, expected] of cases) {
    assert.equal(stages[stageFor(route, stages)]?.id, expected, route);
  }
  assert.equal(stageFor("/subscription", stages), -1);
});

test("all progress, next, feature, and download destinations fall back when features are off", () => {
  const disabled: JourneyFeatures = {
    contextCraftPage: false,
    trainingProviders: false,
    arkResume: false,
    executiveReport: false,
    bookCompanion: false,
  };
  const stages = buildJourneyStages(disabled);
  const alwaysRoutable = new Set([
    "/", "/upload", "/assessment", "/dashboard", "/pathways", "/play",
    "/profile", "/marketplace", "/merlin", "/ark/history", "/marketplace/bonsai",
  ]);

  assert.deepEqual(stages.slice(4, 8).map((stage) => stage.href), ["/pathways", "/play", "/profile", "/profile"]);
  assert.equal(stages[4].next, "/play");
  assert.deepEqual(stages[4].feature, { label: "Practice skills", href: "/play" });
  assert.equal(stages[5].next, "/profile");
  assert.deepEqual(stages[5].feature, { label: "Start skill game", href: "/play" });
  assert.equal(stages[6].next, "/profile");
  assert.equal(stageFor("/training", stages), -1);
  assert.equal(stageFor("/context-craft", stages), -1);
  assert.equal(stageFor("/ark-resume", stages), -1);
  assert.equal(stageFor("/report", stages), -1);

  for (const stage of stages) {
    for (const href of [stage.href, stage.next, stage.feature.href].filter(Boolean) as string[]) {
      assert.ok(alwaysRoutable.has(href), `${stage.id} links to unavailable ${href}`);
    }
  }

  history.pushState({}, "", "/dashboard");
  render(React.createElement(JourneyShell, { features: disabled }, React.createElement("p", null, "page")));
  assert.equal(screen.getByRole("link", { name: "Download document" }).getAttribute("href"), "/profile");
  assert.equal(screen.getByTitle("L6 · Proof").getAttribute("href"), "/profile");
  assert.equal(screen.getByTitle("L7 · Report").getAttribute("href"), "/profile");
});

test("every journey destination is registered for every relevant feature combination", () => {
  const keys = ["contextCraftPage", "trainingProviders", "arkResume", "executiveReport", "bookCompanion"] as const;
  for (let mask = 0; mask < 2 ** keys.length; mask++) {
    const features: ClientFeatures = {
      ...FEATURES,
      ...Object.fromEntries(keys.map((key, index) => [key, Boolean(mask & (1 << index))])),
    };
    const stages = buildJourneyStages(features);
    for (const stage of stages) {
      for (const href of [stage.href, stage.next, stage.feature.href].filter(Boolean) as string[]) {
        assert.ok(hasAvailableClientRoute(href, features), `${stage.id} links to unregistered ${href} with mask ${mask}`);
      }
    }
  }
});

test("journey route prefixes correspond to registered routes, including public nested pages", () => {
  const registered = availableClientRoutes(FEATURES);
  for (const stage of buildJourneyStages(FEATURES)) {
    for (const prefix of stage.routes) {
      assert.ok(
        registered.some((route) => route.path === prefix || route.path.startsWith(`${prefix}/`)),
        `${stage.id} recognizes unregistered route prefix ${prefix}`,
      );
    }
  }
  assert.ok(routePathMatches("/r/shared-token", registered.find((route) => route.id === "sharedReport")!.path));
  assert.ok(routePathMatches("/confirm/invite-token", registered.find((route) => route.id === "confirmInvite")!.path));
});

test("renders accessible progress, previous, next, upload, download, and standalone controls", () => {
  history.pushState({}, "", "/dashboard");
  render(React.createElement(JourneyShell, null, React.createElement("p", null, "page")));

  const progress = screen.getByRole("navigation", { name: /L3 Intelligence/ });
  assert.equal(progress.querySelectorAll("a").length, 11);
  assert.equal(progress.querySelector('[aria-current="step"]')?.textContent, "L3");
  assert.equal(screen.getByRole("link", { name: "Upload document" }).getAttribute("href"), "/upload");
  assert.equal(screen.getByRole("link", { name: "Download document" }).getAttribute("href"), "/report");
  assert.equal(screen.getByRole("link", { name: /Back to Assessment/ }).getAttribute("href"), "/assessment");
  assert.equal(screen.getByRole("link", { name: /See pathways/ }).getAttribute("href"), "/pathways");
  assert.equal(screen.getByRole("link", { name: /Open ARK history/ }).getAttribute("href"), "/ark/history");
});

test("journey controls remain keyboard-focusable at a small viewport width", () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
  history.pushState({}, "", "/pathways");
  render(React.createElement(JourneyShell, null, React.createElement("p", null, "page")));

  const controls = [
    screen.getByRole("link", { name: "Upload document" }),
    screen.getByRole("link", { name: "Download document" }),
    screen.getByRole("link", { name: /Back to Intelligence/ }),
    screen.getByRole("link", { name: /Build context/ }),
    screen.getByRole("link", { name: /Explore training/ }),
  ];
  for (const control of controls) {
    control.focus();
    assert.equal(document.activeElement, control);
  }
  assert.equal(document.querySelector(".journey-actions")?.className, "journey-actions");
  assert.equal(document.querySelector(".journey-footer")?.className, "journey-footer");
});