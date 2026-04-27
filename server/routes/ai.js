const router = require('express').Router();
const ctrl = require('../controllers/aiController');
const { protect, approvedOnly } = require('../middleware/auth');

router.use(protect, approvedOnly);

router.post('/cv-chat', ctrl.cvChat);

module.exports = router;

