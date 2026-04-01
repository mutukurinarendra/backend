const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Order = require('./models/Order');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect("mongodb+srv://admin:Zs7CZfpn5X7I2wvT@cluster0.z69smmb.mongodb.net/?appName=Cluster0&dbname=photo_studio_db");
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Order.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create owner
    const owner = await User.create({
      name: 'Admin',
      email: 'owner@ramastudio.com',
      password: 'owner123',
      role: 'owner',
    });
    console.log('👑 Owner created: owner@ramastudio.com / owner123');

    // Create staff members
    const staff1 = await User.create({
      name: 'Rahul Kumar',
      email: 'rahul@ramastudio.com',
      password: 'staff123',
      role: 'staff',
    });
    const staff2 = await User.create({
      name: 'Priya Singh',
      email: 'priya@ramastudio.com',
      password: 'staff123',
      role: 'staff',
    });
    
    console.log('👨‍💼 Staff created: rahul@ramastudio.com, priya@ramastudio.com / staff123');

    // Create sample orders
    const sampleOrders = [
      {
        customerName: 'Amit Sharma',
        mobileNumber: '9876543210',
        itemType: 'Wedding',
        description: 'Wedding album with 200 pages, premium binding',
        price: 15000,
        totalPayment: 15000,
        advancePayment: 8000,
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'Order Processing',
        orderTakenBy: staff1._id,
      },
      {
        customerName: 'Sunita Patel',
        mobileNumber: '9876543211',
        itemType: 'Album',
        description: 'Family portrait album, 50 pages',
        price: 3500,
        totalPayment: 3500,
        advancePayment: 2000,
        deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'Order Placed',
        orderTakenBy: owner._id,
      },
      {
        customerName: 'Ravi Mehta',
        mobileNumber: '9876543212',
        itemType: 'Video',
        description: 'Wedding video editing with drone footage, 2-3 hours',
        price: 20000,
        totalPayment: 20000,
        advancePayment: 10000,
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'Order Placed',
        orderTakenBy: staff2._id,
      },
      {
        customerName: 'Deepa Nair',
        mobileNumber: '9876543213',
        itemType: 'Photo Frame',
        description: '24x36 inch canvas print with wooden frame',
        price: 2500,
        totalPayment: 2500,
        advancePayment: 2500,
        deliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'Order Delivered',
        orderTakenBy: staff1._id,
      },
      {
        customerName: 'Kiran Joshi',
        mobileNumber: '9876543214',
        itemType: 'Event',
        description: 'Corporate event photography, 6 hours',
        price: 8000,
        totalPayment: 8000,
        advancePayment: 4000,
        deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'Order Dispatched',
        orderTakenBy: owner._id,
      },
      {
        customerName: 'Mohan Das',
        mobileNumber: '9876543215',
        itemType: 'Customized Product',
        description: 'Mug with custom photo, set of 10',
        price: 1500,
        totalPayment: 1500,
        advancePayment: 1500,
        deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: 'Order Processing',
        orderTakenBy: staff2._id,
      },
    ];

    for (const orderData of sampleOrders) {
      const order = await Order.create({
        ...orderData,
        statusHistory: [
          {
            status: 'Order Placed',
            changedBy: orderData.orderTakenBy,
            note: 'Order created',
          },
          ...(orderData.status !== 'Order Placed' ? [{
            status: orderData.status,
            changedBy: owner._id,
            note: 'Status updated',
          }] : []),
        ],
      });

      // mark one of the early orders as archived for demo
      if (order.customerName === 'Ravi Mehta') {
        await Order.archive(order._id);
      }
    }

    console.log('📦 Sample orders created');
    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Owner:  owner@ramastudio.com  /  owner123');
    console.log('   Staff1: rahul@ramastudio.com  /  staff123');
    console.log('   Staff2: priya@ramastudio.com  /  staff123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
