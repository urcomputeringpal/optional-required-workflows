import * as core from '@actions/core'
import * as github from '@actions/github'
import { required } from './required'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const workflows: string[] = core.getMultilineInput('must-succeed-if-run', {
      required: true
    })
    const statusName = core.getInput('status-name', { required: true })
    const token = core.getInput('token', { required: true })
    const octokit = github.getOctokit(token)
    const { context } = github
    if (
      context.eventName !== 'workflow_run' &&
      context.payload.action !== 'completed'
    ) {
      throw new Error(
        'This action can only be triggered by the workflow_run.completed event'
      )
    }
    await required({
      octokit,
      context,
      event: context.payload.workflow_run,
      workflows,
      statusName
    })
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
