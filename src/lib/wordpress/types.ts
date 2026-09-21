export type WpImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

export type WpAuthor = {
  name: string;
  avatar: string | null;
};

export type WpPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  /** Sanitised HTML, ready to render. */
  content: string;
  date: string;
  modified: string;
  featuredImage: WpImage | null;
  author: WpAuthor | null;
  categories: string[];
  readingMinutes: number;
};

export type WpPage = {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  featuredImage: WpImage | null;
  modified: string;
};

/**
 * Editorial overrides a marketing team can set per property in WordPress
 * without an OwnerRez login. Anything left blank falls through to OwnerRez.
 */
export type WpPropertyContent = {
  propertyId: number;
  headline: string | null;
  intro: string | null;
  body: string | null;
  /** Curated highlights shown above the fold. */
  highlights: string[];
  /** Local recommendations: where to eat, what to walk. */
  neighbourhood: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};
