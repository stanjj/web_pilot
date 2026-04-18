import assert from "node:assert/strict";
import test from "node:test";

import { summarizeLinkedinPage } from "../src/sites/linkedin/helpers.mjs";
import { summarizeTwitterPage } from "../src/sites/twitter/helpers.mjs";

test("summarizeLinkedinPage marks auth-wall pages as login required", () => {
  assert.deepEqual(
    summarizeLinkedinPage({
      url: "https://www.linkedin.com/authwall?trk=guest_job_search",
      title: "LinkedIn Login, Sign in",
      bodyText: "Sign in to view more jobs. Join now to see who is hiring.",
      hasGlobalNav: false,
      hasSearchBox: false,
      currentUserName: "",
      currentUserUrl: "",
    }),
    {
      ok: false,
      status: "Login required",
      url: "https://www.linkedin.com/authwall?trk=guest_job_search",
      title: "LinkedIn Login, Sign in",
      loggedIn: false,
      needsLogin: true,
      hasGlobalNav: false,
      hasSearchBox: false,
      currentUser: null,
      message: "Open a logged-in LinkedIn session in the shared agent browser before using LinkedIn job workflows.",
    },
  );
});

test("summarizeLinkedinPage exposes current user when the app shell is ready", () => {
  assert.deepEqual(
    summarizeLinkedinPage({
      url: "https://www.linkedin.com/jobs/search/?keywords=ai",
      title: "LinkedIn Jobs",
      bodyText: "Jobs Messaging Notifications Me",
      hasGlobalNav: true,
      hasSearchBox: true,
      currentUserName: "Jane Recruiter",
      currentUserUrl: "https://www.linkedin.com/in/jane-recruiter/",
    }),
    {
      ok: true,
      status: "Connected",
      url: "https://www.linkedin.com/jobs/search/?keywords=ai",
      title: "LinkedIn Jobs",
      loggedIn: true,
      needsLogin: false,
      hasGlobalNav: true,
      hasSearchBox: true,
      currentUser: {
        name: "Jane Recruiter",
        profileUrl: "https://www.linkedin.com/in/jane-recruiter/",
      },
      message: "",
    },
  );
});

test("summarizeLinkedinPage trims LinkedIn profile aria labels to a usable name", () => {
  const result = summarizeLinkedinPage({
    url: "https://www.linkedin.com/jobs/search/",
    title: "LinkedIn Jobs",
    bodyText: "Jobs Messaging Notifications Me",
    hasGlobalNav: true,
    hasSearchBox: true,
    currentUserName: "View Donavan C.’s verified profile graphic",
    currentUserUrl: "https://www.linkedin.com/in/donavan-cole/",
  });

  assert.equal(result.currentUser?.name, "Donavan C.");
});

test("summarizeLinkedinPage treats a jobs results shell as logged in even without a visible search box", () => {
  const result = summarizeLinkedinPage({
    url: "https://www.linkedin.com/jobs/search/?keywords=engineer",
    title: "(13) engineer Jobs | LinkedIn",
    bodyText: "Jobs search engineer in United States 223,160 results Set alert",
    hasGlobalNav: true,
    hasSearchBox: false,
    currentUserName: "",
    currentUserUrl: "",
  });

  assert.equal(result.ok, true);
  assert.equal(result.loggedIn, true);
  assert.equal(result.status, "Connected");
});

test("summarizeTwitterPage marks login-gated pages as login required", () => {
  assert.deepEqual(
    summarizeTwitterPage({
      url: "https://x.com/i/flow/login",
      title: "X / Login",
      bodyText: "Sign in to X to continue. Join today.",
      hasPrimaryColumn: false,
      hasSearchInput: false,
      hasTweetComposer: false,
      currentUserName: "",
      currentUserHandle: "",
      currentUserUrl: "",
    }),
    {
      ok: false,
      status: "Login required",
      url: "https://x.com/i/flow/login",
      title: "X / Login",
      loggedIn: false,
      needsLogin: true,
      hasPrimaryColumn: false,
      hasSearchInput: false,
      hasTweetComposer: false,
      currentUser: null,
      message: "Open a logged-in X session in the shared agent browser before using Twitter/X commands that require search, trends, or profile context.",
    },
  );
});

test("summarizeTwitterPage exposes current user when the app shell is ready", () => {
  assert.deepEqual(
    summarizeTwitterPage({
      url: "https://x.com/home",
      title: "Home / X",
      bodyText: "Home Explore Notifications Messages",
      hasPrimaryColumn: true,
      hasSearchInput: true,
      hasTweetComposer: true,
      currentUserName: "Jane Trader",
      currentUserHandle: "janetrader",
      currentUserUrl: "https://x.com/janetrader",
    }),
    {
      ok: true,
      status: "Connected",
      url: "https://x.com/home",
      title: "Home / X",
      loggedIn: true,
      needsLogin: false,
      hasPrimaryColumn: true,
      hasSearchInput: true,
      hasTweetComposer: true,
      currentUser: {
        name: "Jane Trader",
        handle: "janetrader",
        profileUrl: "https://x.com/janetrader",
      },
      message: "",
    },
  );
});
