# Required workflows

Configure required workflows in your repository. Use path filters. Leave your
GitHub org administrator alone.

## Usage

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

jobs:
  success:
    if:
      contains(fromJSON('["merge_group", "pull_request"]'),
      github.event.workflow_run.event)
    name: Create appropriate status
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: urcomputeringpal/required-workflows@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          status-name: Required
          must-succeed-if-run: |
            Check Transpiled JavaScript
            Continuous Integration
            Lint Codebase
```

- Use `CODEOWNERS` to protect the contents of this file on your default branch
