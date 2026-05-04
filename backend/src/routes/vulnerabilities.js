const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/vulnerabilityController');

router.use(authMiddleware);

router.get('/',                       ctrl.list);
router.get('/:id',                    ctrl.getOne);
router.put('/:id/status',             requireRole('superadmin', 'admin'), ctrl.updateStatus);
router.post('/:id/notes',             requireRole('superadmin', 'admin'), ctrl.addNote);
router.post('/:id/risk-acceptance',   requireRole('superadmin'), ctrl.setRiskAcceptance);

module.exports = router;
