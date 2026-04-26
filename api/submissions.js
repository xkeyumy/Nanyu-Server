import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { desc, eq } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(pool);

const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  content: text('content').notNull(),
  type: varchar('type', { length: 20 }).notNull(),
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL 未配置，请检查 Vercel 环境变量。' });
  }

  try {
    if (req.method === 'GET') {
      const data = await db.select().from(submissions).orderBy(desc(submissions.created_at));
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { created_at, content, type } = req.body || {};
      if (!content || !type) {
        return res.status(400).json({ error: '缺少 content 或 type 字段。' });
      }
      const [inserted] = await db.insert(submissions).values({
        created_at: created_at ? new Date(created_at) : new Date(),
        content,
        type,
      }).returning();
      return res.status(201).json(inserted);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id || req.body?.id);
      if (!id || Number.isNaN(id)) {
        return res.status(400).json({ error: '无效的 id 参数。' });
      }
      await db.delete(submissions).where(eq(submissions.id, id));
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
