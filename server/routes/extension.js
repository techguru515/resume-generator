const router = require('express').Router();
const ctrl = require('../controllers/extensionController');
const { protect, approvedOnly } = require('../middleware/auth');

router.use(protect, approvedOnly);

router.get('/cv-builder-zip', ctrl.downloadCvBuilderZip);

module.exports = router;

