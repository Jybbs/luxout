# Contributing

This guide takes a contributor on macOS or Linux from a fresh clone of *Luxout* through its checks to an issue and a pull request, each opened from its template. [mise](https://mise.jdx.dev) installs each tool the repository pins, and Bun installs the packages `bun.lock` records.

## A Fresh Clone

Install mise and activate it in your shell, following its [getting-started guide](https://mise.jdx.dev/getting-started.html#activate-mise), and then run the block below from the directory that will hold the clone:

```sh
git clone https://github.com/Jybbs/luxout.git
mise trust luxout
mise -C luxout install
cd luxout
bun install --frozen-lockfile --ignore-scripts
mise doctor project
```

As soon as `cd` runs, mise puts the `.mise/bin` wrappers on the path beside the releases `.mise/config.toml` pins, even when the block is pasted whole. The `bun` on the next line is therefore the pinned release, and it installs the packages alone, running no script `package.json` declares, so `dist/` comes only from `mise run build`. Once it has filled `node_modules/`, each program a task runs from the package's dependencies (*`tsc` and `vitest` among them*) runs by name through its wrapper. `mise doctor project` then runs the readiness checks `.mise/config.toml` declares under `[doctor.checks]`, reporting each that fails beside the command that fixes it. They confirm that every pinned tool is installed and that Bash, Git 2.35 or later, and tar are on the path, since the suites start each of the three and mise pins no release of them. `mise run check` and `mise run ci` each open on the same checks.

## Checking a Change

`mise run check` runs `mise doctor project`, then `mise run lockfile`, which fails on a pin `.mise/mise.lock` does not record, and the plugin's and the site's type and lint checks beside `mise run survey`, which audits the cross-config pins, every task, the workflows, and every TypeScript line's length. It then runs the tests Vitest selects as affected by the branch's changes since its merge base with `origin/main`, through `mise run affected` for the plugin and `mise run site:affected` for the site, and it is the check to run before each commit. `mise run ci` runs `mise doctor project` and then every check a pull request runs in CI, on the release of Node `.mise/config.toml` pins, carrying each check to its end where another fails and finishing on the list of each that failed. CI runs the plugin's suite again on the oldest releases of Node 22 and 24 that `engines` in `package.json` admits, and `mise run plugin:test:22` and `mise run plugin:test:24` run those suites locally once `mise install --include-task-tools` has installed both releases. After an edit to any `package.json` or to `.mise/config.toml`, run `mise run relock` to re-resolve each lockfile against its manifest, since `mise run ci` fails on a lockfile that no longer matches its manifest. `mise run lift` lists each pin behind its newest release as a table, and `mise run lift --try --write` writes the lift in place and relocks once `mise run ci` passes on it in a scratch clone. `mise tasks` lists every task with its description.

## Running Homebridge Locally

`mise run plugin:run` builds the plugin and starts Homebridge with the Homebridge UI beside it, loading *Luxout* from the checkout rather than from a global install. The test config at `tests/plugin/homebridge/config.json` holds a bridge, the UI's block, and a `Luxout` block at Boston's coordinates with one threshold sensor, Dark Outside, beside an entry named Dusk whose equal levels fail validation, and the first run copies it into a storage directory under `.cache/homebridge/`. Every later run starts from that storage, so the bridge's pairing, the accessories Homebridge caches, and the forecast window the plugin stores carry over, while nothing Homebridge writes reaches the tracked tree. Each run also installs the Homebridge UI into `.cache/homebridge/` from the `package.json` and `bun.lock` beside the test config, a step that changes nothing once the install matches the lockfile. Every other install skips install scripts through the `NPM_CONFIG_IGNORE_SCRIPTS` that `.mise/config.toml` sets, whereas this task unsets it, so the install runs the script of `@homebridge/node-pty-prebuilt-multiarch`, which fetches the binary the UI's terminal needs on macOS.

Open `http://localhost:8581` once the log shows the UI listening, create the UI's account in the setup wizard it opens on, and add the bridge in the Home app with the setup code the UI shows. Homebridge logs at debug level and keeps the accessories it cached when the plugin throws as it loads, so a load failure leaves the sensors' rooms and automations in the Home app as they were. A build that fails to compile stops the task before Homebridge starts. `mise run plugin:watch` runs the same bridge and restarts it each time a source `plugin:build` declares changes.

## Releasing

The repository holds one draft release for the next version, whose notes fill in as pull requests land. Each push to `main` runs `🔆 Draft`, which also runs by hand from `main` through `workflow_dispatch`, and reads the `version` in `package.json`. Where no release carries that version, the workflow creates the draft with [generated notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes), grouped by the categories in `.github/release.yml`. Where only the draft carries it, the workflow writes the notes GitHub generates now onto the draft, and where a published release already carries it, the run fails with an annotation naming `mise run bump`, so no change lands under a version already released. Each draft records `main` as the place its tag is written, so publishing it tags the commit `main` holds at that moment, and once a release publishes, `mise run bump` moves `version` in `package.json` to the next minor release, or `mise run bump --patch` and `mise run bump --major` to the next patch or major, making no commit or tag. `.github/settings.toml` turns on [immutable releases](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases), so a published release's tag and files never change.

## Opening an Issue

Open a new issue from the Spec template and fill it in as its comments ask.

## Opening a Pull Request

Cut a branch from `main`, push it to the repository or to your fork of it, and open a pull request against `main` from the template, whose first comment gives the title and the fields to copy from the issue the pull request closes. The checks on a pull request from a fork run once a maintainer approves them. The ruleset protecting `main` requires `✨ Reading`, the check that passes only once every other check has passed. The merge squashes the branch into one commit on `main` under the pull request's title.
