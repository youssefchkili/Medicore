import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.specialty.createMany({
    data: [
      { name: 'Cardiology', slug: 'cardiology', description: 'Heart and cardiovascular system', icon: 'heart' },
      { name: 'Neurology', slug: 'neurology', description: 'Brain and nervous system', icon: 'brain' },
      { name: 'Psychiatry', slug: 'psychiatry', description: 'Mental health and behavioral disorders', icon: 'mood-crazy-happy' },
      { name: 'Dermatology', slug: 'dermatology', description: 'Skin, hair, and nails', icon: 'texture' },
      { name: 'Orthopedics', slug: 'orthopedics', description: 'Bones, joints, and muscles', icon: 'bone' },
      { name: 'Pediatrics', slug: 'pediatrics', description: 'Children and adolescents', icon: 'baby' },
      { name: 'Gastroenterology', slug: 'gastroenterology', description: 'Digestive system', icon: 'stomach' },
      { name: 'Endocrinology', slug: 'endocrinology', description: 'Hormones and metabolism', icon: 'droplet' },
      { name: 'Pulmonology', slug: 'pulmonology', description: 'Lungs and respiratory system', icon: 'lungs' },
      { name: 'General Practice', slug: 'general', description: 'General medicine and primary care', icon: 'stethoscope' },
    ],
    skipDuplicates: true,
  });

  console.log('Seeded 10 specialties.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
