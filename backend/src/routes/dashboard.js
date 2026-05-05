const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const { stats, trend, reviews, rebuildTrendsHandler } = require('../controllers/dashboardController');

router.use(authMiddleware);

router.get('/stats',          stats);
router.get('/trend',          trend);
router.get('/reviews',        reviews);
router.post('/trends/rebuild', rebuildTrendsHandler);

module.exports = router;
