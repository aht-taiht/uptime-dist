// Script để test monthly uptime functionality
const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'kuma.db');

function testDatabase() {
    console.log('Testing monthly_uptime table functionality...');
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            return;
        }
        console.log('Connected to SQLite database.');
    });

    // Test 1: Check if monthly_uptime table exists
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_uptime';`, (err, row) => {
        if (err) {
            console.error('Error checking table:', err.message);
        } else if (row) {
            console.log('✓ monthly_uptime table exists');
            
            // Test 2: Check table structure
            db.all(`PRAGMA table_info(monthly_uptime);`, (err, rows) => {
                if (err) {
                    console.error('Error checking table structure:', err.message);
                } else {
                    console.log('✓ monthly_uptime table structure:');
                    rows.forEach(col => {
                        console.log(`  - ${col.name}: ${col.type}`);
                    });
                }
            });

            // Test 3: Check if triggers exist
            db.all(`SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%monthly_uptime%';`, (err, triggers) => {
                if (err) {
                    console.error('Error checking triggers:', err.message);
                } else {
                    console.log('✓ Found triggers:');
                    triggers.forEach(trigger => {
                        console.log(`  - ${trigger.name}`);
                    });
                }
            });

            // Test 4: Check sample data
            db.all(`SELECT COUNT(*) as count FROM monthly_uptime;`, (err, result) => {
                if (err) {
                    console.error('Error counting data:', err.message);
                } else {
                    console.log(`✓ monthly_uptime table has ${result[0].count} records`);
                }
                
                // Close database connection
                db.close((err) => {
                    if (err) {
                        console.error(err.message);
                    } else {
                        console.log('Database connection closed.');
                    }
                });
            });

        } else {
            console.log('❌ monthly_uptime table does not exist');
            db.close();
        }
    });
}

testDatabase();