const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { get, update } = require('../controllers/settingsController');

router.use(authMiddleware);

router.get('/',  requireRole('superadmin'), get);
router.put('/',  requireRole('superadmin'), update);

module.exports = router;
