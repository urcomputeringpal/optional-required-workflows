import { required } from '../src/required'
import { GitHub } from '@actions/github/lib/utils'
import { Context } from '@actions/github/lib/context'
import { WorkflowRunCompletedEvent } from '@octokit/webhooks-types'

describe('required', () => {
  let mockOctokit: any
  let context: Context
  let event: WorkflowRunCompletedEvent

  beforeEach(() => {
    process.env.GITHUB_REPOSITORY = 'owner/repo' // Setting GITHUB_REPOSITORY environment variable
    mockOctokit = {
      rest: {
        repos: {
          createCommitStatus: jest.fn()
        },
        actions: {
          getWorkflowRun: jest.fn(),
          listWorkflowRunsForRepo: jest.fn().mockImplementation(() => {
            return Promise.resolve({ data: undefined }) // Simulating undefined data scenario
          })
        }
      }
    }
    context = new Context()
    event = {
      workflow_run: {
        id: 123,
        name: 'Test Workflow',
        head_sha: 'abc123',
        conclusion: 'success',
        html_url: 'http://example.com'
      }
    } as unknown as WorkflowRunCompletedEvent
  })

  it('should handle all required statuses completing successfully', async () => {
    // Mock setup to simulate all required statuses completing successfully
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { name: 'Test Workflow', conclusion: 'success' },
          { name: 'Another Workflow', conclusion: 'success' }
        ]
      }
    })

    await required({
      octokit: mockOctokit as unknown as InstanceType<typeof GitHub>,
      context,
      event,
      workflows: ['Test Workflow', 'Another Workflow'],
      statusName: 'Required'
    })

    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(expect.objectContaining({
      state: 'success',
      description: 'All required workflows have succeeded.'
    }))
  })

  it('should handle only one of the required statuses reporting success', async () => {
    // Mock setup to simulate only one of the required statuses reporting success
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { name: 'Test Workflow', conclusion: 'success' },
          { name: 'Another Workflow', conclusion: null }
        ]
      }
    })

    await required({
      octokit: mockOctokit as unknown as InstanceType<typeof GitHub>,
      context,
      event,
      workflows: ['Test Workflow', 'Another Workflow'],
      statusName: 'Required'
    })

    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(expect.objectContaining({
      state: 'pending',
      description: expect.stringContaining('required workflows are still pending...')
    }))
  })

  it('should handle one of the required statuses reporting failure', async () => {
    // Mock setup to simulate one of the required statuses reporting failure
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { name: 'Test Workflow', conclusion: 'success' },
          { name: 'Another Workflow', conclusion: 'failure' }
        ]
      }
    })

    await required({
      octokit: mockOctokit as unknown as InstanceType<typeof GitHub>,
      context,
      event,
      workflows: ['Test Workflow', 'Another Workflow'],
      statusName: 'Required'
    })

    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(expect.objectContaining({
      state: 'failure',
      description: expect.stringContaining('required workflows were not successful.')
    }))
  })

  it('should handle replication lag scenario', async () => {
    // Mock setup to simulate replication lag scenario
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { name: 'Test Workflow', conclusion: null },
          { name: 'Another Workflow', conclusion: 'success' }
        ]
      }
    })

    await required({
      octokit: mockOctokit as unknown as InstanceType<typeof GitHub>,
      context,
      event,
      workflows: ['Test Workflow', 'Another Workflow'],
      statusName: 'Required'
    })

    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(expect.objectContaining({
      state: 'pending',
      description: expect.stringContaining('Waiting for conclusion to be reported for Test Workflow...')
    }))
  })
})
