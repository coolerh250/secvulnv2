const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const { login, me } = require('../controllers/authController');

router.post('/login', login);
router.get('/me',     authMiddleware, me);

module.exports = router;
