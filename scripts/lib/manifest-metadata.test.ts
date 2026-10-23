import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { readArtifactFiles } from "./artifact-files.ts";
import { resolvePlugin, summarize } from "./listing.ts";
import { createNpmClient } from "./npm.ts";
import type { PluginRecord } from "./record.ts";
import { AuthorError } from "./problems.ts";
import { validateArtifact } from "./validate-artifact.ts";

function fixture(t: TestContext, kind: "npm" | "git", manifest: unknown, listing?: PluginRecord["listing"], overviews: Record<string, string> = {}, links: string[] = []) {
  const root = mkdtempSync(join(tmpdir(), "registry-manifest-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pluginPath = kind === "npm" ? "package" : "plugins/example";
  const plugin = join(root, pluginPath);
  mkdirSync(join(plugin, "assets"), { recursive: true });
  writeFileSync(join(plugin, "paseo-plugin.json"), JSON.stringify(manifest));
  writeFileSync(join(plugin, "OVERVIEW.md"), "A theme for focused work.");
  for (const [name, body] of Object.entries(overviews)) writeFileSync(join(plugin, name), body);
  writeFileSync(join(root, "outside.md"), "Outside plugin");
  for (const name of links) { rmSync(join(plugin, name), { force: true }); symlinkSync(join(root, "outside.md"), join(plugin, name)); }
  // This obsolete file must never influence the listing.
  writeFileSync(join(plugin, "paseo-listing.json"), JSON.stringify({ name: "Wrong name", media: ["https://wrong.test/wrong.png"] }));
  for (const path of ["icon.png", "screen shot.PNG", "demo.mp4"]) writeFileSync(join(plugin, "assets", path), "fixture asset");
  const remote = "https://github.com/acme/manifest.git";
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q");
  if (kind === "npm") {
    writeFileSync(join(plugin, "paseo-plugin.json"), '{"name":"Repository name"}');
    writeFileSync(join(plugin, "OVERVIEW.md"), "Repository overview.");
  }
  git("add", ".");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "published");
  const commit = git("rev-parse", "HEAD");
  for (const name of Object.keys(overviews)) writeFileSync(join(plugin, name), "Unreviewed translation");
  // HEAD is deliberately different from the pinned manifest and assets.
  writeFileSync(join(plugin, "paseo-plugin.json"), '{"name":"Unreleased"}');
  git("add", ".");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "unreleased");
  const keys = ["GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"];
  const previous = keys.map((key) => process.env[key]);
  process.env.GIT_CONFIG_COUNT = "1";
  process.env.GIT_CONFIG_KEY_0 = `url.file://${root}.insteadOf`;
  process.env.GIT_CONFIG_VALUE_0 = remote;
  t.after(() => keys.forEach((key, i) => {
    if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
  }));
  writeFileSync(join(plugin, "paseo-plugin.json"), JSON.stringify(manifest));
  writeFileSync(join(plugin, "OVERVIEW.md"), "A theme for focused work.");
  for (const [name, body] of Object.entries(overviews)) writeFileSync(join(plugin, name), body);
  const archive = execFileSync("tar", ["-czf", "-", "-C", root, pluginPath]);
  const doc = { name: "@acme/example", version: "1.0.0", description: "Package description", dist: {
    tarball: "https://registry.npmjs.org/example/-/example-1.0.0.tgz",
    integrity: `sha512-${createHash("sha512").update(archive).digest("base64")}`,
  } };
  const client = createNpmClient(async (input) => {
    const url = String(input);
    if (url === doc.dist.tarball) return new Response(archive);
    if (url === "https://registry.npmjs.org/@acme/example") return Response.json({
      name: doc.name, "dist-tags": { latest: "9.0.0" }, versions: { "1.0.0": doc }, time: {},
    });
    throw new Error(`Unexpected request: ${url}`);
  });
  const record: PluginRecord = {
    id: "acme/example", categories: ["themes"], listing,
    artifact: kind === "npm"
      ? { kind, package: doc.name, version: doc.version, resolved: doc.dist.tarball, integrity: doc.dist.integrity }
      : { kind, remote, commit, pluginPath },
    repository: { url: "https://github.com/acme/manifest" },
    submittedAt: "2026-10-07", publishedAt: "2026-10-07", reviewedAt: "2026-10-07",
  };
  const base = kind === "npm" ? "https://cdn.jsdelivr.net/npm/@acme/example@1.0.0/"
    : `https://github.com/acme/manifest/raw/${commit}/${pluginPath}/`;
  const detail = () => resolvePlugin(client, record, "Imported overview");
  const validate = () => validateArtifact(client, record, { registryOverview: "Imported overview" });
  return { record, client, detail, validate, base };
}

