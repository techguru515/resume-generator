const router = require('express').Router();
const ctrl = require('../controllers/templateController');
const { protect, approvedOnly, adminOnly } = require('../middleware/auth');

router.use(protect, approvedOnly);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/:id/preview', ctrl.preview);

router.post('/', adminOnly, ctrl.create);
router.put('/:id', adminOnly, ctrl.update);
router.delete('/:id', adminOnly, ctrl.remove);

module.exports = router;

