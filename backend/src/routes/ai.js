const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const { analyzeVuln } = require('../controllers/aiController');

router.use(authMiddleware);
router.post('/analyze', analyzeVuln);

module.exports = router;
