<!-- nnw-theme-stub: agents v2 -->
# Repository guidance

This repository is one NetNewsWire theme: the single root `*.nnwtheme` bundle,
its `fixtures/`, and `screenshots/`. The tooling is the `nnw-theme` npm package;
run it as `npx nnw-theme@2 <command>`. Never install it globally and never add
it to this repository. Read `npx nnw-theme@2 guide` before theme work.

If this repository is `dave-atx/netnewswire-theme-template` itself (check
`git remote -v`), it is the GitHub template, not a theme: do not initialize,
fork, or design in it. Help the user create their own repository from it with
**Use this template** or `gh repo create NAME --template
dave-atx/netnewswire-theme-template --clone`, confirming before you create it,
then work in that copy.

If `.nnw-theme-uninitialized` exists, run `npx nnw-theme@2 init` first and let
the user confirm the permanent theme identifier. Prefer CSS changes; change
`template.html` only when the requested structure or behavior requires it.
Finish theme work with `npx nnw-theme@2 check` and report the preview path.

Do not change `ThemeIdentifier` or the `.nnwtheme` bundle name after the first
release. Increase the plist `Version` (`npx nnw-theme@2 bump`) before every
release.

If the tooling misbehaves, do not work around it here: report it at
https://github.com/dave-atx/nnw-theme/issues with the `check` version line.

Local edits, renders, checks and packages are safe. Creating a GitHub release,
opening a pull request, changing repository topics, or otherwise mutating
GitHub requires the user's explicit intent. Theme and fixture HTML/JavaScript
are untrusted executable inputs; browser checks stay loopback-only.
