/*
 * Copyright 2025 Greg Willis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { TrackedLink, User, Role, ShareType, Permission } from '@prisma/client';
import { LinkService } from '../linkService';
import { logger } from '@/lib/logger';
import { prismaMock } from '../__mocks__/prisma';

// Mock the Prisma client and logger
jest.mock('../__mocks__/prisma');
jest.mock('@/lib/logger', () => ({
  logger: {
    audit: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('LinkService', () => {
  let linkService: LinkService;

  beforeEach(() => {
    linkService = new LinkService();
    (prismaMock as any).trackedLink = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
  });

  describe('createLink', () => {
    it('should create a new tracked link and log the action', async () => {
      const params = {
        fileName: 'test.txt',
        filePath: '/path/to/test.txt',
        shareType: ShareType.SPECIFIC_PEOPLE,
        recipients: [{ recipient: 'user@example.com', permission: Permission.VIEW }],
        ownerId: 'owner-123',
      };

      const expectedLink = {
        id: 'link-123',
        fileId: 'f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da5252043a8a2e',
        linkUrl: 'https://cullenlinks.com/share/random-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...params,
      };

      (prismaMock.trackedLink.create as jest.Mock).mockResolvedValue(expectedLink);

      const result = await linkService.createLink(params);

      expect(prismaMock.trackedLink.create).toHaveBeenCalledWith({
        data: {
          fileId: expect.any(String),
          fileName: params.fileName,
          filePath: params.filePath,
          shareType: params.shareType,
          linkUrl: expect.any(String),
          expiresAt: params.expiresAt,
          owner: {
            connect: {
              id: params.ownerId,
            },
          },
          recipients: {
            create: params.recipients,
          },
        },
      });
      expect(logger.audit).toHaveBeenCalledWith('link.create', params.ownerId, {
        linkId: expectedLink.id,
        fileName: expectedLink.fileName,
        shareType: expectedLink.shareType,
        recipients: expectedLink.recipients,
      });
      expect(result).toEqual(expectedLink);
    });

    it('should throw an error if the database call fails', async () => {
        const params = {
          fileName: 'test.txt',
          filePath: '/path/to/test.txt',
          shareType: ShareType.SPECIFIC_PEOPLE,
          recipients: [{ recipient: 'user@example.com', permission: Permission.VIEW }],
          ownerId: 'owner-123',
        };
        const error = new Error('DB error');
        (prismaMock.trackedLink.create as jest.Mock).mockRejectedValue(error);

        await expect(linkService.createLink(params)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Failed to create tracked link', error, { params });
      });
  });
  describe('getLinkById', () => {
    const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
    const admin: User = { id: 'admin-123', email: 'test@test.com', role: Role.ADMIN, name: 'Test Admin' };
    const link: TrackedLink = {
      id: 'link-123',
      ownerId: 'user-123',
      fileId: 'file-123',
      fileName: 'test.txt',
      filePath: '/path/to/test.txt',
      shareType: ShareType.SPECIFIC_PEOPLE,
      linkUrl: 'https://cullenlinks.com/share/random-id',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return a link if the user is the owner', async () => {
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(link);
      const result = await linkService.getLinkById('link-123', user);
      expect(result).toEqual(link);
    });

    it('should return a link if the user is an admin', async () => {
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(link);
      const result = await linkService.getLinkById('link-123', admin);
      expect(result).toEqual(link);
    });

    it('should return null if the user is not authorized', async () => {
      const unauthorizedUser: User = { id: 'unauthorized-user', email: 'test@test.com', role: Role.USER, name: 'Test User' };
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(link);
      const result = await linkService.getLinkById('link-123', unauthorizedUser);
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return null if the link is not found', async () => {
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await linkService.getLinkById('link-404', user);
      expect(result).toBeNull();
    });

    it('should throw an error if the database call fails', async () => {
      const error = new Error('DB error');
      (prismaMock.trackedLink.findUnique as jest.Mock).mockRejectedValue(error);
      const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };

      await expect(linkService.getLinkById('link-123', user)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to get tracked link', error, { id: 'link-123', userId: user.id });
    });
  });
  describe('getLinks', () => {
    const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
    const admin: User = { id: 'admin-123', email: 'test@test.com', role: Role.ADMIN, name: 'Test Admin' };
    const links: TrackedLink[] = [
      { id: 'link-1', ownerId: 'user-123', fileId: 'file-1', fileName: 'test1.txt', filePath: '/path/to/test1.txt', shareType: ShareType.SPECIFIC_PEOPLE, linkUrl: 'https://cullenlinks.com/share/random-id1', expiresAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'link-2', ownerId: 'user-123', fileId: 'file-2', fileName: 'test2.txt', filePath: '/path/to/test2.txt', shareType: ShareType.ANYONE, linkUrl: 'https://cullenlinks.com/share/random-id2', expiresAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    it('should return all links for an admin', async () => {
      (prismaMock.trackedLink.findMany as jest.Mock).mockResolvedValue(links);
      (prismaMock.trackedLink.count as jest.Mock).mockResolvedValue(links.length);

      const result = await linkService.getLinks(admin);

      expect(result.data).toEqual(links);
      expect(result.total).toBe(links.length);
      expect(prismaMock.trackedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('should return only own links for a regular user', async () => {
      (prismaMock.trackedLink.findMany as jest.Mock).mockResolvedValue(links);
      (prismaMock.trackedLink.count as jest.Mock).mockResolvedValue(links.length);

      const result = await linkService.getLinks(user);

      expect(result.data).toEqual(links);
      expect(result.total).toBe(links.length);
      expect(prismaMock.trackedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: user.id } }));
    });

    it('should handle pagination correctly', async () => {
      (prismaMock.trackedLink.findMany as jest.Mock).mockResolvedValue([links[1]]);
      (prismaMock.trackedLink.count as jest.Mock).mockResolvedValue(links.length);

      const result = await linkService.getLinks(user, { page: 2, limit: 1 });

      expect(result.data).toEqual([links[1]]);
      expect(result.total).toBe(links.length);
      expect(prismaMock.trackedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1, take: 1 }));
    });

    it('should throw an error if the database call fails', async () => {
      const error = new Error('DB error');
      (prismaMock.trackedLink.findMany as jest.Mock).mockRejectedValue(error);
      const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };

      await expect(linkService.getLinks(user)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to get tracked links', error, { userId: user.id, role: user.role, page: 1, limit: 10 });
    });
  });
  describe('updateLink', () => {
    const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
    const link: TrackedLink = {
      id: 'link-123',
      ownerId: 'user-123',
      fileId: 'file-123',
      fileName: 'test.txt',
      filePath: '/path/to/test.txt',
      shareType: ShareType.SPECIFIC_PEOPLE,
      linkUrl: 'https://cullenlinks.com/share/random-id',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updateParams = { shareType: ShareType.ANYONE };

    it('should update a link successfully', async () => {
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(link);
      (prismaMock.trackedLink.update as jest.Mock).mockResolvedValue({ ...link, ...updateParams });

      const result = await linkService.updateLink('link-123', updateParams, user);

      expect(result).toEqual({ ...link, ...updateParams });
      expect(logger.audit).toHaveBeenCalledWith('link.update', user.id, {
        linkId: 'link-123',
        updates: updateParams,
      });
    });

    it('should return null if trying to update a non-existent link', async () => {
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await linkService.updateLink('link-404', updateParams, user);
      expect(result).toBeNull();
    });

    it('should throw an error if the database call fails', async () => {
      const error = new Error('DB error');
      (prismaMock.trackedLink.update as jest.Mock).mockRejectedValue(error);
      const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
      const link: TrackedLink = {
        id: 'link-123',
        ownerId: 'user-123',
        fileId: 'file-123',
        fileName: 'test.txt',
        filePath: '/path/to/test.txt',
        shareType: ShareType.SPECIFIC_PEOPLE,
        linkUrl: 'https://cullenlinks.com/share/random-id',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updateParams = { shareType: ShareType.ANYONE };
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(link);

      await expect(linkService.updateLink('link-123', updateParams, user)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to update tracked link', error, { id: 'link-123', params: updateParams, userId: user.id });
    });
  });
  describe('deleteLink', () => {
    const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
    const link: TrackedLink = {
      id: 'link-123',
      ownerId: 'user-123',
      fileId: 'file-123',
      fileName: 'test.txt',
      filePath: '/path/to/test.txt',
      shareType: ShareType.SPECIFIC_PEOPLE,
      linkUrl: 'https://cullenlinks.com/share/random-id',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should delete a link successfully', async () => {
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(link);
      (prismaMock.trackedLink.delete as jest.Mock).mockResolvedValue(link);

      const result = await linkService.deleteLink('link-123', user);

      expect(result).toBe(true);
      expect(logger.audit).toHaveBeenCalledWith('link.delete', user.id, {
        linkId: 'link-123',
        fileName: link.fileName,
      });
    });

    it('should return false if trying to delete a non-existent link', async () => {
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await linkService.deleteLink('link-404', user);
      expect(result).toBe(false);
    });

    it('should throw an error if the database call fails', async () => {
      const error = new Error('DB error');
      (prismaMock.trackedLink.delete as jest.Mock).mockRejectedValue(error);
      const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
      const link: TrackedLink = {
        id: 'link-123',
        ownerId: 'user-123',
        fileId: 'file-123',
        fileName: 'test.txt',
        filePath: '/path/to/test.txt',
        shareType: ShareType.SPECIFIC_PEOPLE,
        linkUrl: 'https://cullenlinks.com/share/random-id',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prismaMock.trackedLink.findUnique as jest.Mock).mockResolvedValue(link);

      await expect(linkService.deleteLink('link-123', user)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to delete tracked link', error, { id: 'link-123', userId: user.id });
    });
  });
  describe('findExpiringLinks', () => {
    it('should return links that are about to expire', async () => {
      const expiringLinks: TrackedLink[] = [
        { id: 'link-1', ownerId: 'user-123', fileId: 'file-1', fileName: 'test1.txt', filePath: '/path/to/test1.txt', shareType: ShareType.SPECIFIC_PEOPLE, linkUrl: 'https://cullenlinks.com/share/random-id1', expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ];
      (prismaMock.trackedLink.findMany as jest.Mock).mockResolvedValue(expiringLinks);

      const result = await linkService.findExpiringLinks(7);

      expect(result).toEqual(expiringLinks);
      expect(prismaMock.trackedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          expiresAt: {
            not: null,
            gt: expect.any(Date),
            lte: expect.any(Date),
          },
        },
      }));
    });

    it('should throw an error if the database call fails', async () => {
      const error = new Error('DB error');
      (prismaMock.trackedLink.findMany as jest.Mock).mockRejectedValue(error);

      await expect(linkService.findExpiringLinks(7)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to find expiring links', error, { daysThreshold: 7 });
    });
  });

  describe('synchronizeLinks', () => {
    it('should log that the synchronization has started and completed', async () => {
      await linkService.synchronizeLinks();
      expect(logger.info).toHaveBeenCalledWith('Starting link synchronization');
      expect(logger.info).toHaveBeenCalledWith('Link synchronization complete');
    });

    it('should throw an error if the synchronization fails', async () => {
        const error = new Error('Sync error');
        (logger.info as jest.Mock).mockImplementationOnce(() => {
            throw error;
        });

        await expect(linkService.synchronizeLinks()).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Failed to synchronize links', error);
    });
  });
});