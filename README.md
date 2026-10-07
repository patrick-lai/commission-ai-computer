# commission-ai-computer

The contract behind CommissionAI's background Mac app control: which operations exist, how large each argument may be, the tool schemas an agent sees, and a shared set of test vectors.

CommissionAI checks every computer action twice. The daemon parses it and tests it against the selected window. The native Mac host tests it again before it touches the system. Those two checks used to be written by hand in Rust and in Swift. This package holds the one description both are tested against.

## What is in it

| File | Purpose |
| --- | --- |
| `contract/spec.json` | Operations, input operations, mouse buttons and every numeric limit |
| `contract/fixtures.json` | Test vectors: an operation, a window, and what the daemon and the host each accept |
| `contract/tools.json` | The tool definitions an agent receives, with their JSON schemas |
| `index.mjs` | A reference validator for both layers, used to keep the vectors honest |

The two layers differ on purpose. The daemon knows the selected window, so it refuses points outside it and a click that names both a control and a point. The host only checks that numbers are finite. Each vector records both answers, and a `note` explains every difference.

## Use it

```sh
npm install @patrick-lai/commission-ai-computer
```

```js
import { daemonAccepts, hostAccepts, spec } from "@patrick-lai/commission-ai-computer";

hostAccepts({ kind: "key", observation: "o", key: "Cmd+a" });
```

An implementation is correct when, for every case in `contract/fixtures.json`, it answers `daemon` (or `host`) the same way the vector does. CommissionAI runs these vectors in its Rust daemon and its Swift host.

## What is not here

The app that performs the actions is not part of this package. macOS grants Accessibility and Screen Recording to a signed app, so the code that controls windows stays inside the CommissionAI app.

## Develop

```sh
npm test
npm run fixtures
```

`npm run fixtures` rewrites `contract/fixtures.json` from `scripts/generate-fixtures.mjs`. Change the vectors there, then update the daemon or the host until their tests agree.

## License

Apache-2.0
