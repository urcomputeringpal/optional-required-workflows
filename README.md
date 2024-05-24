# Optional required workflows

Configure required workflows in your repository. Use path filters. Leave your
GitHub org administrator alone.

Use this Action to configure required workflows in a workflow file protected
by `CODEOWNERS` in your repository instead of in your repository settings.

[![Lint](https://github.com/urcomputeringpal/optional-required-workflows/actions/workflows/linter.yml/badge.svg)](https://github.com/urcomputeringpal/optional-required-workflows/actions/workflows/linter.yml?query=branch%3Amain)
[![CI](https://github.com/urcomputeringpal/optional-required-workflows/actions/workflows/ci.yml/badge.svg)](https://github.com/urcomputeringpal/optional-required-workflows/actions/workflows/ci.yml?query=branch%3Amain)
[![Bundling](https://github.com/urcomputeringpal/optional-required-workflows/actions/workflows/check-dist.yml/badge.svg)](https://github.com/urcomputeringpal/optional-required-workflows/actions/workflows/check-dist.yml?query=branch%3Amain)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

## Problem(s)

### Required status checks are challenging to manage without overly broad permissions

GitHub's
[required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)
are configured via branch protection rules. People with **admin permissions** or
a _custom role_ with the "edit repository rules" permission to a repository can
[manage branch protection rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).
Only organizations that use GitHub Enterprise Cloud can
[create custom repository roles](https://docs.github.com/en/enterprise-cloud@latest/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/managing-custom-repository-roles-for-an-organization).

### Changes to required status checks are not tracked in the repository

Changes to required status checks are not tracked in the repository. This makes
it hard to coordinate, document, and review changes to required status checks.
And because of the above permissions challenges, it's sometimes someone else's
job to change this setting. As a result, it can sometimes be hard to know when
the change will take place.

### Required status checks are incompatible with path filters

Required status checks are also
[incompatible with several other Actions features](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks#handling-skipped-but-required-checks):

> If a workflow is skipped due to path filtering, branch filtering or a commit
> message, then checks associated with that workflow will remain in a "Pending"
> state. A pull request that requires those checks to be successful will be
> blocked from merging.

## Solution

This Action lets you define a list of workflows that are required to pass on a
pull request **if they are observed to have started once the first one
completes**. It will check to see if those workflows have passed on the same
SHA. If they have, it will create a successful status. If they haven't, it will
create a failing status.

## How it works

- A workflow in your repository is created that calls this Action
- This workflow contains a list of other workflows that are required to pass
- When **at least one** of those workflows **complete** on a PR, this workflow
  will check to see if **any other listed workflows** are present on the same
  SHA
- If **any** of the matching workflows on the same SHA **have failed**, this
  workflow will create a failure status
- If **all** of the matching workflows on the same SHA **have passed**, this
  workflow will create a successful status
- If **some** of the matching workflows on the same SHA **are missing**, this
  workflow **will still create a successful status** if at least one has passed
  - This allows you to use path filters to skip certain workflows on certain
    paths and still mark them as required.
- If we're still waiting, a pending status will be created that reports what
  we're waiting for
- If none of the listed workflows report a completed status via GitHub's API,
  we'll refresh until we see a status

## Setup

### Workflow

Add an workflow like the following to your repository:

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
    name: Check required workflow status
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

### `CODEOWNERS`

Add this file to `CODEOWNERS` to protect the contents of this file on your
default branch:

```plaintext
.github/workflows/required.yml @your-org/your-repo-admins
```

### Required workflows

Have a GitHub organization admin or someone with the the "edit repository rules"
permission on your repository require the `Required` status in your
[branch protection rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

Offer to your GitHub organization admin to be listed on the `CODEOWNERS` line,
either;

- As the only entry (retains previous behavior, except they just have to
  approve)
- As an additional entry (either they or you can approve)
- Or not at all (they delegate the review/approval of required status on this
  repository checks to your team)

## Caveats / Possible future enhancements

- Many workflows can generate statuses of the same name. In the future, optional
  support for matching on `event.workflow_run.path` may be desirable.
