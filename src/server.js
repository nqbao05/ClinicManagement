const createApp = require('./app');
const initDbModule = require('../scripts/initDb');

const port = Number(process.env.PORT) || 3000;
const app = createApp();

async function startServer() {
  // Tự động kiểm tra và khởi tạo CSDL MySQL (clinic_hanoi & clinic_hcm)
  const initDb = typeof initDbModule === 'function' ? initDbModule : (initDbModule.initDb || initDbModule.main);
  if (typeof initDb === 'function') {
    try {
      await initDb();
    } catch (err) {
      console.warn('[DB Init]:', err.message);
    }
  }

  const server = app.listen(port, () => {
    console.log(`Clinic System listening on http://localhost:${port}`);
    console.log(`Patient UI (TV2): http://localhost:${port}/patients`);
    console.log(`Appointments UI (TV3): http://localhost:${port}/appointments`);
    console.log(`Dashboard UI (TV4): http://localhost:${port}/dashboard`);
    console.log(`Swagger Docs: http://localhost:${port}/api-docs`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };
