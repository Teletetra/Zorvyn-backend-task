// src/db/runInit.ts
import fs from 'fs';
import path from 'path';
import pool from '../config/db';

async function runInit() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
        console.log('Running database initialization...');
        await pool.query(sql);
        console.log('Database initialization completed successfully.');
    } catch (error) {
        console.error('Error running database initialization:', error);
    } finally {
        await pool.end();
    }
}

runInit();
