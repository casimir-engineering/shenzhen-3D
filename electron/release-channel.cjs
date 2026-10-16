const RELEASE_OWNERS = Object.freeze(["casimir-engineering", "mirror-org"]);
function assertReleaseOwner(owner) {
  if (!RELEASE_OWNERS.includes(owner)) throw Error("Invalid release owner");
  return owner;
}
function resolveReleaseOwner(metadata, packaged) {
  return packaged
    ? assertReleaseOwner(metadata?.releaseOwner)
    : "casimir-engineering";
}
function resolveArtifactReleaseOwner(metadata, provenance) {
  if (require("semver").gte(metadata.version, "0.1.6")) {
    assertReleaseOwner(metadata.releaseOwner);
    assertReleaseOwner(provenance.releaseOwner);
  }
  if (
    (metadata.releaseOwner !== undefined ||
      provenance.releaseOwner !== undefined) &&
    metadata.releaseOwner !== provenance.releaseOwner
  )
    throw Error("Staged release owner does not match provenance");
  return assertReleaseOwner(
    provenance.releaseOwner ?? metadata.releaseOwner ?? "casimir-engineering",
  );
}
function validatePackagedFeed(feed, owner) {
  assertReleaseOwner(owner);
  if (
    !feed ||
    feed.provider !== "github" ||
    feed.owner !== owner ||
    feed.repo !== "shenzhen-3D" ||
    feed.private !== true ||
    feed.channel !== "latest" ||
    "token" in feed ||
    "headers" in feed ||
    "requestHeaders" in feed
  )
    throw Error("Packaged update feed does not match release owner");
  return feed;
}
module.exports = {
  RELEASE_OWNERS,
  assertReleaseOwner,
  resolveReleaseOwner,
  resolveArtifactReleaseOwner,
  validatePackagedFeed,
};
