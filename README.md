<!-- nnw-theme-identity:start -->
# NetNewsWire Theme Template

A complete, self-guided workspace for creating and publishing a NetNewsWire theme.
<!-- nnw-theme-identity:end -->

The starter gives you:

- guided setup that creates and personalizes the theme;
- a local preview gallery that publishes to GitHub Pages; and
- automatic validation, packaging, and release builds with GitHub Actions.

[`dave-atx/netnewswire-theme-template`](https://github.com/dave-atx/netnewswire-theme-template)
is a GitHub template: make one repository from it for each theme
([below](#create-your-theme-repository)), and do your work in that copy.

A theme repository holds only the theme. The tooling is the
[`nnw-theme`](https://github.com/dave-atx/nnw-theme) npm package, which you run with
`npx nnw-theme@2`; nothing is installed into the repository, and fixes to the tooling
reach your theme without a commit there. You can drive it through a coding agent or
use the same commands yourself. No Xcode or NetNewsWire source checkout is required.

It is an independent community project and is not affiliated with or endorsed by
NetNewsWire. The theme file format is documented in NetNewsWire’s official
[Themes technote](https://github.com/Ranchero-Software/NetNewsWire/blob/main/Technotes/Themes.md).

## Create your theme repository

The [original repository](https://github.com/dave-atx/netnewswire-theme-template)
is a GitHub template, not a theme to install as-is. On its GitHub page, choose
**Use this template → Create a new repository**. Give your new repository a name,
then work in that repository. If you are reading this in a repository already
created from the template, skip this step.

With the [GitHub CLI](https://cli.github.com/), one command creates the repository
and clones it (replace `YOUR-THEME` with the name you want):

```sh
gh repo create YOUR-THEME --template dave-atx/netnewswire-theme-template --public --clone
cd YOUR-THEME
```

The marketplace lists only public repositories; use `--private` if you don't want
the theme listed.

Do not use **Fork** or simply clone the original template as your theme repository:
the marketplace skips forks, and a clone still points at the template repository.
Initialization warns if it detects a fork. You can choose whether your new repository
is listed in the marketplace during setup.

## Start with an agent

Give your agent this one prompt, whether you are in your own repository or starting
from the template's GitHub page:

> Help me make a NetNewsWire theme with `dave-atx/netnewswire-theme-template`.
> Guide me through setup and design. I want [describe the look or reading experience].

The agent will ask you to approve the theme’s permanent identifier. It should also
ask again before creating a GitHub release or making another external change.

## Start without an agent

The whole path, in order. Steps 1–3 happen once; step 4 is where you spend your time.

**1. Install the tools.** On macOS:

```sh
brew install node gh
gh auth login
```

Node.js 24 or later is required. `gh`, the GitHub CLI, is optional but recommended:
it creates your repository in one step, and `init` uses it to fill in GitHub
defaults, warn about forks, and join the marketplace. Without it, join by adding the
`netnewswire-theme` topic in your repository's GitHub settings. On Linux, install the
same tools with their documented instructions.

**2. Get your own copy.** Create and clone your repository:

```sh
gh repo create YOUR-THEME --template dave-atx/netnewswire-theme-template --public --clone
cd YOUR-THEME
```

Or create it on GitHub (above) and clone **your** repository (replace
`YOUR-NAME/YOUR-THEME` with its GitHub path):

```sh
git clone https://github.com/YOUR-NAME/YOUR-THEME.git
cd YOUR-THEME
```

**3. Initialize, then commit.** `init` asks for the theme name, your name and home
page, and the theme's permanent identifier. It also offers to join the marketplace
and to install WebKit; say yes to both unless you have a reason not to.

```sh
npx nnw-theme@2 init
git add -A && git commit -m "Initialize theme"
```

Run `init` only while `.nnw-theme-uninitialized` exists. If WebKit setup failed or you
skipped it, run `npx nnw-theme@2 setup` before step 5.

**4. Design.** Start the live preview and edit the files in your `.nnwtheme` folder,
mostly `stylesheet.css`. The gallery rebuilds each time you save; refresh the browser
to see it. Stop with Ctrl-C.

```sh
npx nnw-theme@2 preview
```

**5. Check.** When it looks right, run the release gate. It tests every case in WebKit,
reports progress, and offers to open the results; fix any failures and run it again.

```sh
npx nnw-theme@2 check
```

**6. Choose the marketplace image.** This captures the Mac light article and saves it
as `screenshots/theme-preview.png`, the picture on your marketplace card.

```sh
npx nnw-theme@2 screenshot --promote
```

**7. Commit and push.**

```sh
git add -A && git commit -m "Design my theme"
git push
```

GitHub runs the same check on every push. The first time, enable **Settings → Pages →
Build and deployment → Source → GitHub Actions** so your gallery is published too.

**8. Publish.** Follow [Publish](#publish) below: bump the version, then run the
Publish workflow on GitHub. Repeat steps 4–8 for later versions.

The first `npx nnw-theme@2` downloads the package into npm's cache; later runs reuse
it and pick up new 2.x releases automatically. The NetNewsWire rendering files the
previews use ship inside the package, pinned and verified by hash.

### Shorter commands

`completion` prints shell completion for commands, options, and your fixture names.
It also defines an `nnw-theme` command that runs `npx --yes nnw-theme@2`, so you can
type `nnw-theme check`:

```sh
# fish
npx nnw-theme@2 completion fish > ~/.config/fish/conf.d/nnw-theme.fish
# zsh (~/.zshrc, after compinit)
source <(npx --yes nnw-theme@2 completion zsh)
# bash (~/.bashrc)
source <(npx --yes nnw-theme@2 completion bash)
```

## Theme Marketplace

The normal setup recommends inclusion in the
[NetNewsWire Theme Marketplace](https://dave-atx.github.io/nnw-theme-marketplace/).
Accepting the default marketplace prompt adds the `netnewswire-theme` GitHub topic.
Once the repository is public and its first stable release is published by the
included workflow, the marketplace can discover it automatically—there is no listing
form or curated pull request.

Marketplace participation is optional. To opt out, answer **No** during initialization
or pass `--marketplace no` when an agent runs it. If the topic was already added,
remove `netnewswire-theme` in the repository’s GitHub settings. You may still preview,
package, and publish the theme normally; it simply will not be discovered through the
marketplace topic.

## What is in the repository

The theme itself is the only `*.nnwtheme` directory at the repository root:

- `stylesheet.css` contains the visual design and clearly named variables.
- `template.html` contains the article structure and NetNewsWire macros.
- `Info.plist` contains the public identity and integer version.

Alongside it are `screenshots/theme-preview.png`, the optional `fixtures/`, and a few
small files that connect the repository to the tooling: `AGENTS.md`, the agent skill
in `.agents/skills/`, and four workflows in `.github/workflows/` that call
`nnw-theme`'s reusable workflows. Each of those files starts with an
`nnw-theme-stub` marker; `check` warns when a newer version is available here.

Run the release gate before sharing a theme:

```sh
npx nnw-theme@2 check
```

This validates and packages the exact theme, then checks 16 WebKit renders: two
articles across macOS, iPhone, iPad, light and dark appearances, plus large-text and
Article-JavaScript-off cases. Each fixture you add is checked on macOS and iPhone in
both appearances as well. Every footnote marker must open NetNewsWire's popover with
its note, stay legible, and match the others. External requests are blocked. Results
are written to `build/preview/`, a gallery grouped by scenario that marks each case
passed or failed and lists failures first; the release ZIP is written to
`build/release/`. In a terminal, `check` shows its progress and offers to open the
gallery when it finishes.

After a successful default-branch check, the Pages workflow publishes the same
sandboxed gallery. Pull requests and failed checks retain it as a downloadable
diagnostic artifact; Pages is the normal hosted preview.

For each new repository, enable the included workflow once under **Settings → Pages →
Build and deployment → Source → GitHub Actions**. If Pages already publishes a site of
yours from a branch, the workflow leaves it alone and keeps the gallery as an artifact.

## Fixtures

Fixtures are the articles every preview and check renders: TOML files whose keys are
the template macros (`title`, `byline`, `feed_link_title`, `body`, and so on). Two
built-in fixtures, `article` and `kitchen-sink`, come with the tool. Add your own in
`fixtures/` for the content your theme has to handle, and preview one with
`npx nnw-theme@2 render NAME`. A file named `fixtures/article.toml` or
`fixtures/kitchen-sink.toml` replaces the built-in one.

The best fixtures are real articles. `npx nnw-theme@2 capture` explains how to save
the one selected in a NetNewsWire debug build, exactly as the app would render it.
Previews never touch the network, so images that would load from the web appear as
same-size placeholders.

A fixture can also say what its footnotes must do. `check` then verifies each marker
by its text, that the listed links are left as ordinary links, and, with
`keep_with_word`, that no marker wraps onto a new line apart from its word:

```toml
[expect.footnotes]
plain_links = ["#not-a-footnote"]
keep_with_word = true

[expect.footnotes.notes]
"1" = "The first note's text."
"2" = "The second note's text."
```

Put these tables after the fixture's other keys, including `body`. See
`npx nnw-theme@2 guide fixtures` for every key.

Generated gallery screenshots stay ignored under `build/`. Keep the deliberately
chosen `screenshots/theme-preview.png` in source control: the marketplace uses it for
the theme card. Initialization removes the template’s neutral image; create your own
with `npx nnw-theme@2 screenshot --promote`. The screenshot workflow can open a pull
request when it changes; for that, turn on **Settings → Actions → General → Workflow
permissions → Allow GitHub Actions to create and approve pull requests**.

## Publish

1. Run `npx nnw-theme@2 bump` and commit the changed `Info.plist`.
2. In GitHub, choose **Actions → Publish theme → Run workflow**.
3. Enter a tag beginning with `v` (for example, `v1.0.0`) and optional notes.

If you leave the notes empty and the repository has a
[git-cliff](https://git-cliff.org) configuration at `.github/cliff.toml`, the notes
are generated from the commits since the previous tag.

The workflow releases only the current default-branch commit and refuses a reused
tag, a non-increasing plist version, or changes to the identifier or bundle filename.
Marketplace metadata remains advisory: private repositories and repositories without
the topic can still publish valid themes. See `npx nnw-theme@2 guide publishing`.

## Useful commands

```text
npx nnw-theme@2 init                  Personalize a fresh copy of the template (once)
npx nnw-theme@2 setup                 Install the WebKit browser for checks
npx nnw-theme@2 preview [--no-open]   Live gallery for editing; rebuilds on save
npx nnw-theme@2 render [fixture ...]  Write the gallery once, without checks
npx nnw-theme@2 check [--no-open]     Release gate: package and test every case
npx nnw-theme@2 screenshot --promote  Check one case and make it the marketplace image
npx nnw-theme@2 capture               Explain how to capture a real article as a fixture
npx nnw-theme@2 package               Validate and build the release ZIP only
npx nnw-theme@2 bump [--yes]          Increase the integer theme version
npx nnw-theme@2 marketplace enable    Add the GitHub discovery topic
npx nnw-theme@2 guide [topic]         Read the authoring guide
```

For agent-oriented constraints, read [AGENTS.md](AGENTS.md). Report tooling problems
at [dave-atx/nnw-theme](https://github.com/dave-atx/nnw-theme/issues).

The template's files and documentation are Apache-2.0 licensed. The starter theme is
0BSD licensed, so authors may replace its identity and license without inheriting a
notice burden.
