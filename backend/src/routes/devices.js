const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/deviceController');

router.use(authMiddleware);

router.get('/',          ctrl.list);
router.post('/',         requireRole('superadmin', 'admin'), ctrl.create);
router.put('/:id',       requireRole('superadmin', 'admin'), ctrl.update);
router.delete('/:id',    requireRole('superadmin', 'admin'), ctrl.remove);
router.post('/scan-all', requireRole('superadmin', 'admin'), ctrl.scanAll);
router.post('/:id/scan', requireRole('superadmin', 'admin'), ctrl.scan);

module.exports = router;
