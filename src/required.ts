import { Context } from '@actions/github/lib/context'
import type { GitHub } from '@actions/github/lib/utils'
import type { WorkflowRunCompletedEvent } from '@octokit/webhooks-types'

type Octokit = InstanceType<typeof GitHub>

export async function required({
  octokit,
  context,
  event,
  workflows,
  statusName,
  retries = 2,
  delay = 100
}: {
  octokit: Octokit
  context: Context
  event: WorkflowRunCompletedEvent
  workflows: string[]
  statusName: string
  retries?: number
  delay?: number
}): Promise<void> {
  // console.log(JSON.stringify(event, null, 2))
  const workflow = await octokit.rest.actions.getWorkflowRun({
    ...context.repo,
    run_id: event.workflow_run.id
  })

  // Validate workflow data for undefined before accessing properties
  if (!workflow.data) {
    throw new Error('Workflow data is undefined.')
  }

  const head_sha = workflow.data.head_sha

  console.log(
    `Processing completion event for ${workflow.data.name} (WorkflowRun#${workflow.data.id})`
  )
  const checksUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/commit/${workflow.data.head_sha}/checks`

  let observedWorkflowRunFromEvent = false
  let reportedRetry = false

  let retryCount = 0
  while (observedWorkflowRunFromEvent === false) {
    retryCount += 1
    if (retryCount > retries) {
      console.log(`Exceeded ${retries}, giving up.`)
      return
    }

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

    const matchingWorkflows = workflowRuns.data.workflow_runs.filter(
      w => w.name !== undefined && w.name !== null && workflows.includes(w.name)
    )
    const successfullWorkflows = matchingWorkflows.filter(
      w => w.conclusion === 'success'
    )
    const unSuccessfulWorkflows = matchingWorkflows.filter(
      w => w.conclusion !== 'success' && w.conclusion !== null
    )
    const pendingWorkflows = matchingWorkflows.filter(
      w => w.conclusion === null
    )

    observedWorkflowRunFromEvent =
      matchingWorkflows.filter(w => w.id === event.workflow_run.id).length > 0
    console.log(
      `WorkflowRuns ID ${event.workflow_run.id} ${observedWorkflowRunFromEvent ? 'found' : 'not found'} in WorkflowRuns returned from API: ${matchingWorkflows.map(w => w.id).join(', ')}`
    )

    console.log(`Expected workflows: ${workflows.join(', ')}`)
    console.log(
      `Found ${matchingWorkflows.length} total, ${successfullWorkflows.length} successful, ${unSuccessfulWorkflows.length} unsuccessful, ${pendingWorkflows.length} pending`
    )

    // Report failure immediately
    if (unSuccessfulWorkflows.length > 0) {
      await octokit.rest.repos.createCommitStatus({
        ...context.repo,
        sha: head_sha,
        state: 'failure',
        context: statusName,
        description: `${unSuccessfulWorkflows.length} of ${matchingWorkflows.length} required workflows were not successful`,
        target_url: unSuccessfulWorkflows[0].html_url
      })
      return
    }

    if (!observedWorkflowRunFromEvent) {
      if (!reportedRetry) {
        await octokit.rest.repos.createCommitStatus({
          ...context.repo,
          sha: head_sha,
          state: 'pending',
          context: statusName,
          description: `Waiting for conclusion to be reported for ${event.workflow_run.name}...`,
          target_url: event.workflow_run.html_url
        })
        reportedRetry = true
      }
      console.log(`Waiting for ${delay}ms before retrying...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      // throw a warning or something
      continue
    }

    if (pendingWorkflows.length > 0) {
      await octokit.rest.repos.createCommitStatus({
        ...context.repo,
        sha: head_sha,
        state: 'pending',
        context: statusName,
        description: `${pendingWorkflows.length} of ${matchingWorkflows.length} required workflows are still pending...`,
        target_url: pendingWorkflows[0].html_url
      })
      return
    }

    // report success if all required workflows we observed had a successful status
    if (
      observedWorkflowRunFromEvent &&
      successfullWorkflows.length > 0 &&
      unSuccessfulWorkflows.length === 0 &&
      pendingWorkflows.length === 0
    ) {
      console.log(`Reporting success on ${head_sha}`)
      await octokit.rest.repos.createCommitStatus({
        ...context.repo,
        sha: head_sha,
        state: 'success',
        context: statusName,
        description: `All ${successfullWorkflows.length} observed required workflows have succeeded`,
        target_url: checksUrl
      })
      return
    }
    const eventJson = JSON.stringify(event, null, 2)
    const workflowRunsJson = JSON.stringify(workflowRuns, null, 2)
    throw new Error(
      `Unhandled state
      event: ${eventJson}
      workflowRuns: ${workflowRunsJson}
      observedWorkflowRunFromEvent: ${observedWorkflowRunFromEvent}
      matchingWorkflows: ${matchingWorkflows.length}
      successfullWorkflows: ${successfullWorkflows.length}
      unSuccessfulWorkflows: ${unSuccessfulWorkflows.length}
      pendingWorkflows: ${pendingWorkflows.length}
      `
    )
  }
}
