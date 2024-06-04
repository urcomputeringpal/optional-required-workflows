import { required } from '../src/required'
import { GitHub } from '@actions/github/lib/utils'
import { Context } from '@actions/github/lib/context'
// eslint-disable-next-line import/no-unresolved
import { WorkflowRunCompletedEvent } from '@octokit/webhooks-types'

describe('required', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          getWorkflowRun: jest.fn().mockImplementation(() => {
            return Promise.resolve({
              data: {
                id: 123,
                name: 'Test Workflow',
                head_sha: 'abc123',
                conclusion: 'success',
                html_url: 'http://example.com'
              }
            }) // Simulating a specific workflow run object
          }),
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          listWorkflowRunsForRepo: jest.fn().mockImplementation(() => {
            return Promise.resolve({
              data: {
                workflow_runs: [
                  { id: 123, name: 'Test Workflow', conclusion: 'success' }
                ]
              }
            }) // Simulating a successful response for listWorkflowRunsForRepo
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
          { id: 123, name: 'Test Workflow', conclusion: 'success' },
          { id: 124, name: 'Another Workflow', conclusion: 'success' }
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

    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'success',
        description:
          'All 2 observed required workflows were successful or skipped'
      })
    )
  })

  it('should handle only one of the required statuses reporting success', async () => {
    // Mock setup to simulate only one of the required statuses reporting success
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { id: 123, name: 'Test Workflow', conclusion: 'success' },
          { id: 124, name: 'Another Workflow', conclusion: null }
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

    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'pending',
        description: expect.stringContaining(
          'required workflows are still pending...'
        )
      })
    )
  })

  it('should handle one of the required statuses reporting failure', async () => {
    // Mock setup to simulate one of the required statuses reporting failure
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { id: 123, name: 'Test Workflow', conclusion: 'success' },
          { id: 124, name: 'Another Workflow', conclusion: 'failure' }
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

    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failure',
        description: expect.stringContaining(
          'required workflows were not successful'
        )
      })
    )
  })

  it('should handle replication lag scenario', async () => {
    // Mock setup to simulate replication lag scenario where "Test workflow" isn't in the results
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { id: 124, name: 'Another Workflow', conclusion: 'success' },
          {
            id: 125,
            name: 'Another Not Required Workflow 2',
            conclusion: 'success'
          }
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

    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'pending',
        description:
          'Waiting for conclusion to be reported for Test Workflow...'
      })
    )
  })

  // New test case to verify behavior for skipped workflows
  it('should treat skipped workflows as successful', async () => {
    // Mock setup to simulate a skipped workflow scenario
    mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          { id: 123, name: 'Test Workflow', conclusion: 'skipped' },
          { id: 124, name: 'Another Workflow', conclusion: 'success' }
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

    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'success',
        description:
          'All 2 observed required workflows were successful or skipped'
      })
    )
  })
})
