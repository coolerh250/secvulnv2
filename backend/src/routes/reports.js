const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.use(authMiddleware);

router.get('/',         ctrl.data);
router.get('/pdf',      ctrl.pdf);
router.post('/email',   requireRole('superadmin', 'admin'), ctrl.email);
router.get('/schedule', requireRole('superadmin', 'admin'), ctrl.getSchedule);
router.post('/schedule', requireRole('superadmin', 'admin'), ctrl.saveSchedule);

module.exports = router;
