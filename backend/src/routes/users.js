const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

router.use(authMiddleware);
router.use(requireRole('superadmin', 'admin'));

router.get('/',      ctrl.list);
router.post('/',     ctrl.create);
router.put('/:id',   ctrl.update);
router.delete('/:id',ctrl.remove);

module.exports = router;
