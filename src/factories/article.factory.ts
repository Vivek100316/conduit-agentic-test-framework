import type { ArticleInput } from '../api/conduit-client';
import { unique } from './unique';

/**
 * Titles and tags carry a uniqueness token so that parallel workers never collide and a
 * feed assertion can find exactly one article.
 *
 * Tags in particular must be unique: Conduit's tag list is global — shared by every test
 * in the run — so a fixed tag name would make any assertion about tags depend on whatever
 * else happened to be running. See docs/ENGINEERING_STANDARDS.md.
 *
 * The body is deliberately dull. A test that asserts on content passes its own via
 * `overrides`, which keeps the assertion visible in the test rather than buried in a
 * generator.
 */
export function buildArticle(overrides: Partial<ArticleInput> = {}): ArticleInput {
  const id = unique();

  return {
    title: `QA Article ${id}`,
    description: `Description for ${id}`,
    body: `Body for ${id}`,
    tagList: [`tag-${id}`],
    ...overrides,
  };
}
