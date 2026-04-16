import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Middleware
  app.use(express.json());

  // In-memory database (matches Python example)
  const usersDb: Record<string, string> = {};

  // Authentication Routes
  app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ status: 'error', message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }
    if (usersDb[username]) {
      return res.status(400).json({ status: 'error', message: 'ชื่อนี้มีคนใช้แล้ว' });
    }
    usersDb[username] = password;
    res.json({ status: 'success', message: 'สมัครสำเร็จ!' });
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (usersDb[username] && usersDb[username] === password) {
      res.json({ status: 'success', message: 'เข้าสู่ระบบสำเร็จ', user: { username } });
    } else {
      res.status(401).json({ status: 'error', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
