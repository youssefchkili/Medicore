// This file runs before every test file (both unit and e2e).
// It sets fake environment variables so ConfigService doesn't throw
// when the NestJS module initializes — no real .env file is needed in CI.
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_medicore';
process.env.AI_SERVICE_SECRET = 'test-ai-secret-32-chars-minimum!!';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.RESEND_API_KEY = 're_test_fake_key';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-for-jest-only';
