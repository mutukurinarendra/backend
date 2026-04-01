const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  restoreOrder,
  getDashboardStats,
  exportOrders,
  getInvoice,
  collectPayment, // added missing handler
} = require('../controllers/orderController');
const { protect, ownerOnly, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// stats
router.get('/stats', getDashboardStats);
// export CSV (owner only)
router.get('/export', ownerOnly, exportOrders);
// list / create, with advanced filters
router.get('/', getOrders);
router.post('/', createOrder);
// invoice
router.get('/:id/invoice', getInvoice);
// individual
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);
router.put('/:id', updateOrder);
router.put('/:id/collect-payment', collectPayment); // allow any user to mark pending as collected
router.delete('/:id', ownerOnly, deleteOrder); // soft delete
router.put('/:id/restore', ownerOnly, restoreOrder);

module.exports = router;
