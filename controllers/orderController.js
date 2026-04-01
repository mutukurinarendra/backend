const Order = require('../models/Order');
// No more mock DB functionality; real MongoDB connection is expected.

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res, next) => {
  try {
    const {
      customerName, mobileNumber, itemType, description,
      price, totalPayment, advancePayment, deliveryDate,
    } = req.body;

    const order = await Order.create({
      customerName,
      mobileNumber,
      itemType,
      description,
      price,
      totalPayment,
      advancePayment,
      deliveryDate,
      orderTakenBy: req.user._id,
      statusHistory: [{
        status: 'Order Placed',
        changedBy: req.user._id,
        note: 'Order created',
      }],
    });

    await order.populate('orderTakenBy', 'name email role');

    res.status(201).json({ success: true, message: 'Order created successfully.', order });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders with search, filter, pagination (archived excluded by default)
// @route   GET /api/orders
// @access  Private
// query parameters: page, limit, status, search, 
//   deliveryDateFrom, deliveryDateTo, orderTakenBy, itemType,
//   paymentStatus (paid/unpaid), includeArchived
const getOrders = async (req, res, next) => {
  try {
    let {
      page = 1, limit = 10, status, search,
      deliveryDateFrom, deliveryDateTo,
      orderTakenBy, itemType, paymentStatus,
      includeArchived,
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const query = { isDeleted: includeArchived === 'true' ? { $in: [true, false] } : false };

    if (status && status !== 'All') query.status = status;
    if (search) query.mobileNumber = { $regex: search, $options: 'i' };
    if (deliveryDateFrom || deliveryDateTo) {
      query.deliveryDate = {};
      if (deliveryDateFrom) query.deliveryDate.$gte = new Date(deliveryDateFrom);
      if (deliveryDateTo) query.deliveryDate.$lte = new Date(deliveryDateTo);
    }
    if (orderTakenBy) query.orderTakenBy = orderTakenBy;
    if (itemType && itemType !== 'All') query.itemType = itemType;
    if (paymentStatus) {
      if (paymentStatus === 'paid') query.remainingPayment = 0;
      if (paymentStatus === 'unpaid') query.remainingPayment = { $gt: 0 };
    }

    const sortObj = { createdAt: -1 };
    const skip = (page - 1) * limit;

    const [dbOrders, totalCount] = await Promise.all([
      Order.find(query).select('+isDeleted')
        .populate('orderTakenBy', 'name email')
        .populate('statusHistory.changedBy', 'name')
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      orders: dbOrders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).select('+isDeleted')
      .populate('orderTakenBy', 'name email role')
      .populate('statusHistory.changedBy', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    res.json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    const validStatuses = ['Order Placed', 'Order Processing', 'Order Dispatched', 'Order Delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const order = await Order.findById(req.params.id).select('+isDeleted');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot update status of an archived order.' });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      note: note || '',
    });

    await order.save();
    await order.populate('orderTakenBy', 'name email');
    await order.populate('statusHistory.changedBy', 'name');

    res.json({ success: true, message: 'Order status updated.', order });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark remaining payment as collected
// @route   PUT /api/orders/:id/collect-payment
// @access  Private
const collectPayment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).select('+isDeleted');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot collect payment for an archived order.' });
    }

    if (order.remainingPayment <= 0) {
      return res.status(400).json({ success: false, message: 'No pending amount to collect.' });
    }

    // move remainingPayment into advancePayment
    order.advancePayment += order.remainingPayment;
    order.remainingPayment = 0;
    order.statusHistory.push({
      status: order.status,
      changedBy: req.user._id,
      changedAt: new Date(),
      note: 'Remaining payment collected',
    });

    await order.save();
    await order.populate('orderTakenBy', 'name email');
    await order.populate('statusHistory.changedBy', 'name');

    res.json({ success: true, message: 'Payment collected successfully.', order });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order details
// @route   PUT /api/orders/:id
// @access  Private
const updateOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).select('+isDeleted');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot update an archived order.' });
    }

    const allowedFields = [
      'customerName', 'mobileNumber', 'itemType', 'description',
      'price', 'totalPayment', 'advancePayment', 'deliveryDate',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        order[field] = req.body[field];
      }
    });

    await order.save();
    await order.populate('orderTakenBy', 'name email');

    res.json({ success: true, message: 'Order updated successfully.', order });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive order (soft delete)
