const { createAuthV1Routes } = require('../modules/auth/auth.routes');

/**
 * Adapter duy trì tương thích ngược cho các bộ test và module cũ
 * Ủy quyền trực tiếp vào module Clean Architecture: src/modules/auth/
 */
function createAuthRoutes(options = {}) {
  return createAuthV1Routes(options);
}

module.exports = createAuthRoutes;
