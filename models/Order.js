const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    itemType: {
      type: String,
      required: [true, 'Item type is required'],
      enum: ['Album', 'Video', 'Photo Frame', 'Customized Product', 'Wedding', 'Event'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    totalPayment: {
      type: Number,
      required: [true, 'Total payment is required'],
      min: 0,
    },
    advancePayment: {
      type: Number,
      required: [true, 'Advance payment is required'],
      min: 0,
      default: 0,
    },
    remainingPayment: {
      type: Number,
      default: 0,
    },
    deliveryDate: {
      type: Date,
      required: [true, 'Delivery date is required'],
    },
    status: {
      type: String,
      enum: ['Order Placed', 'Order Processing', 'Order Dispatched', 'Order Delivered'],
      default: 'Order Placed',
    },
    orderTakenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    statusHistory: [statusHistorySchema],
    // soft delete flag – hidden from default queries
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  { timestamps: true }
);

// Auto-calculate remaining payment before save
orderSchema.pre('save', function (next) {
  this.remainingPayment = this.totalPayment - this.advancePayment;
  next();
});

// Indexes for faster queries
orderSchema.index({ mobileNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ deliveryDate: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ isDeleted: 1 });

// helper static methods for soft delete / restore
orderSchema.statics.archive = function(id) {
  return this.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
};

orderSchema.statics.restore = function(id) {
  return this.findByIdAndUpdate(id, { isDeleted: false }, { new: true });
};

module.exports = mongoose.model('Order', orderSchema);
