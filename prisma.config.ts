import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

// Export model delegates for direct access
export const User = prisma.user;
export const TrackedLink = prisma.trackedLink;
// Add more models here as needed

export default prisma;
