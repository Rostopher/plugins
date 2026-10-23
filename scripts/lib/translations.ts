import { AuthorError } from "./problems.ts";

export type ListingTranslations = Record<
  string,
  { name?: string; description?: string }
>;

/** English lives in the existing default fields, never in the translations map. */
export function requireTranslationLocale(tag: string): string {
  try {
    if (tag !== "en" && Intl.getCanonicalLocales(tag)[0] === tag) return tag;
  } catch {
    /* Report the same actionable error for malformed and miscased tags. */
  }
  throw new AuthorError(
    `Expected a canonical language tag other than en, such as zh-CN; got ${JSON.stringify(
      tag
    )}.`
  );
}

export function parseTranslations(raw: unknown): ListingTranslations {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new AuthorError(
      "translations must be an object keyed by canonical language tags."
    );
  return Object.fromEntries(
    Object.entries(raw).map(([tag, fields]) => {
      requireTranslationLocale(tag);
      if (!fields || typeof fields !== "object" || Array.isArray(fields))
        throw new AuthorError(
          `translations.${tag} must be an object with optional name and description.`
        );
      const result: { name?: string; description?: string } = {};
      for (const [field, value] of Object.entries(fields)) {
        if (field !== "name" && field !== "description")
          throw new AuthorError(`Unknown field translations.${tag}.${field}.`);
        if (typeof value !== "string" || !value.trim())
          throw new AuthorError(
            `translations.${tag}.${field} must be a non-empty string.`
          );
        result[field] = value.trim();
      }
      return [tag, result];
    })
  );
}

/** Overrides replace only supplied fields, retaining the author's other fields and locales. */
export function mergeTranslations(
  author: ListingTranslations = {},
  overrides: ListingTranslations = {}
): ListingTranslations {
  return Object.fromEntries(
    [...new Set([...Object.keys(author), ...Object.keys(overrides)])].map(
      (tag) => [tag, { ...author[tag], ...overrides[tag] }]
    )
  );
}

/** Discover adjacent files, including locales with an overview but no translated metadata. */
export function overviewTranslationFiles(
  paths: string[],
  stem = "OVERVIEW"
): Array<{ locale: string; path: string }> {
  const prefix = `${stem}.`;
  return paths
    .filter(
      (path) =>
        path !== `${stem}.md` && path.startsWith(prefix) && path.endsWith(".md")
    )
    .flatMap((path) => {
      const locale = path.slice(prefix.length, -3);
      // Auxiliary names such as backup and notes are syntactically valid BCP 47
      // language subtags. The filename convention uses 2/3-letter language codes.
      if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(locale) || locale === "en")
        return [];
      try {
        return Intl.getCanonicalLocales(locale)[0] === locale
          ? [{ locale, path }]
          : [];
      } catch {
        return [];
      }
    });
}
