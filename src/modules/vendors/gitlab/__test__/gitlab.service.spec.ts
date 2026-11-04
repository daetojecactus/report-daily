import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitLabClient } from '../gitlab.client';
import { GitLabService } from '../gitlab.service';

describe('GitLabService', () => {
  const client = { get: vi.fn() };
  const service = new GitLabService(client as unknown as GitLabClient);

  beforeEach(() => {
    client.get.mockReset();
  });

  it('searches up to ten active users by name or username', async () => {
    const users = [{ id: 1, username: 'anna', name: 'Anna' }];
    client.get.mockResolvedValue(users);

    expect(await service.searchUsers('ann')).toBe(users);
    expect(client.get).toHaveBeenCalledWith('/users', {
      search: 'ann',
      active: true,
      per_page: 10,
    });
  });

  it('returns no users when the search is not found', async () => {
    client.get.mockResolvedValue(null);

    expect(await service.searchUsers('ann')).toEqual([]);
  });

  it('finds a user by id', async () => {
    client.get.mockResolvedValue(null);

    expect(await service.findUser(7)).toBeNull();
    expect(client.get).toHaveBeenCalledWith('/users/7');
  });

  it.each([
    [[{ id: 1 }], true],
    [[], false],
    [null, false],
  ])('reports visible activity for events %j', async (events, visible) => {
    client.get.mockResolvedValue(events);

    expect(await service.hasVisibleActivity(7)).toBe(visible);
    expect(client.get).toHaveBeenCalledWith('/users/7/events', {
      per_page: 1,
    });
  });
});
