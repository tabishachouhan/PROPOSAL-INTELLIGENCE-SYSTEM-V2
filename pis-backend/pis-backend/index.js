const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();

const app = express();

app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      /\.vercel\.app$/,
      /\.onrender\.com$/,
      /^http:\/\/localhost/
    ];
    if (!origin || allowed.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());

console.log("PORT =", process.env.PORT);
console.log("MONGODB_URI =", process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB error:");
    console.error(err);
  });

app.use('/api/auth', require('./app/routes/auth'));
app.use('/api/opportunities', require('./app/routes/opportunities'));
app.use('/api/competencies', require('./app/routes/competencies'));

app.get('/', (req, res) => {
  res.json({
    message: 'PIS Backend running',
    version: '2.0',
    agents_ready: ['Agent 1: Brief Interpreter', 'Agent 2: Question Generator'],
    agents_coming: ['Agent 3', 'Agent 4', 'Agent 5', 'Agent 6']
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log('🚀 PIS Backend v2 running on port', PORT);
    console.log('✅ CORS enabled for ALL vercel.app origins');
  });
}

module.exports = app;
