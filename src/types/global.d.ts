// import { PrismaClient } from '@prisma/client'; // Removed - using Supabase

declare global {
  // let prisma: PrismaClient; // Removed - using Supabase

  interface Window {
    convertOffice365File?: (file: File) => Promise<{
      url: string;
      filename: string;
      totalRecords: number;
      validRecords: number;
    }>;
  }
}
