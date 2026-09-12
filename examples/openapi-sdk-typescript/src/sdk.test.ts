import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewTaskDto, TaskDto } from './generated/tasks/typescript/index.js';
import { TasksSdk } from './sdk.js';

const task: TaskDto = {
  id: 'a5e5e159-0000-4000-8000-000000000001',
  title: 'Write the SDK example',
  done: false,
  project: { id: 'a5e5e159-0000-4000-8000-000000000002', name: 'kurotako' },
  labels: {},
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TasksSdk', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let sdk: TasksSdk;

  beforeEach(() => {
    fetchMock = vi.fn();
    sdk = new TasksSdk({
      baseUrl: 'https://api.example.test',
      fetch: fetchMock as unknown as typeof fetch,
    });
  });

  it('lists tasks with a GET request', async () => {
    fetchMock.mockResolvedValue(jsonResponse([task]));

    const tasks = await sdk.listTasks();

    expect(tasks).toEqual([task]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/tasks',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('gets one task by id', async () => {
    fetchMock.mockResolvedValue(jsonResponse(task));

    const found = await sdk.getTask(task.id);

    expect(found).toEqual(task);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/tasks/${task.id}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('creates a task with a POST request carrying a JSON body', async () => {
    const input: NewTaskDto = { title: 'New task', projectId: task.project.id };
    fetchMock.mockResolvedValue(jsonResponse(task, 201));

    const created = await sdk.createTask(input);

    expect(created).toEqual(task);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/tasks',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    );
  });

  it('throws when the response is not ok', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'not found' }, 404));

    await expect(sdk.getTask('missing')).rejects.toThrow(
      'GET /tasks/missing failed with status 404',
    );
  });
});
