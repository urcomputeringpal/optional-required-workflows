import { Context } from '@actions/github/lib/context'
import type { GitHub } from '@actions/github/lib/utils'
import type { WorkflowRunCompletedEvent } from '@octokit/webhooks-types'

type Octokit = InstanceType<typeof GitHub>

export async function required({
  octokit,
  context,
  event,
  workflows,
  statusName
}: {
  octokit: Octokit
  context: Context
  event: WorkflowRunCompletedEvent
  workflows: string[]
  statusName: string
}): Promise<void> {
  console.log(JSON.stringify(event, null, 2))
  const workflow = await octokit.rest.actions.getWorkflowRun({
    ...context.repo,
    run_id: event.workflow_run.id
  })

  // Validate workflow data for undefined before accessing properties
  if (!workflow.data) {
    throw new Error('Workflow data is undefined.')
  }

  const head_sha = workflow.data.head_sha

  console.log(`Processing ${workflow.data.name} ${workflow.data.html_url}`)
  console.log(
    `https://github.com/${context.repo.owner}/${context.repo.repo}/commit/${workflow.data.head_sha}/checks`
  )

  let observedCurrent = false
  let allRequiredSucceeded = false

  while (observedCurrent === false) {
    const workflowRuns = await octokit.rest.actions.listWorkflowRunsForRepo({
      ...context.repo,
      head_sha,
      // reasonable defaults
      per_page: 100
    })

    // Validate workflowRuns data for undefined before accessing properties
    if (!workflowRuns.data || !workflowRuns.data.workflow_runs) {
      throw new Error('Workflow runs data is undefined.')
    }

    const selectedWorkflows = workflowRuns.data.workflow_runs.filter(
      w => w.name !== undefined && w.name !== null && workflows.includes(w.name)
    )
    const successfullWorkflows = selectedWorkflows.filter(
      w => w.conclusion === 'success'
    )
    const unSuccessfulWorkflows = selectedWorkflows.filter(
      w => w.conclusion !== 'success' && w.conclusion !== null
    )
    const pendingWorkflows = selectedWorkflows.filter(
      w => w.conclusion === null
    )

    console.log(`Expected workflows: ${workflows.join(', ')}`)
    console.log(
      `Found: ${selectedWorkflows.length}, successful: ${successfullWorkflows.length}, unsuccessful: ${unSuccessfulWorkflows.length}, pending: ${pendingWorkflows.length}`
    )

    observedCurrent =
      pendingWorkflows.filter(w => w.id === event.workflow_run.id).length === 0

    // Report failure immediately
    if (unSuccessfulWorkflows.length > 0) {
      await octokit.rest.repos.createCommitStatus({
        ...context.repo,
        sha: head_sha,
        state: 'failure',
        context: statusName,
        description: `${unSuccessfulWorkflows.length} of ${selectedWorkflows.length} required workflows were not successful.`,
        target_url: unSuccessfulWorkflows[0].html_url
      })
      return
    }

    if (!observedCurrent) {
      await octokit.rest.repos.createCommitStatus({
        ...context.repo,
        sha: head_sha,
        state: 'pending',
        context: statusName,
        description: `Waiting for conclusion to be reported for ${event.workflow_run.name}...`,
        target_url: event.workflow_run.html_url
      })
      // throw a warning or something
      // sleep for a few seconds
      continue
    }

    if (pendingWorkflows.length > 0) {
      await octokit.rest.repos.createCommitStatus({
        ...context.repo,
        sha: head_sha,
        state: 'pending',
        context: statusName,
        description: `${pendingWorkflows.length} of ${selectedWorkflows.length} required workflows are still pending...`,
        target_url: pendingWorkflows[0].html_url
      })
      return
    }

    allRequiredSucceeded =
      unSuccessfulWorkflows.length === 0 && pendingWorkflows.length === 0
  }

  // report success if all required workflows we observed had a successful status
  if (allRequiredSucceeded) {
    console.log(`Reporting success on ${head_sha}`)
    await octokit.rest.repos.createCommitStatus({
      ...context.repo,
      sha: head_sha,
      state: 'success',
      context: statusName,
      description: 'All required workflows have succeeded.'
    })
  }
}

