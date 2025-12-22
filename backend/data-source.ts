import { DataSource } from 'typeorm';

const entities = require('glob').sync('./src/**/*.entity.ts');
console.log('Entities:', entities);

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities,
  migrations: ['./src/migrations/*.ts'],
  ssl: false, // or your SSL config
});