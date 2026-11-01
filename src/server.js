const createApp = require('./app');
const { initDb } = require('./database/initDb');

const port = Number(process.env.PORT) || 3000;
const app = createApp();

async function startServer() {
  // Tự động kiểm tra và khởi tạo CSDL MySQL (clinic_hanoi & clinic_hcm)
  await initDb().catch((err) => console.warn('[DB Init]:', err.message));

  app.listen(port, () => {
    console.log(`Clinic System listening on http://localhost:${port}`);
    console.log(`Login Portal (TV1): http://localhost:${port}/login`);
    console.log(`Patient UI (TV2, TV3, TV4): http://localhost:${port}/patients-ui`);
    console.log(`Swagger Docs: http://localhost:${port}/api-docs`);
  });
}

startServer();
