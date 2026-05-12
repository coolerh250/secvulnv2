const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { list } = require('../controllers/auditController');

router.get('/', authMiddleware, requireRole('superadmin', 'admin'), list);

module.exports = router;
