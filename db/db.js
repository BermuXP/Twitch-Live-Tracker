import mariadb from 'mariadb';
import dotenv from 'dotenv';
dotenv.config();

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5,
});

export const executeQuery = async (query, params = []) => {
    const conn = await pool.getConnection();
    try {
        return await conn.query(query, params);
    } finally {
        if (conn) conn.release();
    }
};
