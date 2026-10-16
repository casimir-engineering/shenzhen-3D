const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  RELEASE_OWNERS,
  resolveReleaseOwner,
  resolveArtifactReleaseOwner,
  validatePackagedFeed,
} = require("./release-channel.cjs");

test("packaged release source requires explicit allowlisted signed metadata", () => {
  for (const owner of RELEASE_OWNERS)
    assert.equal(resolveReleaseOwner({ releaseOwner: owner }, true), owner);
  for (const metadata of [
    {},
    null,
    { releaseOwner: "unknown" },
    { releaseOwner: "../mirror-org" },
  ])
    assert.throws(
      () => resolveReleaseOwner(metadata, true),
      /Invalid release owner/,
    );
  assert.equal(resolveReleaseOwner({}, false), "casimir-engineering");
});
test("feed validation binds owner and private repository without credentials", () => {
  for (const owner of RELEASE_OWNERS) {
    const feed = {
      provider: "github",
      owner,
      repo: "shenzhen-3D",
      private: true,
      channel: "latest",
    };
    assert.equal(validatePackagedFeed(feed, owner), feed);
    for (const change of [
      { owner: RELEASE_OWNERS.find((x) => x !== owner) },
      { repo: "other" },
      { provider: "generic" },
      { private: false },
      { channel: "beta" },
      { token: "forbidden" },
      { headers: {} },
      { requestHeaders: {} },
    ])
      assert.throws(
        () => validatePackagedFeed({ ...feed, ...change }, owner),
        /does not match/,
      );
  }
});

test("notarization retains selected origin and refuses missing modern provenance", () => {
  for (const owner of RELEASE_OWNERS)
    assert.equal(
      resolveArtifactReleaseOwner(
        { version: "0.1.6", releaseOwner: owner },
        { releaseOwner: owner },
      ),
      owner,
    );
  assert.equal(
    resolveArtifactReleaseOwner({ version: "0.1.4" }, {}),
    "casimir-engineering",
  );
  assert.throws(
    () => resolveArtifactReleaseOwner({ version: "0.1.6" }, {}),
    /Invalid release owner/,
  );
  assert.throws(
    () =>
      resolveArtifactReleaseOwner(
        { version: "0.1.6", releaseOwner: "mirror-org" },
        { releaseOwner: "casimir-engineering" },
      ),
    /does not match provenance/,
  );
  assert.throws(
    () =>
      resolveArtifactReleaseOwner(
        { version: "0.1.6", releaseOwner: "mirror-org" },
        {},
      ),
    /Invalid release owner/,
  );
});
