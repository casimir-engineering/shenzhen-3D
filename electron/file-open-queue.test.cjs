const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createFileOpenQueue } = require("./file-open-queue.cjs");
test("cold files wait for the primary window even if a background window drains first", () => {
  const queue = createFileOpenQueue();
  queue.push(["cold.step"]);
  assert.deepEqual(queue.take(2, 1), []);
  assert.deepEqual(queue.take(1, 1), [["cold.step"]]);
  assert.deepEqual(queue.take(1, 1), []);
});
test("warm batches retain their target and companions through competing drains", () => {
  const queue = createFileOpenQueue();
  queue.push(["part.obj", "paint.mtl"], 2);
  queue.push(["other.step"], 1);
  assert.deepEqual(queue.take(1, 1), [["other.step"]]);
  assert.deepEqual(queue.take(2, 1), [["part.obj", "paint.mtl"]]);
});
test("pending batches have a bounded backlog", () => {
  const queue = createFileOpenQueue();
  for (let i = 0; i < 20; i++) queue.push([String(i)], 1);
  const result = queue.take(1, 1);
  assert.equal(result.length, 16);
  assert.deepEqual(result[0], ["4"]);
});
