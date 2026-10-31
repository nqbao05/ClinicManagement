const createApp = require('./app');
const { initDb } = require('./database/initDb');

const port = Number(process.env.PORT) || 3000;
const app = createApp();

async function startServer() {
  // Tự động kiểm tra và khởi tạo CSDL MySQL (clinic_hanoi & clinic_hcm)
  await initDb().catch((err) => console.warn('[DB Init]:', err.message));

  app.listen(port, () => {
    console.log(`Clinic Booking API listening on http://localhost:${port}`);
    console.log(`Swagger UI: http://localhost:${port}/api-docs`);
    console.log(`Patient UI: http://localhost:${port}/patients-ui`);
  });
}

startServer();
