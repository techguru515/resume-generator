const router = require('express').Router();
const ctrl = require('../controllers/workspaceLinkController');
const { protect, approvedOnly } = require('../middleware/auth');

router.use(protect, approvedOnly);

router.get('/', ctrl.list);
router.post('/', ctrl.saveBatch);
/** POST (not DELETE) so JSON body survives Vite/webpack dev proxies reliably */
router.post('/delete-batch', ctrl.removeBatch);
router.post('/set-profile', ctrl.setProfileForLinks);

module.exports = router;
