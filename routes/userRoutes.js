const express = require('express');
const router = express.Router();
const {
  getUsers, createUser, toggleBlockUser, deleteUser, updateUser,
} = require('../controllers/userController');
const { protect, ownerOnly } = require('../middleware/authMiddleware');

router.use(protect, ownerOnly);

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/block', toggleBlockUser);
router.delete('/:id', deleteUser);

module.exports = router;
