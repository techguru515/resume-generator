const router = require('express').Router();
const ctrl = require('../controllers/cvController');
const { protect, approvedOnly } = require('../middleware/auth');

router.use(protect, approvedOnly);

router.get('/', ctrl.list);
router.post('/', ctrl.save);
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);
router.patch('/:id/status', ctrl.updateStatus);
router.delete('/:id', ctrl.remove);
router.get('/:id/download/docx', ctrl.downloadDocx);
router.get('/:id/download/pdf', ctrl.downloadPdf);

module.exports = router;
