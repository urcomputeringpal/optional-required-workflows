# Optional Required workflows

Configure required workflows in your repository. Use path filters. Leave your
GitHub org administrator alone.

Using this action to configuring required workflows in a GitHub Actions workflow
protected by a `CODEOWNERS` file instead of in your repository settings.

## How it works

- A workflow in your repository is created that called this Action
- This workflow contains a list of other workflows that are required to pass
- When any of those workflows complete on a PR, this workflow will check to see
  if ANY of them are present on the same SHA
- If **all** of the matching observed on the same SHA **have passed**, this
  workflow will create a success status
- If **any** of the listed workflows on the same SHA **have failed**, this
  workflow will create a failure status
- If we're still waiting, a pending status will be created that reports what
  we're waiting for
- If none of the listed workflows report a completed status via GitHub's API,
  we'll refresh until we see a status

## Setup

- Add an workflow like the following:

```yaml
name: Required

on:
  workflow_run:
    workflows:
      - Check Transpiled JavaScript
      - Continuous Integration
      - Lint Codebase
    types:
      - completed

permissions:
  contents: read
  actions: read
  statuses: write

jobs:
  success:
    if:
      contains(fromJSON('["merge_group", "pull_request"]'),
      github.event.workflow_run.event)
    name: Create appropriate status
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: read
      statuses: write
    steps:
      - uses: actions/checkout@v3
      - uses: urcomputeringpal/optional-required-workflows@main
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          status-name: Required
          must-succeed-if-run: |
            Check Transpiled JavaScript
            Continuous Integration
            Lint Codebase
```

- Use `CODEOWNERS` to protect the contents of this file on your default branch
- Mark the 'Required' build as required in your repository settings
