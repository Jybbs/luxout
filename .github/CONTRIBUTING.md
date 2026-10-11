# Contributing

This guide takes a contributor on macOS or Linux from a fresh clone of *Luxout* through its checks to an issue and a pull request, each opened from its template. [mise](https://mise.jdx.dev) installs each tool the repository pins, and Bun installs the packages `bun.lock` records.

## A Fresh Clone

Install mise and activate it in your shell, following its [getting-started guide](https://mise.jdx.dev/getting-started.html#activate-mise), and then run the block below from the directory that will hold the clone:

```sh
git clone https://github.com/Jybbs/luxout.git
mise trust luxout
mise -C luxout install
cd luxout
bun install --frozen-lockfile
mise doctor project
```

As soon as `cd` runs, mise puts the `.mise/bin` wrappers on the path beside the releases `.mise/config.toml` pins, even when the block is pasted whole. The `bun` on the next line is therefore the pinned release, and once it has filled `node_modules/`, each program a task runs from the package's dependencies (*`tsc` and `vitest` among them*) runs by name through its wrapper. `mise doctor project` then runs the readiness checks `.mise/conf.d/doctor.toml` declares, reporting each that fails beside the command that fixes it.

## Checking a Change

`mise ci` runs `mise doctor project` and then every check a pull request runs in CI, on the release of Node `.mise/config.toml` pins. CI runs the plugin's suite again on the oldest releases of Node 22 and 24 that `engines` in `package.json` admits, and `mise run plugin:test:22` and `mise run plugin:test:24` run those suites locally once `mise install --include-task-tools` has installed both releases. After an edit to any `package.json` or to `.mise/config.toml`, run `mise relock` to re-resolve each lockfile against its manifest, since `mise ci` fails on a lockfile that no longer matches its manifest. `mise tasks` lists every task with its description.

## Opening an Issue

Open a new issue from the Spec template and fill it in as its comments ask.

## Opening a Pull Request

Cut a branch from `main`, push it to the repository or to your fork of it, and open a pull request against `main` from the template, whose first comment gives the title and the fields to copy from the issue the pull request closes. The checks on a pull request from a fork run once a maintainer approves them. The ruleset protecting `main` requires `✨ Reading`, the check that passes only once every other check has passed. The merge squashes the branch into one commit on `main` under the pull request's title.
