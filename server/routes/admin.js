const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

router.get('/stats', ctrl.stats);
router.get('/users', ctrl.listUsers);
router.put('/users/:id/approve', ctrl.toggleApprove);
router.get('/users/:id/cvs', ctrl.getUserCVs);
router.get('/users/:id/profiles', ctrl.getUserProfiles);
router.get('/cvs', ctrl.listAllCVs);

module.exports = router;