// @route   DELETE /api/orders/:id   or PUT /api/orders/:id/archive
// @access  Private (Owner only enforced in route)
const deleteOrder = async (req, res, next) => {
  try {
    // if the order is already archived, remove it permanently
    const existing = await Order.findById(req.params.id).select('+isDeleted');
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (existing.isDeleted) {
      await Order.findByIdAndDelete(req.params.id);
      return res.json({ success: true, message: 'Order permanently deleted.' });
    }

    const order = await Order.archive(req.params.id);
    res.json({ success: true, message: 'Order archived successfully.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore archived order
// @route   PUT /api/orders/:id/restore
// @access  Private (Owner only enforced in route)
const restoreOrder = async (req, res, next) => {
  try {
    const order = await Order.restore(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    res.json({ success: true, message: 'Order restored successfully.', order });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/orders/stats
// @access  Private
const getDashboardStats = async (req, res, next) => {
  try {
    const isOwner = req.user.role === 'owner';

    // counts per status (exclude archived)
    const statusCounts = await Order.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats = {
      totalOrders: 0,
      orderPlaced: 0,
      orderProcessing: 0,
      orderDispatched: 0,
      orderDelivered: 0,
    };

    statusCounts.forEach(({ _id, count }) => {
      stats.totalOrders += count;
      if (_id === 'Order Placed') stats.orderPlaced = count;
      if (_id === 'Order Processing') stats.orderProcessing = count;
      if (_id === 'Order Dispatched') stats.orderDispatched = count;
      if (_id === 'Order Delivered') stats.orderDelivered = count;
    });

    if (isOwner) {
      const financials = await Order.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPayment' },
            totalAdvance: { $sum: '$advancePayment' },
            totalPending: { $sum: '$remainingPayment' },
          },
        },
      ]);

      if (financials.length > 0) {
        stats.totalRevenue = financials[0].totalRevenue;
        stats.totalAdvance = financials[0].totalAdvance;
        stats.pendingPayments = financials[0].totalPending;
      } else {
        stats.totalRevenue = 0;
        stats.totalAdvance = 0;
        stats.pendingPayments = 0;
      }

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      twelveMonthsAgo.setDate(1);
      twelveMonthsAgo.setHours(0, 0, 0, 0);

      const monthlyData = await Order.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo }, isDeleted: false } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
            revenue: { $sum: '$totalPayment' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);

      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      stats.monthlyOrders = monthlyData.map(m => ({
        month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
        orders: m.count,
        revenue: m.revenue,
      }));

      stats.recentOrders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('orderTakenBy', 'name');

      // staff performance summary – top 5 by revenue
      const perf = await Order.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$orderTakenBy',
            orders: { $sum: 1 },
            revenue: { $sum: '$totalPayment' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $project: { _id: 0, user: { name: 1, _id: 1 }, orders: 1, revenue: 1 } },
      ]);
      stats.topStaff = perf;
    }

    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    stats.upcomingDeliveries = await Order.countDocuments({
      isDeleted: false,
      deliveryDate: { $gte: today, $lte: nextWeek },
      status: { $ne: 'Order Delivered' },
    });

    res.json({ success: true, stats });
  } catch (error) {
    next(error);
  }
};

// @desc    Export orders as CSV based on same filters as getOrders
// @route   GET /api/orders/export
// @access  Private (owner only)
const exportOrders = async (req, res, next) => {
  let Parser;
  try {
    // require inside function so server still starts if dependency missing
    Parser = require('json2csv').Parser;
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return res.status(500).json({
        success: false,
        message: 'Export feature requires json2csv package. Please run `npm install json2csv` in backend.',
      });
    }
    return next(err);
  }
  try {
    // reuse getOrders query logic by building query object
    const { status, search, deliveryDateFrom, deliveryDateTo, orderTakenBy, itemType, paymentStatus } = req.query;
    const query = { isDeleted: false };
    if (status && status !== 'All') query.status = status;
    if (search) query.mobileNumber = { $regex: search, $options: 'i' };
    if (deliveryDateFrom || deliveryDateTo) {
      query.deliveryDate = {};
      if (deliveryDateFrom) query.deliveryDate.$gte = new Date(deliveryDateFrom);
      if (deliveryDateTo) query.deliveryDate.$lte = new Date(deliveryDateTo);
    }
    if (orderTakenBy) query.orderTakenBy = orderTakenBy;
    if (itemType && itemType !== 'All') query.itemType = itemType;
    if (paymentStatus) {
      if (paymentStatus === 'paid') query.remainingPayment = 0;
      if (paymentStatus === 'unpaid') query.remainingPayment = { $gt: 0 };
    }

    const orders = await Order.find(query).populate('orderTakenBy', 'name');
    const fields = [
      'customerName','mobileNumber','itemType','status','price','totalPayment','advancePayment','remainingPayment','deliveryDate','createdAt',
      { label: 'orderTakenBy', value: (row) => row.orderTakenBy?.name || '' }
    ];
    const parser = new json2csv({ fields });
    const csv = parser.parse(orders);
    res.header('Content-Type', 'text/csv');
    res.attachment(`orders_${Date.now()}.csv`).send(csv);
  } catch (error) {
    next(error);
  }
};

// @desc    Generate invoice for an order
// @route   GET /api/orders/:id/invoice
// @access  Private
const getInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('orderTakenBy', 'name email');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    // simple JSON invoice; front-end can render nicely or server could produce PDF
    const invoice = {
      studioName: process.env.STUDIO_NAME || 'My Photo Studio',
      orderId: order._id,
      customerName: order.customerName,
      mobileNumber: order.mobileNumber,
      itemType: order.itemType,
      description: order.description,
      price: order.price,
      totalPayment: order.totalPayment,
      advancePayment: order.advancePayment,
      remainingPayment: order.remainingPayment,
      deliveryDate: order.deliveryDate,
      status: order.status,
      orderTakenBy: order.orderTakenBy?.name,
      createdAt: order.createdAt,
    };
    res.json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
  collectPayment, // export new function
};
