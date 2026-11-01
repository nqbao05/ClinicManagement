const BadRequestError = require('./bad-request.error');
const ConflictError = require('./conflict.error');
const InternalServerError = require('./internal-server.error');
const NotFoundError = require('./not-found.error');

module.exports = {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError
};
