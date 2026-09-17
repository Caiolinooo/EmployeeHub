/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- script legado CommonJS executado direto pelo node */
// Script to test the modular system backend using direct DB connection
require('dotenv').config();
const { Pool } = require('pg');

// Config
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL is not defined. Please configure the environment variable.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function test() {
    const client = await pool.connect();

    try {
        console.log('Starting Modular System Test (Direct DB)...');

        const testKey = 'test-module-' + Date.now();
        let moduleId;
        let recordId;

        // 1. Create Module
        console.log('\n1. Creating Module...');
        const createModuleQuery = `
      INSERT INTO sys_modules (title, key, description, table_name, is_system)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `;
        const moduleRes = await client.query(createModuleQuery, ['Test Module', testKey, 'Automated test module', 'sys_dynamic_records', false]);
        moduleId = moduleRes.rows[0].id;
        console.log('Module created:', moduleId);

        // 2. Add Fields
        console.log('\n2. Adding Fields...');
        const createFieldsQuery = `
      INSERT INTO sys_fields (module_id, name, label, type, required, "order")
      VALUES ($1, $2, $3, $4, $5, $6);
    `;
        await client.query(createFieldsQuery, [moduleId, 'name', 'Name', 'text', true, 0]);
        await client.query(createFieldsQuery, [moduleId, 'age', 'Age', 'number', false, 1]);
        console.log('Fields added.');

        // 3. Create Record (Dynamic)
        console.log('\n3. Creating Record...');
        const testData = { name: 'John Doe', age: 30 };
        const createRecordQuery = `
      INSERT INTO sys_dynamic_records (module_id, data)
      VALUES ($1, $2)
      RETURNING id;
    `;
        const recordRes = await client.query(createRecordQuery, [moduleId, testData]);
        recordId = recordRes.rows[0].id;
        console.log('Record created:', recordId);

        // 4. Read Record
        console.log('\n4. Reading Record...');
        const readRecordQuery = `SELECT * FROM sys_dynamic_records WHERE id = $1`;
        const readRes = await client.query(readRecordQuery, [recordId]);
        const readData = readRes.rows[0].data;
        console.log('Record read:', readData);

        if (readData.name !== 'John Doe') {
            throw new Error('Data mismatch!');
        }

        // 5. Update Record
        console.log('\n5. Updating Record...');
        const updateData = { name: 'Jane Doe', age: 31 };
        const updateRecordQuery = `
      UPDATE sys_dynamic_records
      SET data = $1
      WHERE id = $2;
    `;
        await client.query(updateRecordQuery, [updateData, recordId]);
        console.log('Record updated.');

        // 6. Delete Record
        console.log('\n6. Deleting Record...');
        const deleteRecordQuery = `DELETE FROM sys_dynamic_records WHERE id = $1`;
        await client.query(deleteRecordQuery, [recordId]);
        console.log('Record deleted.');

        // 7. Cleanup Module
        console.log('\n7. Cleaning up Module...');
        const deleteModuleQuery = `DELETE FROM sys_modules WHERE id = $1`;
        await client.query(deleteModuleQuery, [moduleId]);
        console.log('Module cleaned up.');

        console.log('\n✅ Test Passed Successfully!');
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

test();
