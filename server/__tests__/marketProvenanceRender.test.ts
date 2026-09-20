import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OnboardingScoreDisclosure } from "../../client/src/components/OnboardingTour";

test("onboarding score claim renders its source, date, and static methodology", () => {
  const html = renderToStaticMarkup(React.createElement(OnboardingScoreDisclosure));

  assert.match(html, /ARK Onecraft curated scoring model/);
  assert.match(html, /Data as of 6 September 2026/);
  assert.match(html, /static code-defined rules/);
  assert.match(html, /not a live labour-market feed/);
});