for (const kind of ["npm", "git"] as const) {
  test(`${kind}: publication and validation read metadata from the pinned manifest`, async (t) => {
    const f = fixture(t, kind, {
      id: "example", name: "Author name", description: "Manifest description", icon: "assets/icon.png",
      media: ["assets/demo.mp4", "assets/screen shot.PNG"], futureField: true,
    });
    const detail = await f.detail();
    assert.equal(detail.readme, "A theme for focused work.");
    assert.equal(detail.name, "Author name");
    assert.equal(detail.icon, `${f.base}assets/icon.png`);
    assert.deepEqual(detail.media, [`${f.base}assets/demo.mp4`, `${f.base}assets/screen%20shot.PNG`]);
    assert.equal(detail.description, kind === "npm" ? "Package description" : "Manifest description");
    assert.deepEqual(await f.validate(), []);
  });

  test(`${kind}: registry overrides win per field and unused manifest files need not exist`, async (t) => {
    const f = fixture(t, kind, { name: "Author name", description: "Manifest description", icon: "missing.png", media: ["missing.png"] }, {
      name: "Maintainer name", description: "Maintainer description", icon: "https://example.test/override.png", media: [],
    });
    f.record.categories = ["utils"];
    const detail = await f.detail();
    assert.equal(detail.name, "Maintainer name");
    assert.equal(detail.description, "Maintainer description");
    assert.equal(detail.icon, "https://example.test/override.png");
    assert.deepEqual(detail.media, []);
  });

  test(`${kind}: overriding only the name preserves manifest icon and media`, async (t) => {
    const f = fixture(t, kind, { name: "Author name", description: "Manifest description", icon: "assets/icon.png", media: ["assets/screen shot.PNG"] }, { name: "Issue title" });
    const detail = await f.detail();
    assert.equal(detail.name, "Issue title");
    assert.equal(detail.description, kind === "npm" ? "Package description" : "Manifest description");
    assert.equal(detail.icon, `${f.base}assets/icon.png`);
    assert.deepEqual(detail.media, [`${f.base}assets/screen%20shot.PNG`]);
  });

  test(`${kind}: an explicit empty media override is preserved regardless of category`, async (t) => {
    const f = fixture(t, kind, { media: ["assets/screen shot.PNG"] }, { media: [] });
    assert.deepEqual((await f.detail()).media, []);
    assert.deepEqual(await f.validate(), []);
  });

  test(`${kind}: missing metadata uses existing defaults and ignores the retired listing file`, async (t) => {
    const f = fixture(t, kind, { id: "example" });
    f.record.categories = ["utils"];
    const detail = await f.detail();
    assert.equal(detail.name, "Example");
    assert.equal(detail.translations, undefined);
    assert.equal(detail.overviewTranslations, undefined);
    assert.equal(detail.icon, undefined);
    assert.deepEqual(detail.media, []);
  });

  test(`${kind}: a Themes category does not impose screenshot requirements`, async (t) => {
    const f = fixture(t, kind, { media: ["assets/demo.mp4"] });
    assert.deepEqual((await f.detail()).media, [`${f.base}assets/demo.mp4`]);
    assert.deepEqual(await f.validate(), []);
  });

  test(`${kind}: media references are published for review without requiring an image`, async (t) => {
    const f = fixture(t, kind, { media: ["https://example.test/demo.mp4", "assets/review.png"] });
    assert.deepEqual((await f.detail()).media, ["https://example.test/demo.mp4", `${f.base}assets/review.png`]);
    assert.deepEqual(await f.validate(), []);
  });

  for (const [label, manifest, pattern] of [
    ["path traversal", { media: ["../outside.png"] }, /inside|relative/],
    ["absolute path", { icon: "/icon.png", media: [] }, /inside|relative/],
    ["invalid media type", { media: "assets/icon.png" }, /array/],
    ["invalid name", { name: 42 }, /name/],
    ["unsupported format", { media: ["https://example.test/image.svg"] }, /png|image/],
  ] as const) {
    test(`${kind}: ${label} gives an author-fixable error`, async (t) => {
      const f = fixture(t, kind, manifest);
      await assert.rejects(f.validate(), (error: Error) => error instanceof AuthorError && pattern.test(error.message));
    });
  }
}

test("npm file reads need only the artifact pin, without repository metadata or provenance", async (t) => {
  const { client, record } = fixture(t, "npm", { name: "Package name" });
  const files = await readArtifactFiles(client, record.artifact);
  assert.deepEqual(files, {
    manifest: '{"name":"Package name"}',
    overview: "A theme for focused work.",
  });
});

