import { AuthorError } from "./problems.ts";
import { readdirSync } from "node:fs";
import { overviewTranslationFiles } from "./translations.ts";
import { readOptional, withGitArtifact } from "./git-artifact.ts";
import { type NpmClient, resolveVersion } from "./npm.ts";
import type { PluginRecord } from "./record.ts";

export interface ArtifactFiles {
  manifest: string | null;
  overview: string | null;
  overviewTranslations?: Record<string, string>;
}

/** Read plugin files from the verified install pin, independently of repository metadata. */
export async function readArtifactFiles(
  client: NpmClient,
  artifact: PluginRecord["artifact"],
): Promise<ArtifactFiles> {
  if (artifact.kind === "git") {
    return withGitArtifact({ artifact }, (directory) => ({
      manifest: readOptional(directory, "paseo-plugin.json"),
      overview: readOptional(directory, "OVERVIEW.md"),
      ...localizedOverviews(readdirSync(directory), (path) => readOptional(directory, path)),
    }));
  }
  const doc = resolveVersion(await client.packument(artifact.package), artifact.version);
  if (doc.dist.integrity !== artifact.integrity || doc.dist.tarball !== artifact.resolved) {
    throw new Error(`${artifact.package}@${artifact.version} integrity on npm differs from the pinned record`);
  }
  const [manifest, overview] = await Promise.all([
    client.file(artifact.package, artifact.version, "paseo-plugin.json"),
    client.file(artifact.package, artifact.version, "OVERVIEW.md"),
  ]);
  const translatedFiles = overviewTranslationFiles(await client.files(artifact.package, artifact.version));
  const translations = await Promise.all(translatedFiles.map(async ({ locale, path }) => {
    const body = await client.file(artifact.package, artifact.version, path);
    if (body === null) throw new AuthorError(`Cannot read published overview ${path}.`);
    return [locale, body] as const;
  }));
  return { manifest, overview, ...(translations.length ? { overviewTranslations: Object.fromEntries(translations) } : {}) };
}

export function localizedOverviews(paths: string[], read: (path: string) => string | null, stem = "OVERVIEW"): Pick<ArtifactFiles, "overviewTranslations"> {
  const entries = overviewTranslationFiles(paths, stem).flatMap(({ locale, path }) => {
    const body = read(path);
    return body === null ? [] : [[locale, body]];
  });
  return entries.length ? { overviewTranslations: Object.fromEntries(entries) } : {};
}
