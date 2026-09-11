const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const BASE = 'https://mio.app.br/api/v1';
const USER = (process.env.MIO_AUTH_USER || '').replace(/["']/g, '').trim();
const PASS = (process.env.MIO_AUTH_PASSWORD || '').replace(/["']/g, '').trim();

async function run() {
  const creds = Buffer.from(`${USER}:${PASS}`).toString('base64');
  const { data: auth } = await axios.post(`${BASE}/authenticate`, {}, {
    headers: { 'Authorization': `Basic ${creds}` }
  });
  const headers = { 'Authorization': `Bearer ${auth.token}` };

  console.log('Fetching Fernanda trainings from MIO (CPF 13801103781)...');
  const { data } = await axios.get(`${BASE}/sms-treinamento-registro-get/13801103781`, { headers });
  
  console.log('MIO response:', JSON.stringify(data, null, 2));
}

run().catch(e => console.error('Error:', e.response?.data || e.message));
