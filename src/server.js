const createApp = require('./app');

const port = Number(process.env.PORT) || 3000;
const app = createApp();
app.listen(port, () => {
  console.log(`Clinic Booking API listening on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
});
