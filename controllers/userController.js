const User = require('../models/User');
const Order = require('../models/Order');

// @desc    Get all users (staff)
// @route   GET /api/users
// @access  Owner only
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: 'staff' }).sort({ createdAt: -1 });

    // gather per‑user metrics in a single aggregation
    const userIds = users.map((u) => u._id);
    const stats = await Order.aggregate([
      { $match: { orderTakenBy: { $in: userIds }, isDeleted: false } },
      {
        $group: {
          _id: '$orderTakenBy',
          totalOrders: { $sum: 1 },
          revenue: { $sum: '$totalPayment' },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Order Delivered'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $ne: ['$status', 'Order Delivered'] }, 1, 0] } },
        },
      },
    ]);

    const statsMap = {};
    stats.forEach((s) => { statsMap[s._id.toString()] = s; });

    const usersWithStats = users.map((u) => {
      const s = statsMap[u._id.toString()] || {};
      return {
        ...u.toJSON(),
        orderCount: s.totalOrders || 0,
        revenue: s.revenue || 0,
        completedOrders: s.completed || 0,
        pendingOrders: s.pending || 0,
      };
    });

    res.json({ success: true, users: usersWithStats });
  } catch (error) {
    next(error);
  }
};

// @desc    Create staff account
// @route   POST /api/users
// @access  Owner only
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use.' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'staff',
    });

    res.status(201).json({ success: true, message: 'Staff account created successfully.', user });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle block/unblock user
// @route   PUT /api/users/:id/block
// @access  Owner only
const toggleBlockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'owner') {
      return res.status(400).json({ success: false, message: 'Cannot block the owner account.' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: user.isBlocked ? 'User blocked successfully.' : 'User unblocked successfully.',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Owner only
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'owner') {
      return res.status(400).json({ success: false, message: 'Cannot delete the owner account.' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Owner only
const updateUser = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (req.body.password) user.password = req.body.password;

    await user.save();

    res.json({ success: true, message: 'User updated successfully.', user });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, createUser, toggleBlockUser, deleteUser, updateUser };
