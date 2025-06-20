var createError = require('http-errors');
var express = require('express');
const fs = require('fs');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);


let db;

(async () => {
  try {
    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '' // Set your MySQL root password
    });

    // Create the database if it doesn't exist
    await connection.query('CREATE DATABASE IF NOT EXISTS dogwalks');
    await connection.end();

    // Now connect to the created database
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'dogwalks',
      multipleStatements: true
    });
    const schemaPath = path.join(__dirname, 'dogwalks.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schemaSql);

    const sql = fs.readFileSync(path.join(__dirname, 'dogwalks.sql'), 'utf8');
    await db.query(sql);

    const [[{ cnt }]] = await db.query('SELECT COUNT(*) AS cnt FROM Users');
    if (cnt === 0) {
      await db.query(`
        INSERT INTO Users (username, email, password_hash, role)
        VALUES
          ('alice123','alice@example.com','hash1','owner'),
          ('carol123','carol@example.com','hash2','owner'),
          ('bobwalker','bob@example.com','hash3','walker'),
          ('newwalker','new@example.com','hash4','walker')
      `);
      await db.query(`
        INSERT INTO Dogs (owner_id, name, size)
        VALUES
          ((SELECT user_id FROM Users WHERE username='alice123'), 'Max', 'medium'),
          ((SELECT user_id FROM Users WHERE username='carol123'), 'Bella', 'small')
      `);
      await db.query(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        VALUES
          ((SELECT dog_id FROM Dogs WHERE name='Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
          ((SELECT dog_id FROM Dogs WHERE name='Bella'), '2025-06-11 10:30:00', 45, 'Beachside Ave', 'open')
      `);
      await db.query(`
        INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments)
        VALUES
          (
            1,
            (SELECT user_id FROM Users WHERE username='bobwalker'),
            (SELECT user_id FROM Users WHERE username='alice123'),
            5,
            'Great!'
          ),
          (
            2,
            (SELECT user_id FROM Users WHERE username='bobwalker'),
            (SELECT user_id FROM Users WHERE username='carol123'),
            4,
            'Good job'
          )
      `);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time,
             wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch open walk requests' });
  }
});

app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.username AS walker_username,
             COUNT(r.rating_id) AS total_ratings,
             AVG(r.rating) AS average_rating,
             COUNT(r.rating_id) AS completed_walks
      FROM Users u
      LEFT JOIN WalkRatings r ON u.user_id = r.walker_id
      WHERE u.role = 'walker'
      GROUP BY u.username
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walker summaries' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

module.exports = app;
