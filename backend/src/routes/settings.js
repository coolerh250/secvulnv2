const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { get, update, testEmail, testWebhook, testSource, syncSource } = require('../controllers/settingsController');

router.use(authMiddleware);

router.get('/',                              requireRole('superadmin'), get);
router.put('/',                              requireRole('superadmin'), update);
router.post('/test-email',                   requireRole('superadmin'), testEmail);
router.post('/test-webhook',                 requireRole('superadmin'), testWebhook);
router.post('/sources/:id/test',             requireRole('superadmin'), testSource);
router.post('/sources/:id/sync',             requireRole('superadmin'), syncSource);

module.exports = router;