for (const field of ["integrity", "resolved"] as const) {
  test(`npm rejects a changed ${field} pin before returning package files`, async (t) => {
    const { client, record } = fixture(t, "npm", { name: "Package name" });
    assert.equal(record.artifact.kind, "npm");
    await assert.rejects(readArtifactFiles(client, {
      ...record.artifact, [field]: "changed",
    }), /differs from the pinned record/);
  });
}

for (const kind of ["npm", "git"] as const) {
  test(`${kind}: translated publication uses only the reviewed artifact and overrides each field`, async (t) => {
    const f = fixture(t, kind, {
      name: "Example", description: "English description",
      translations: { "zh-CN": { name: "示例", description: "中文描述" }, fr: { name: "Exemple" } },
    }, { translations: { "zh-CN": { name: "审阅名称" }, de: { description: "Beschreibung" } } }, {
      "OVERVIEW.zh-CN.md": "中文概述", "OVERVIEW.ja.md": "日本語の概要",
    });
    const detail = await resolvePlugin(f.client, f.record, "Reviewer English", {
      "zh-CN": "Reviewer Chinese", fr: "Présentation du réviseur",
    });
    // A reader selects missing fields independently and missing overviews as a whole.
    assert.equal(detail.translations!.fr.description ?? detail.description, detail.description);
    assert.equal(detail.overviewTranslations!.de ?? detail.readme, detail.readme);
    assert.equal(detail.name, "Example");
    assert.equal(detail.description, kind === "npm" ? "Package description" : "English description");
    assert.equal(detail.readme, "A theme for focused work.");
    assert.deepEqual(detail.translations, {
      "zh-CN": { name: "审阅名称", description: "中文描述" }, fr: { name: "Exemple" }, de: { description: "Beschreibung" },
    });
    assert.deepEqual(detail.overviewTranslations, { "zh-CN": "中文概述", ja: "日本語の概要", fr: "Présentation du réviseur" });
    const summary = summarize(detail);
    assert.deepEqual(summary.translations, detail.translations);
    assert.equal("readme" in summary, false);
    assert.equal("overviewTranslations" in summary, false);
    assert.deepEqual(await f.validate(), []);
  });

  for (const translations of [
    { "zh-cn": { name: "示例" } }, { en: { name: "Example" } }, { "not a tag": {} },
    { "zh-CN": { name: " " } }, { "zh-CN": { desc: "错别字" } }, { "zh-CN": [] }, [],
  ]) {
    test(`${kind}: invalid listing translations ${JSON.stringify(translations)}`, async (t) => {
      const f = fixture(t, kind, { translations });
      await assert.rejects(f.validate(), AuthorError);
      await assert.rejects(f.detail(), AuthorError);
    });
  }
  for (const filename of ["OVERVIEW.backup.md", "OVERVIEW.notes.md", "OVERVIEW.not a tag.md", "OVERVIEW.zh-cn.md", "OVERVIEW.en.md", "README.zh-CN.md"]) {
    test(`${kind}: auxiliary overview ${filename} is ignored`, async (t) => {
      const f = fixture(t, kind, {}, undefined, { [filename]: "Auxiliary content" });
      const detail = await f.detail();
      assert.equal(detail.readme, "A theme for focused work.");
      assert.equal(detail.overviewTranslations, undefined);
      assert.deepEqual(await f.validate(), []);
    });
  }

  test(`${kind}: overview discovery loads canonical 2/3-letter language codes`, async (t) => {
    const f = fixture(t, kind, {}, undefined, {
      "OVERVIEW.zh-CN.md": "中文概述", "OVERVIEW.fr.md": "Présentation",
      "OVERVIEW.ast.md": "Resume n'asturianu",
    });
    const detail = await f.detail();
    assert.equal(detail.readme, "A theme for focused work.");
    assert.deepEqual(detail.overviewTranslations, {
      "zh-CN": "中文概述", fr: "Présentation", ast: "Resume n'asturianu",
    });
    assert.equal(detail.translations, undefined);
    assert.deepEqual(await f.validate(), []);
  });
}

for (const kind of ["npm", "git"] as const) {
  for (const filename of ["OVERVIEW.md", "OVERVIEW.zh-CN.md", "OVERVIEW.fr.md"]) {
    test(`${kind}: ${filename} uses the same file boundary checks`, async (t) => {
      const f = fixture(t, kind, {}, undefined, {}, [filename]);
      await assert.rejects(f.validate(), /regular file|escapes plugin directory/);
      await assert.rejects(f.detail(), /regular file|escapes plugin directory/);
    });
  }
}
