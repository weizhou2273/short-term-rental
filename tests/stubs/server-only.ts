/**
 * Test stub for the `server-only` package.
 *
 * The real module exists to make the bundler fail a build that imports server
 * code into a client component. Under Vitest there is no such boundary, so it
 * is replaced with a no-op — the production import graph is unaffected.
 */
export {};
