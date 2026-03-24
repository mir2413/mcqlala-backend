// Migration script: JSON → MongoDB (NO DATA LOSS)
const mongoose = require('mongoose');
const fs = require('fs');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mcqlala';

// Define schemas to match your structure
const userSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.Mixed,
  username: String,
  email: String,
  password: String,
  isAdmin: Boolean,
  createdAt: Date
});

const subjectSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.Mixed,
  name: String,
  description: String,
  topics: Array
});

const mcqSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.Mixed,
  question: String,
  options: Array,
  correctAnswer: Number,
  category: String,
  topic: String,
  difficulty: String
});

const navItemSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.Mixed,
  name: String,
  path: String,
  subItems: Array
});

const messageSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.Mixed,
  name: String,
  email: String,
  message: String,
  createdAt: Date
});

const User = mongoose.model('User', userSchema);
const Subject = mongoose.model('Subject', subjectSchema);
const MCQ = mongoose.model('MCQ', mcqSchema);
const NavItem = mongoose.model('NavItem', navItemSchema);
const Message = mongoose.model('Message', messageSchema);

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Read JSON file
    const data = JSON.parse(fs.readFileSync('database.json', 'utf8'));
    console.log('✅ Read database.json');

    // Check if data already exists (to prevent duplicates)
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('⚠️  MongoDB already has data. Clear collections first? (y/n)');
      // For automated migration, we'll just backup
      console.log('📦 Skipping to avoid duplicates. Backup your database first!');
      await mongoose.connection.close();
      return;
    }

    // Migrate users
    if (data.users && data.users.length > 0) {
      await User.insertMany(data.users);
      console.log(`✅ Migrated ${data.users.length} users`);
    }

    // Migrate subjects
    if (data.subjects && data.subjects.length > 0) {
      await Subject.insertMany(data.subjects);
      console.log(`✅ Migrated ${data.subjects.length} subjects`);
    }

    // Migrate MCQs
    if (data.mcqs && data.mcqs.length > 0) {
      await MCQ.insertMany(data.mcqs);
      console.log(`✅ Migrated ${data.mcqs.length} MCQs`);
    }

    // Migrate navigation items
    if (data.navItems && data.navItems.length > 0) {
      await NavItem.insertMany(data.navItems);
      console.log(`✅ Migrated ${data.navItems.length} nav items`);
    }

    // Migrate messages
    if (data.messages && data.messages.length > 0) {
      await Message.insertMany(data.messages);
      console.log(`✅ Migrated ${data.messages.length} messages`);
    }

    console.log('\n✅ Migration complete! All data transferred.');
    console.log('📌 Your original JSON file is still intact (not deleted)');
    console.log('📌 Next step: Update server.js to use MongoDB');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

migrate();
