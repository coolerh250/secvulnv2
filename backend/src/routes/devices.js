const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/deviceController');

router.use(authMiddleware);

router.get('/types',     ctrl.getDeviceTypes);
router.get('/',          ctrl.list);
router.post('/',         requireRole('superadmin', 'admin'), ctrl.create);
router.put('/:id',       requireRole('superadmin', 'admin'), ctrl.update);
router.delete('/:id',    requireRole('superadmin', 'admin'), ctrl.remove);
router.post('/scan-all', requireRole('superadmin', 'admin'), ctrl.scanAll);
router.post('/:id/scan', requireRole('superadmin', 'admin'), ctrl.scan);

// Per-device vulnerability routes
router.get('/:id/vulnerabilities',                                                        ctrl.getDeviceVulns);
router.put('/:id/vulnerabilities/:vulnId/status',          requireRole('superadmin', 'admin'), ctrl.updateDeviceVulnStatus);
router.put('/:id/vulnerabilities/:vulnId/meta',            requireRole('superadmin', 'admin'), ctrl.updateDeviceVulnMeta);
router.post('/:id/vulnerabilities/:vulnId/notes',                                               ctrl.addDeviceVulnNote);
router.post('/:id/vulnerabilities/:vulnId/risk-acceptance', requireRole('superadmin', 'admin'), ctrl.setDeviceVulnRiskAcceptance);

module.exports = router;
