import { prismaMock } from '../prisma';

const mockPrismaClient = jest.fn(() => prismaMock);

export const PrismaClient = mockPrismaClient;

export const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN',
};

export const ShareScope = {
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  PUBLIC: 'PUBLIC',
};
