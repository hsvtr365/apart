import assert from "node:assert/strict";
import { test } from "node:test";
import { demoData } from "../src/lib/demo";
import {
  isPublicPost,
  pageMetadata,
  publicPages,
  SITE_URL,
  validPagePath,
} from "../src/lib/seo";

test("only known page paths are accepted", () => {
  for (const path of [
    [],
    ["feed"],
    ["feed", "food"],
    ["map", "id"],
    ["post", "id"],
    ["my"],
  ])
    assert.equal(validPagePath(path), true);
  for (const path of [
    ["robots.txt"],
    ["feed", "unknown"],
    ["post"],
    ["my", "extra"],
    ["home", "extra"],
    ["post", "id", "extra"],
  ])
    assert.equal(validPagePath(path), false);
});

test("canonical and social URLs always use apart; private content is not described", () => {
  const post = demoData().posts[0];
  const meta = pageMetadata("/post/" + post.id, post);
  assert.equal(meta.alternates?.canonical, SITE_URL + "/post/" + post.id);
  assert.equal(meta.description, post.body);
  for (const flag of ["hidden", "adminDeleted", "userDeleted"] as const) {
    const privatePost = { ...post, [flag]: true };
    assert.equal(isPublicPost(privatePost), false);
    const privateMeta = pageMetadata("/post/" + post.id, privatePost);
    assert.deepEqual(privateMeta.robots, { index: false, follow: true });
    assert.notEqual(privateMeta.title, post.title);
    assert.notEqual(privateMeta.description, post.body);
  }
  for (const path of ["/my", "/report", "/map/" + post.id])
    assert.deepEqual(pageMetadata(path).robots, { index: false, follow: true });
  for (const path of Object.keys(publicPages))
    assert.equal(pageMetadata(path).alternates?.canonical, SITE_URL + path);
});
