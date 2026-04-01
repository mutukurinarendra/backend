const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect("mongodb+srv://admin:Zs7CZfpn5X7I2wvT@cluster0.z69smmb.mongodb.net/?appName=Cluster0&dbname=photo_studio_db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`⚠️  MongoDB Connection Error: ${error.message}`);
    // terminate since permanent DB is required
    process.exit(1);
  }
};

module.exports = connectDB;
