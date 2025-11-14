const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTable() {
  await client.connect();

  const result = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'criterios'
    ORDER BY ordinal_position;
  `);

  console.log('\nEstrutura da tabela criterios:');
  console.log('================================');
  result.rows.forEach(row => {
    console.log(`${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });

  await client.end();
}

checkTable().catch(console.error);
