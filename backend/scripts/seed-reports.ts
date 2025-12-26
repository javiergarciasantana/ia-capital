import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';

const XLSX_DIR = ('/Users/javiersantana/Desktop/ia-reports'); // Adjust as needed
const API_BASE = 'http://localhost:3001/api/xlsx'; // Adjust port/path as needed
const ADMIN_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImVtYWlsIjoiYWRtaW5AaWEuY2FwaXRhbCIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2Njc0MjIwMiwiZXhwIjoxNzY2NzQ5NDAyfQ.0vEPO4RmbuOwnGbLhQEAkM0LJ6RPapINSlV79NJSZHY'; // You need to authenticate as admin

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const files = fs.readdirSync(XLSX_DIR).filter(f => f.endsWith('.xlsx'));

  // Get all clients
  const clients = await usersService.findAllClients(); // Implement this if needed

  for (const client of clients) {
    const profile = client.profile;
    if (!profile?.firstName) continue;

    // Find matching file
    if (!profile.firstName) {
      console.log(`No firstName for client with id ${client.id}`);
      continue;
    }
    const match = files.find(f => f.toUpperCase().includes(profile.firstName!.toUpperCase()));
    if (!match) {
      console.log(`No XLSX found for ${profile.firstName}`);
      continue;
    }

    // Read file buffer
    const filePath = path.join(XLSX_DIR, match);
    const fileBuffer = fs.readFileSync(filePath);

    // 1. Upload
    const uploadRes = await axios.post(
      `${API_BASE}/${client.id}/upload`,
      // Simulate multipart/form-data
      (() => {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', fileBuffer, match);
        return form;
      })(),
      {
        headers: {
          Authorization: `Bearer ${ADMIN_JWT}`,
          ...((() => {
            const FormData = require('form-data');
            return new FormData().getHeaders();
          })()),
        },
      }
    );
    const report = (uploadRes.data as { data: any }).data;

    // 2. Publish
    const monthYear = new Date().toISOString().slice(0, 7); // Or extract from filename
    await axios.post(
      `${API_BASE}/${client.id}/publish`,
      {
        clientId: client.id,
        report,
        monthYear,
      },
      {
        headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      }
    );

    console.log(`Uploaded and published report for ${profile.firstName} (${client.email})`);
  }

  await app.close();
}

main().catch(console.error);