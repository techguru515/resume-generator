const router = require('express').Router();
const ctrl = require('../controllers/cvController');
const { protect, approvedOnly } = require('../middleware/auth');

router.use(protect, approvedOnly);

router.get('/', ctrl.list);
router.post('/', ctrl.save);
router.post('/generate', ctrl.generateWithAi);
/** POST + PATCH: JSON body on POST survives some dev proxies; PATCH kept for compatibility */
router.post('/:id/status', ctrl.updateStatus);
router.patch('/:id/status', ctrl.updateStatus);
router.get('/:id/download/docx', ctrl.downloadDocx);
router.get('/:id/download/pdf', ctrl.downloadPdf);
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
