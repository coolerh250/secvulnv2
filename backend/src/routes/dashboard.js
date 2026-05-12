const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { stats, trend, reviews, rebuildTrendsHandler } = require('../controllers/dashboardController');

router.use(authMiddleware);

router.get('/stats',          stats);
router.get('/trend',          trend);
router.get('/reviews',        reviews);
router.post('/trends/rebuild', requireRole('superadmin', 'admin'), rebuildTrendsHandler);

module.exports = router;
