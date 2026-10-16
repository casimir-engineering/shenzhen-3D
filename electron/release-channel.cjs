function isReleaseOwner(owner) {
  return (
    typeof owner === "string" &&
    /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(owner)
  );
}
function assertReleaseOwner(owner) {
  if (!isReleaseOwner(owner)) throw Error("Invalid release owner");
  return owner;
}
function resolveReleaseOwner(metadata, packaged) {
  if (!packaged && metadata?.releaseOwner === undefined) return null;
  return assertReleaseOwner(metadata?.releaseOwner);
}
function resolveArtifactReleaseOwner(metadata, provenance) {
  const owner = assertReleaseOwner(metadata.releaseOwner);
  if (assertReleaseOwner(provenance.releaseOwner) !== owner)
    throw Error("Staged release owner does not match provenance");
  return owner;
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
  isReleaseOwner,
  assertReleaseOwner,
  resolveReleaseOwner,
  resolveArtifactReleaseOwner,
  validatePackagedFeed,
};
