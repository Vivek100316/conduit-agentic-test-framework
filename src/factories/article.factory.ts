import { faker } from '@faker-js/faker';

import type { ArticleInput } from '../api/conduit-client';

/**
 * Titles carry a unique suffix so that parallel workers never collide, and so that a
 * search or feed assertion can find exactly one article.
 *
 * Tags are unique per call by default. Conduit's tag list is global — every test in the
 * run shares it — so a fixed tag name would make any assertion about tags dependent on
 * what else happened to be running. See docs/ENGINEERING_STANDARDS.md.
 */
export function buildArticle(overrides: Partial<ArticleInput> = {}): ArticleInput {
  const unique = `${Date.now()}${faker.string.alphanumeric(6).toLowerCase()}`;

  return {
    title: `QA Article ${unique}`,
    description: faker.lorem.sentence(),
    body: faker.lorem.paragraphs(2),
    tagList: [`tag-${unique}`],
    ...overrides,
  };
}
