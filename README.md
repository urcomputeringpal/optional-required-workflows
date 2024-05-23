# Required workflows

Configure required workflows in your repository. Use path filters. Be free.

## Usage

```
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
    if: contains(fromJSON('["merge_group", "pull_request"]'), github.event.workflow_run.event)
    name: Create appropriate status
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: ./
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          status-name: Required
          must-succeed-if-run: |
            Check Transpiled JavaScript
            Continuous Integration
            Lint Codebase
```
