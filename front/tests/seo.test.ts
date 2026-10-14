import assert from "node:assert/strict";
import { test } from "node:test";
import { demoData } from "../src/lib/demo";
import {
  isPublicPost,
  pageMetadata,
  publicPages,
  SITE_URL,
  validPagePath,
  pageStructuredData,
  serializeJsonLd,
} from "../src/lib/seo";

test("only known page paths are accepted", () => {
  for (const path of [
    [],
    ["feed"],
    ["feed", "food"],
    ["map", "id"],
    ["post", "id"],
    ["my"],
    ["about"],
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

test("structured data matches public content, breadcrumbs and dates without account identifiers", () => {
  const post = {
    ...demoData().posts[0],
    updatedAt: "2026-10-14T01:00:00.000Z",
  };
  const path = "/post/" + post.id;
  const data = pageStructuredData(path, post)!;
  const article = data["@graph"].find(
    (item) => item["@type"] === "DiscussionForumPosting",
  )!;
  assert.equal(article.text, post.body);
  assert.equal(article.dateModified, post.updatedAt);
  assert.deepEqual(article.author, { "@type": "Person", name: post.author });
  assert(!JSON.stringify(data).includes('"authorId"'));
  assert(!JSON.stringify(data).includes('"authorBuilding"'));
  const breadcrumb = data["@graph"].find(
    (item) => item["@type"] === "BreadcrumbList",
  )!;
  const items = breadcrumb.itemListElement as {
    item: string;
    position: number;
  }[];
  assert.equal(items.at(-1)?.item, SITE_URL + path);
  assert.deepEqual(
    items.map((item) => item.position),
    [1, 2, 3, 4],
  );
  for (const flag of ["hidden", "adminDeleted", "userDeleted"] as const)
    assert.equal(pageStructuredData(path, { ...post, [flag]: true }), null);
  for (const path of ["/my", "/report", "/map/id", "/missing"])
    assert.equal(pageStructuredData(path), null);
  assert(
    pageStructuredData("/about")?.["@graph"].some(
      (item) => item["@type"] === "AboutPage",
    ),
  );
  assert.equal(
    (pageMetadata(path, post).robots as Record<string, unknown>)[
      "max-image-preview"
    ],
    "large",
  );
});

test("JSON-LD cannot close its script tag with user text", () => {
  const malicious = { text: '</script><script>alert("x")</script>' };
  const serialized = serializeJsonLd(malicious);
  assert(!serialized.includes("<"));
  assert.deepEqual(JSON.parse(serialized), malicious);
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
