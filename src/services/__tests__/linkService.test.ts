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

import { SharedLink, User, Role, ShareScope } from '@prisma/client';
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
  },
}));

describe('LinkService', () => {
  let linkService: LinkService;

  beforeEach(() => {
    linkService = new LinkService();
    (prismaMock as any).sharedLink = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
  });

  describe('createLink', () => {
    it('should create a new shared link and log the action', async () => {
      const params = {
        fileId: 'file-123',
        fileName: 'test.txt',
        filePath: '/path/to/test.txt',
        sharedWith: 'user@example.com',
        scope: ShareScope.USER,
        ownerId: 'owner-123',
      };

      const expectedLink = {
        id: 'link-123',
        linkUrl: 'https://cullenlinks.com/share/random-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...params,
      };

      prismaMock.sharedLink.create.mockResolvedValue(expectedLink as any);

      const result = await linkService.createLink(params);

      expect(prismaMock.sharedLink.create).toHaveBeenCalledWith({
        data: {
          fileId: params.fileId,
          fileName: params.fileName,
          filePath: params.filePath,
          sharedWith: params.sharedWith,
          scope: params.scope,
          linkUrl: expect.any(String),
          expiresAt: params.expiresAt,
          owner: {
            connect: {
              id: params.ownerId,
            },
          },
        },
      });
      expect(logger.audit).toHaveBeenCalledWith('link.create', params.ownerId, {
        linkId: expectedLink.id,
        fileName: expectedLink.fileName,
        sharedWith: expectedLink.sharedWith,
        scope: expectedLink.scope,
      });
      expect(result).toEqual(expectedLink);
    });
  });
  describe('getLinkById', () => {
    const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
    const admin: User = { id: 'admin-123', email: 'test@test.com', role: Role.ADMIN, name: 'Test Admin' };
    const link: SharedLink = {
      id: 'link-123',
      ownerId: 'user-123',
      fileId: 'file-123',
      fileName: 'test.txt',
      filePath: '/path/to/test.txt',
      sharedWith: 'user@example.com',
      scope: ShareScope.USER,
      linkUrl: 'https://cullenlinks.com/share/random-id',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return a link if the user is the owner', async () => {
      prismaMock.sharedLink.findUnique.mockResolvedValue(link);
      const result = await linkService.getLinkById('link-123', user);
      expect(result).toEqual(link);
    });

    it('should return a link if the user is an admin', async () => {
      prismaMock.sharedLink.findUnique.mockResolvedValue(link);
      const result = await linkService.getLinkById('link-123', admin);
      expect(result).toEqual(link);
    });

    it('should return null if the user is not authorized', async () => {
      const unauthorizedUser: User = { id: 'unauthorized-user', email: 'test@test.com', role: Role.USER, name: 'Test User' };
      prismaMock.sharedLink.findUnique.mockResolvedValue(link);
      const result = await linkService.getLinkById('link-123', unauthorizedUser);
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return null if the link is not found', async () => {
      prismaMock.sharedLink.findUnique.mockResolvedValue(null);
      const result = await linkService.getLinkById('link-404', user);
      expect(result).toBeNull();
    });
  });
  describe('getLinks', () => {
    const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
    const admin: User = { id: 'admin-123', email: 'test@test.com', role: Role.ADMIN, name: 'Test Admin' };
    const links: SharedLink[] = [
      { id: 'link-1', ownerId: 'user-123', fileId: 'file-1', fileName: 'test1.txt', filePath: '/path/to/test1.txt', sharedWith: 'user@example.com', scope: ShareScope.USER, linkUrl: 'https://cullenlinks.com/share/random-id1', expiresAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'link-2', ownerId: 'user-123', fileId: 'file-2', fileName: 'test2.txt', filePath: '/path/to/test2.txt', sharedWith: 'user@example.com', scope: ShareScope.USER, linkUrl: 'https://cullenlinks.com/share/random-id2', expiresAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    it('should return all links for an admin', async () => {
      prismaMock.sharedLink.findMany.mockResolvedValue(links);
      prismaMock.sharedLink.count.mockResolvedValue(links.length);

      const result = await linkService.getLinks(admin);

      expect(result.data).toEqual(links);
      expect(result.total).toBe(links.length);
      expect(prismaMock.sharedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('should return only own links for a regular user', async () => {
      prismaMock.sharedLink.findMany.mockResolvedValue(links);
      prismaMock.sharedLink.count.mockResolvedValue(links.length);

      const result = await linkService.getLinks(user);

      expect(result.data).toEqual(links);
      expect(result.total).toBe(links.length);
      expect(prismaMock.sharedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: user.id } }));
    });

    it('should handle pagination correctly', async () => {
      prismaMock.sharedLink.findMany.mockResolvedValue([links[1]]);
      prismaMock.sharedLink.count.mockResolvedValue(links.length);

      const result = await linkService.getLinks(user, { page: 2, limit: 1 });

      expect(result.data).toEqual([links[1]]);
      expect(result.total).toBe(links.length);
      expect(prismaMock.sharedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1, take: 1 }));
    });
  });
  describe('updateLink', () => {
    const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
    const link: SharedLink = {
      id: 'link-123',
      ownerId: 'user-123',
      fileId: 'file-123',
      fileName: 'test.txt',
      filePath: '/path/to/test.txt',
      sharedWith: 'user@example.com',
      scope: ShareScope.USER,
      linkUrl: 'https://cullenlinks.com/share/random-id',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updateParams = { scope: ShareScope.ORGANIZATION };

    it('should update a link successfully', async () => {
      prismaMock.sharedLink.findUnique.mockResolvedValue(link);
      prismaMock.sharedLink.update.mockResolvedValue({ ...link, ...updateParams });

      const result = await linkService.updateLink('link-123', updateParams, user);

      expect(result).toEqual({ ...link, ...updateParams });
      expect(logger.audit).toHaveBeenCalledWith('link.update', user.id, {
        linkId: 'link-123',
        updates: updateParams,
      });
    });

    it('should return null if trying to update a non-existent link', async () => {
      prismaMock.sharedLink.findUnique.mockResolvedValue(null);
      const result = await linkService.updateLink('link-404', updateParams, user);
      expect(result).toBeNull();
    });
  });
  describe('deleteLink', () => {
    const user: User = { id: 'user-123', email: 'test@test.com', role: Role.USER, name: 'Test User' };
    const link: SharedLink = {
      id: 'link-123',
      ownerId: 'user-123',
      fileId: 'file-123',
      fileName: 'test.txt',
      filePath: '/path/to/test.txt',
      sharedWith: 'user@example.com',
      scope: ShareScope.USER,
      linkUrl: 'https://cullenlinks.com/share/random-id',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should delete a link successfully', async () => {
      prismaMock.sharedLink.findUnique.mockResolvedValue(link);
      prismaMock.sharedLink.delete.mockResolvedValue(link);

      const result = await linkService.deleteLink('link-123', user);

      expect(result).toBe(true);
      expect(logger.audit).toHaveBeenCalledWith('link.delete', user.id, {
        linkId: 'link-123',
        fileName: link.fileName,
      });
    });

    it('should return false if trying to delete a non-existent link', async () => {
      prismaMock.sharedLink.findUnique.mockResolvedValue(null);
      const result = await linkService.deleteLink('link-404', user);
      expect(result).toBe(false);
    });
  });
  describe('findExpiringLinks', () => {
    it('should return links that are about to expire', async () => {
      const expiringLinks: SharedLink[] = [
        { id: 'link-1', ownerId: 'user-123', fileId: 'file-1', fileName: 'test1.txt', filePath: '/path/to/test1.txt', sharedWith: 'user@example.com', scope: ShareScope.USER, linkUrl: 'https://cullenlinks.com/share/random-id1', expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ];
      prismaMock.sharedLink.findMany.mockResolvedValue(expiringLinks);

      const result = await linkService.findExpiringLinks(7);

      expect(result).toEqual(expiringLinks);
      expect(prismaMock.sharedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          expiresAt: {
            not: null,
            gt: expect.any(Date),
            lte: expect.any(Date),
          },
        },
      }));
    });
  });
});
