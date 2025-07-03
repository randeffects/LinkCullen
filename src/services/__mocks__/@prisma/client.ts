import { prismaMock } from '../prisma';

const mockPrismaClient = jest.fn(() => prismaMock);

export const PrismaClient = mockPrismaClient;

export const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN',
};

export const ShareType = {
  SPECIFIC_PEOPLE: 'SPECIFIC_PEOPLE',
  ANYONE: 'ANYONE',
};

export const Permission = {
  VIEW: 'VIEW',
  EDIT: 'EDIT',
  BLOCK_DOWNLOAD: 'BLOCK_DOWNLOAD',
};
