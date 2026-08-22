'use strict';

/**
 * HTTP may only be spoken in `src/api/`.
 *
 * Every endpoint gets exactly one typed method with one schema, so that a response the
 * app no longer returns fails at the client with a message naming the route — instead
 * of surfacing as `undefined` three assertions later.
 *
 * This matters more than usual on this app. `realworld/api/swagger.json` documents the
 * canonical RealWorld API, not this fork, and the two disagree: registration returns
 * `200` where the spec says `201`, a duplicate email returns `404 text/html` where the
 * spec says `422 JSON`, and `bio` is `""` from register but `null` from login. An agent
 * writing a one-off `request.post(...)` inside a spec reproduces the spec's fiction;
 * an agent adding a method to the client has to look at what the server actually does.
 */

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'fetch']);
const HTTP_OBJECTS = new Set(['request', 'apiRequest', 'axios', 'http']);

const ALLOWED_DIRS = ['src/api/', 'tools/'];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow raw HTTP calls outside the typed API client',
    },
    messages: {
      rawHttpOutsideClient:
        'Raw HTTP call `{{call}}` is not allowed here. All requests go through ' +
        'ConduitClient in src/api/. Add a typed method with a schema there, verify the ' +
        'real response against the running app, then call it from your test. ' +
        'See docs/ENGINEERING_STANDARDS.md.',
    },
    schema: [],
  },

  create(context) {
    const filename = (context.filename ?? context.getFilename()).split('\\').join('/');

    if (ALLOWED_DIRS.some((dir) => filename.includes(dir))) {
      return {};
    }

    return {
      CallExpression(node) {
        const { callee } = node;

        if (callee.type === 'Identifier' && callee.name === 'fetch') {
          context.report({
            node,
            messageId: 'rawHttpOutsideClient',
            data: { call: 'fetch' },
          });
          return;
        }

        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') {
          return;
        }

        if (!HTTP_METHODS.has(callee.property.name)) {
          return;
        }

        const { object } = callee;
        const objectName =
          object.type === 'Identifier'
            ? object.name
            : object.type === 'MemberExpression' && object.property.type === 'Identifier'
              ? object.property.name
              : null;

        if (objectName === null || !HTTP_OBJECTS.has(objectName)) {
          return;
        }

        context.report({
          node,
          messageId: 'rawHttpOutsideClient',
          data: { call: `${objectName}.${callee.property.name}` },
        });
      },
    };
  },
};
