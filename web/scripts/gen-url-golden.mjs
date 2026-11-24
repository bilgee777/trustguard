// Generates shared/engine/url-parse-expected.json from Node's WHATWG URL implementation.
// The C# URL parser is tested against this snapshot, so both engines parse links identically.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../../shared/engine/', import.meta.url);
const { cases } = JSON.parse(readFileSync(new URL('url-parse-cases.json', dir), 'utf8'));

const expected = cases.map((input) => {
  try {
    const u = new URL(input);
    return {
      input,
      expected: {
        scheme: u.protocol.replace(/:$/, ''),
        username: u.username,
        password: u.password,
        hostname: u.hostname,
        port: u.port,
        pathname: u.pathname,
        search: u.search,
      },
    };
  } catch {
    return { input, expected: null };
  }
});

writeFileSync(
  new URL('url-parse-expected.json', dir),
  `${JSON.stringify({ node: process.version, cases: expected }, null, 1)}\n`,
);
console.log(
  `${expected.filter((c) => c.expected).length} parsed, ${expected.filter((c) => !c.expected).length} rejected (Node ${process.version})`,
);
