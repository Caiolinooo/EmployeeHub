/**
 * Comprehensive End-to-End Test Script for Evaluation Module
 * 
 * This script performs complete testing of the evaluation workflow:
 * 1. Database view functionality verification
 * 2. API endpoints testing with authentication
 * 3. Frontend components data flow testing
 * 4. Notification system testing
 * 5. Complete evaluation lifecycle testing
 * 6. Integration testing between all components
 * 7. Original issue resolution verification
 */

const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const adminToken = process.env.ADMIN_TOKEN || 'admin-token-test';

// Database connection for direct queries
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

// Supabase clients
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Test data - Generate valid UUIDs and unique emails and phone numbers
const timestamp = Date.now();
const randomSuffix = Math.floor(Math.random() * 10000);
const TEST_FUNCIONARIO_ID = uuidv4();
const TEST_AVALIADOR_ID = uuidv4();
const TEST_FUNCIONARIO_EMAIL = `funcionario.e2e.${timestamp}@example.com`;
const TEST_AVALIADOR_EMAIL = `avaliador.e2e.${timestamp}@example.com`;
const TEST_FUNCIONARIO_PHONE = `+55119${randomSuffix.toString().padStart(8, '0')}`;
const TEST_AVALIADOR_PHONE = `+55119${(randomSuffix + 1).toString().padStart(8, '0')}`;
const TEST_PERIODO = '2025';

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  details: [],
  startTime: null,
  endTime: null
};

/**
 * Log test result
 */
function logTest(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
  
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  
  testResults.details.push({
    test: testName,
    passed: passed,
    details: details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Make HTTP request
 */
async function makeRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  const cleanUrl = `${baseUrl}${url}`.replace(/\s+/g, '');
  
  try {
    const response = await fetch(cleanUrl, finalOptions);
    const data = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      data: data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error.message }
    };
  }
}

/**
 * Phase 1: Database View Functionality Verification
 */
async function testDatabaseViewFunctionality() {
  console.log('\n=== PHASE 1: DATABASE VIEW FUNCTIONALITY VERIFICATION ===');
  
  try {
    await pgClient.connect();
    console.log('✅ Connected to database');
    
    // Test 1.1: Check if view exists
    console.log('\n1.1 Testing view existence...');
    const viewCheck = await pgClient.query(`
      SELECT view_definition 
      FROM information_schema.views 
      WHERE table_name = 'vw_avaliacoes_desempenho'
    `);
    
    if (viewCheck.rows.length === 0) {
      logTest('Database View Existence', false, 'View vw_avaliacoes_desempenho does not exist');
      return false;
    }
    
    logTest('Database View Existence', true, 'View vw_avaliacoes_desempenho exists');
    
    // Test 1.2: Check view structure
    console.log('\n1.2 Testing view structure...');
    const columns = await pgClient.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vw_avaliacoes_desempenho'
      ORDER BY ordinal_position
    `);
    
    const expectedFields = [
      'id', 'funcionario_id', 'avaliador_id', 'periodo', 'periodo_id',
      'data_inicio', 'data_fim', 'status', 'pontuacao_total', 'observacoes',
      'funcionario_nome', 'funcionario_cargo', 'funcionario_departamento',
      'avaliador_nome', 'avaliador_cargo', 'periodo_nome'
    ];
    
    const columnNames = columns.rows.map(col => col.column_name);
    let allFieldsPresent = true;
    let missingFields = [];
    
    expectedFields.forEach(field => {
      if (columnNames.includes(field)) {
        console.log(`  ✅ ${field}`);
      } else {
        console.log(`  ❌ ${field} - MISSING`);
        allFieldsPresent = false;
        missingFields.push(field);
      }
    });
    
    if (allFieldsPresent) {
      logTest('View Structure Completeness', true, 'All expected fields are present');
    } else {
      logTest('View Structure Completeness', false, `Missing fields: ${missingFields.join(', ')}`);
    }
    
    // Test 1.3: Test view data retrieval
    console.log('\n1.3 Testing view data retrieval...');
    const testData = await pgClient.query(`
      SELECT 
        id, funcionario_nome, funcionario_cargo, avaliador_nome, 
        avaliador_cargo, periodo_nome, status
      FROM vw_avaliacoes_desempenho
      LIMIT 5
    `);
    
    console.log(`  📊 Retrieved ${testData.rows.length} records`);
    testData.rows.forEach(row => {
      console.log(`    - ID: ${row.id}, Func: ${row.funcionario_nome || 'N/A'}, Aval: ${row.avaliador_nome || 'N/A'}, Status: ${row.status}`);
    });
    
    logTest('View Data Retrieval', true, `Successfully retrieved ${testData.rows.length} records`);
    
    // Test 1.4: Test view JOINs functionality
    console.log('\n1.4 Testing view JOINs functionality...');
    const joinTest = await pgClient.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(funcionario_nome) as with_funcionario_name,
        COUNT(avaliador_nome) as with_avaliador_name,
        COUNT(periodo_nome) as with_periodo_name
      FROM vw_avaliacoes_desempenho
    `);
    
    const result = joinTest.rows[0];
    console.log(`  📊 Total records: ${result.total}`);
    console.log(`  👥 With employee name: ${result.with_funcionario_name}`);
    console.log(`  👥 With evaluator name: ${result.with_avaliador_name}`);
    console.log(`  📅 With period name: ${result.with_periodo_name}`);
    
    const joinWorking = result.with_funcionario_name > 0 && result.with_avaliador_name > 0;
    logTest('View JOINs Functionality', joinWorking, 
      joinWorking ? 'JOINs are working correctly' : 'JOINs are not working properly');
    
    return allFieldsPresent && joinWorking;
    
  } catch (error) {
    console.error('❌ Database view test error:', error.message);
    logTest('Database View Functionality', false, error.message);
    return false;
  } finally {
    await pgClient.end();
  }
}

/**
 * Phase 2: API Endpoints Testing
 */
async function testApiEndpoints() {
  console.log('\n=== PHASE 2: API ENDPOINTS TESTING ===');
  
  let avaliacaoId = null;
  let successCount = 0;
  let totalTests = 0;
  
  try {
    // Test 2.1: Main module endpoint
    console.log('\n2.1 Testing main module endpoint...');
    totalTests++;
    const mainModuleResult = await makeRequest('/api/avaliacao-desempenho');
    if (mainModuleResult.ok) {
      logTest('Main Module Endpoint', true, 'Module initialized successfully');
      successCount++;
    } else {
      logTest('Main Module Endpoint', false, `Status: ${mainModuleResult.status}, Error: ${mainModuleResult.data.error}`);
    }
    
    // Test 2.2: List evaluations
    console.log('\n2.2 Testing list evaluations endpoint...');
    totalTests++;
    const listResult = await makeRequest('/api/avaliacao-desempenho/avaliacoes');
    if (listResult.ok) {
      logTest('List Evaluations Endpoint', true, `Retrieved ${listResult.data.data?.length || 0} evaluations`);
      successCount++;
    } else {
      logTest('List Evaluations Endpoint', false, `Status: ${listResult.status}, Error: ${listResult.data.error}`);
    }
    
    // Test 2.3: Create evaluation
    console.log('\n2.3 Testing create evaluation endpoint...');
    totalTests++;
    const avaliacaoData = {
      funcionario_id: TEST_FUNCIONARIO_ID,
      avaliador_id: TEST_AVALIADOR_ID,
      periodo: TEST_PERIODO,
      status: 'pendente',
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      observacoes: 'Test evaluation for end-to-end testing',
      pontuacao_total: 0
    };
    
    const createResult = await makeRequest('/api/avaliacao-desempenho/avaliacoes', {
      method: 'POST',
      body: JSON.stringify(avaliacaoData)
    });
    
    if (createResult.ok && createResult.data.success) {
      avaliacaoId = createResult.data.data.id;
      logTest('Create Evaluation Endpoint', true, `Evaluation created with ID: ${avaliacaoId}`);
      successCount++;
    } else {
      logTest('Create Evaluation Endpoint', false, `Status: ${createResult.status}, Error: ${createResult.data.error}`);
    }
    
    // Test 2.4: Get evaluation by ID (if creation was successful)
    if (avaliacaoId) {
      console.log('\n2.4 Testing get evaluation by ID endpoint...');
      totalTests++;
      const getResult = await makeRequest(`/api/avaliacao-desempenho/avaliacoes/${avaliacaoId}`);
      if (getResult.ok) {
        const evaluation = getResult.data.data;
        console.log(`  📋 Retrieved evaluation: ${evaluation.id}, Status: ${evaluation.status}`);
        console.log(`  👥 Employee: ${evaluation.funcionario_nome || 'N/A'}`);
        console.log(`  👥 Evaluator: ${evaluation.avaliador_nome || 'N/A'}`);
        logTest('Get Evaluation By ID Endpoint', true, 'Evaluation retrieved successfully');
        successCount++;
      } else {
        logTest('Get Evaluation By ID Endpoint', false, `Status: ${getResult.status}, Error: ${getResult.data.error}`);
      }
    }
    
    // Test 2.5: Update evaluation status (if creation was successful)
    if (avaliacaoId) {
      console.log('\n2.5 Testing update evaluation endpoint...');
      totalTests++;
      const updateData = {
        status: 'em_andamento',
        observacoes: 'Updated during end-to-end testing'
      };
      
      const updateResult = await makeRequest(`/api/avaliacao-desempenho/avaliacoes/${avaliacaoId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      
      if (updateResult.ok && updateResult.data.success) {
        logTest('Update Evaluation Endpoint', true, 'Evaluation updated successfully');
        successCount++;
      } else {
        logTest('Update Evaluation Endpoint', false, `Status: ${updateResult.status}, Error: ${updateResult.data.error}`);
      }
    }
    
    // Test 2.6: Test criteria endpoints
    console.log('\n2.6 Testing criteria endpoints...');
    totalTests++;
    const criteriosResult = await makeRequest('/api/avaliacao-desempenho/criterios');
    if (criteriosResult.ok) {
      logTest('List Criteria Endpoint', true, `Retrieved ${criteriosResult.data.data?.length || 0} criteria`);
      successCount++;
    } else {
      logTest('List Criteria Endpoint', false, `Status: ${criteriosResult.status}, Error: ${criteriosResult.data.error}`);
    }
    
    // Test 2.7: Test employees endpoints
    console.log('\n2.7 Testing employees endpoints...');
    totalTests++;
    const funcionariosResult = await makeRequest('/api/avaliacao-desempenho/funcionarios');
    if (funcionariosResult.ok) {
      logTest('List Employees Endpoint', true, `Retrieved ${funcionariosResult.data.data?.length || 0} employees`);
      successCount++;
    } else {
      logTest('List Employees Endpoint', false, `Status: ${funcionariosResult.status}, Error: ${funcionariosResult.data.error}`);
    }
    
    // Test 2.8: Test cycles endpoints
    console.log('\n2.8 Testing cycles endpoints...');
    totalTests++;
    const ciclosResult = await makeRequest('/api/avaliacao-workflow/ciclos');
    if (ciclosResult.ok) {
      logTest('List Cycles Endpoint', true, `Retrieved ${ciclosResult.data.data?.length || 0} cycles`);
      successCount++;
    } else {
      logTest('List Cycles Endpoint', false, `Status: ${ciclosResult.status}, Error: ${ciclosResult.data.error}`);
    }
    
    // Test 2.9: Clean up - delete test evaluation (if created)
    if (avaliacaoId) {
      console.log('\n2.9 Testing delete evaluation endpoint...');
      totalTests++;
      const deleteResult = await makeRequest(`/api/avaliacao-desempenho/avaliacoes/${avaliacaoId}`, {
        method: 'DELETE'
      });
      
      if (deleteResult.ok) {
        logTest('Delete Evaluation Endpoint', true, 'Test evaluation cleaned up successfully');
        successCount++;
      } else {
        logTest('Delete Evaluation Endpoint', false, `Status: ${deleteResult.status}, Error: ${deleteResult.data.error}`);
      }
    }
    
    const successRate = (successCount / totalTests * 100).toFixed(2);
    console.log(`\n📊 API Tests Summary: ${successCount}/${totalTests} passed (${successRate}%)`);
    
    return successCount === totalTests;
    
  } catch (error) {
    console.error('❌ API testing error:', error.message);
    logTest('API Endpoints Testing', false, error.message);
    return false;
  }
}

/**
 * Phase 3: Notification System Testing
 */
async function testNotificationSystem() {
  console.log('\n=== PHASE 3: NOTIFICATION SYSTEM TESTING ===');
  
  let avaliacaoId = null;
  let notificationTestsPassed = 0;
  let totalNotificationTests = 0;
  
  try {
    // Create test evaluation for notification testing
    console.log('\n3.1 Creating test evaluation for notification testing...');
    const avaliacaoData = {
      funcionario_id: TEST_FUNCIONARIO_ID,
      avaliador_id: TEST_AVALIADOR_ID,
      periodo: TEST_PERIODO,
      status: 'pendente',
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      observacoes: 'Test evaluation for notification testing',
      pontuacao_total: 0
    };
    
    const createResult = await makeRequest('/api/avaliacao-desempenho/avaliacoes', {
      method: 'POST',
      body: JSON.stringify(avaliacaoData)
    });
    
    if (!createResult.ok || !createResult.data.success) {
      logTest('Notification System Setup', false, 'Failed to create test evaluation');
      return false;
    }
    
    avaliacaoId = createResult.data.data.id;
    console.log(`  ✅ Test evaluation created: ${avaliacaoId}`);
    
    // Test 3.2: Check if notifications were created
    console.log('\n3.2 Testing notification creation...');
    totalNotificationTests++;
    
    // Wait a bit for notifications to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check notifications for employee
    const { data: funcNotifications, error: funcError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', TEST_FUNCIONARIO_ID)
      .like('data', `%${avaliacaoId}%`);
    
    if (funcError) {
      console.error('  ❌ Error fetching employee notifications:', funcError.message);
      logTest('Employee Notification Creation', false, funcError.message);
    } else {
      console.log(`  📧 Found ${funcNotifications?.length || 0} notifications for employee`);
      if (funcNotifications && funcNotifications.length > 0) {
        funcNotifications.forEach(notif => {
          console.log(`    - ${notif.title}: ${notif.message}`);
        });
        logTest('Employee Notification Creation', true, 'Employee notifications created successfully');
        notificationTestsPassed++;
      } else {
        logTest('Employee Notification Creation', false, 'No notifications found for employee');
      }
    }
    
    // Check notifications for evaluator
    totalNotificationTests++;
    const { data: avalNotifications, error: avalError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', TEST_AVALIADOR_ID)
      .like('data', `%${avaliacaoId}%`);
    
    if (avalError) {
      console.error('  ❌ Error fetching evaluator notifications:', avalError.message);
      logTest('Evaluator Notification Creation', false, avalError.message);
    } else {
      console.log(`  📧 Found ${avalNotifications?.length || 0} notifications for evaluator`);
      if (avalNotifications && avalNotifications.length > 0) {
        avalNotifications.forEach(notif => {
          console.log(`    - ${notif.title}: ${notif.message}`);
        });
        logTest('Evaluator Notification Creation', true, 'Evaluator notifications created successfully');
        notificationTestsPassed++;
      } else {
        logTest('Evaluator Notification Creation', false, 'No notifications found for evaluator');
      }
    }
    
    // Test 3.3: Test status update notifications
    console.log('\n3.3 Testing status update notifications...');
    totalNotificationTests++;
    
    // Update evaluation status
    const updateResult = await makeRequest(`/api/avaliacao-desempenho/avaliacoes/${avaliacaoId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'em_andamento',
        observacoes: 'Status updated for notification testing'
      })
    });
    
    if (!updateResult.ok) {
      logTest('Status Update for Notifications', false, 'Failed to update evaluation status');
    } else {
      console.log('  ✅ Evaluation status updated to "em_andamento"');
      
      // Wait for notifications to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for new notifications
      const { data: newNotifications, error: newNotifError } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .in('user_id', [TEST_FUNCIONARIO_ID, TEST_AVALIADOR_ID])
        .like('data', `%${avaliacaoId}%`);
      
      if (newNotifError) {
        console.error('  ❌ Error fetching updated notifications:', newNotifError.message);
        logTest('Status Update Notifications', false, newNotifError.message);
      } else {
        console.log(`  📧 Found ${newNotifications?.length || 0} total notifications after status update`);
        if (newNotifications && newNotifications.length > 0) {
          logTest('Status Update Notifications', true, 'Status update notifications created successfully');
          notificationTestsPassed++;
        } else {
          logTest('Status Update Notifications', false, 'No new notifications found after status update');
        }
      }
    }
    
    // Test 3.4: Test evaluation completion notifications
    console.log('\n3.4 Testing evaluation completion notifications...');
    totalNotificationTests++;
    
    // Complete evaluation
    const completeResult = await makeRequest(`/api/avaliacao-desempenho/avaliacoes/${avaliacaoId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'concluida',
        pontuacao_total: 85,
        observacoes: 'Evaluation completed for notification testing'
      })
    });
    
    if (!completeResult.ok) {
      logTest('Evaluation Completion Notifications', false, 'Failed to complete evaluation');
    } else {
      console.log('  ✅ Evaluation status updated to "concluida"');
      
      // Wait for notifications to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for completion notifications
      const { data: completionNotifications, error: completionNotifError } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .in('user_id', [TEST_FUNCIONARIO_ID, TEST_AVALIADOR_ID])
        .like('data', `%${avaliacaoId}%`);
      
      if (completionNotifError) {
        console.error('  ❌ Error fetching completion notifications:', completionNotifError.message);
        logTest('Evaluation Completion Notifications', false, completionNotifError.message);
      } else {
        console.log(`  📧 Found ${completionNotifications?.length || 0} total notifications after completion`);
        if (completionNotifications && completionNotifications.length > 0) {
          logTest('Evaluation Completion Notifications', true, 'Completion notifications created successfully');
          notificationTestsPassed++;
        } else {
          logTest('Evaluation Completion Notifications', false, 'No completion notifications found');
        }
      }
    }
    
    // Clean up test evaluation and notifications
    console.log('\n3.5 Cleaning up test data...');
    await makeRequest(`/api/avaliacao-desempenho/avaliacoes/${avaliacaoId}`, {
      method: 'DELETE'
    });
    
    await supabaseAdmin
      .from('notifications')
      .delete()
      .like('data', `%${avaliacaoId}%`);
    
    console.log('  ✅ Test data cleaned up');
    
    const notificationSuccessRate = (notificationTestsPassed / totalNotificationTests * 100).toFixed(2);
    console.log(`\n📧 Notification Tests Summary: ${notificationTestsPassed}/${totalNotificationTests} passed (${notificationSuccessRate}%)`);
    
    return notificationTestsPassed === totalNotificationTests;
    
  } catch (error) {
    console.error('❌ Notification system testing error:', error.message);
    logTest('Notification System Testing', false, error.message);
    return false;
  }
}

/**
 * Phase 4: Frontend-Backend Integration Testing
 */
async function testFrontendBackendIntegration() {
  console.log('\n=== PHASE 4: FRONTEND-BACKEND INTEGRATION TESTING ===');
  
  try {
    // Test 4.1: Simulate frontend data fetching
    console.log('\n4.1 Testing frontend data fetching simulation...');
    
    // This simulates what the EvaluationDashboard component does
    const { data: evaluations, error: fetchError } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select(`
        id,
        funcionario_id,
        avaliador_id,
        periodo,
        periodo_nome,
        data_inicio,
        data_fim,
        status,
        pontuacao_total,
        observacoes,
        created_at,
        updated_at,
        funcionario_nome,
        funcionario_cargo,
        funcionario_departamento,
        avaliador_nome,
        avaliador_cargo
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (fetchError) {
      console.error('  ❌ Error fetching data like frontend:', fetchError.message);
      logTest('Frontend Data Fetching', false, fetchError.message);
      return false;
    }
    
    console.log(`  📊 Retrieved ${evaluations?.length || 0} evaluations`);
    
    if (evaluations && evaluations.length > 0) {
      // Test data structure compatibility with frontend
      const firstEval = evaluations[0];
      const requiredFields = [
        'id', 'funcionario_id', 'avaliador_id', 'periodo', 'status',
        'funcionario_nome', 'funcionario_cargo', 'avaliador_nome'
      ];
      
      let allFieldsPresent = true;
      requiredFields.forEach(field => {
        if (firstEval[field] === undefined || firstEval[field] === null) {
          console.log(`  ❌ Missing field: ${field}`);
          allFieldsPresent = false;
        } else {
          console.log(`  ✅ Field present: ${field}`);
        }
      });
      
      if (allFieldsPresent) {
        logTest('Frontend Data Structure Compatibility', true, 'All required fields are present');
      } else {
        logTest('Frontend Data Structure Compatibility', false, 'Some required fields are missing');
      }
      
      // Test data filtering (simulating frontend filters)
      console.log('\n4.2 Testing data filtering simulation...');
      const { data: filteredEvaluations, error: filterError } = await supabase
        .from('vw_avaliacoes_desempenho')
        .select('*')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (filterError) {
        console.error('  ❌ Error filtering data:', filterError.message);
        logTest('Data Filtering', false, filterError.message);
      } else {
        console.log(`  📊 Found ${filteredEvaluations?.length || 0} pending evaluations`);
        logTest('Data Filtering', true, 'Data filtering works correctly');
      }
      
      // Test search functionality
      console.log('\n4.3 Testing search functionality simulation...');
      const { data: searchResults, error: searchError } = await supabase
        .from('vw_avaliacoes_desempenho')
        .select('*')
        .or(`funcionario_nome.ilike.%test%,periodo.ilike.%${TEST_PERIODO}%`)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (searchError) {
        console.error('  ❌ Error searching data:', searchError.message);
        logTest('Search Functionality', false, searchError.message);
      } else {
        console.log(`  🔍 Found ${searchResults?.length || 0} evaluations matching search criteria`);
        logTest('Search Functionality', true, 'Search functionality works correctly');
      }
      
      return allFieldsPresent;
    } else {
      logTest('Frontend Data Fetching', false, 'No evaluations found to test with');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Frontend-backend integration testing error:', error.message);
    logTest('Frontend-Backend Integration', false, error.message);
    return false;
  }
}

/**
 * Phase 5: Original Issue Resolution Verification
 */
async function testOriginalIssueResolution() {
  console.log('\n=== PHASE 5: ORIGINAL ISSUE RESOLUTION VERIFICATION ===');
  
  try {
    // Test 5.1: Check if system can list evaluations without errors
    console.log('\n5.1 Testing evaluation listing without errors...');
    
    const { data: evaluations, error: listError } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (listError) {
      console.error('  ❌ Error listing evaluations:', listError.message);
      logTest('Evaluation Listing Without Errors', false, listError.message);
      return false;
    }
    
    console.log(`  📊 Successfully listed ${evaluations?.length || 0} evaluations without errors`);
    
    // Test 5.2: Check if user information is properly displayed
    console.log('\n5.2 Testing user information display...');
    
    if (evaluations && evaluations.length > 0) {
      const firstEval = evaluations[0];
      let userInfoComplete = true;
      
      // Check employee information
      if (!firstEval.funcionario_nome || !firstEval.funcionario_cargo) {
        console.log('  ❌ Employee information incomplete');
        userInfoComplete = false;
      } else {
        console.log(`  ✅ Employee info: ${firstEval.funcionario_nome} (${firstEval.funcionario_cargo})`);
      }
      
      // Check evaluator information
      if (!firstEval.avaliador_nome || !firstEval.avaliador_cargo) {
        console.log('  ❌ Evaluator information incomplete');
        userInfoComplete = false;
      } else {
        console.log(`  ✅ Evaluator info: ${firstEval.avaliador_nome} (${firstEval.avaliador_cargo})`);
      }
      
      // Check department information
      if (firstEval.funcionario_departamento) {
        console.log(`  ✅ Department info: ${firstEval.funcionario_departamento}`);
      } else {
        console.log('  ⚠️  Department information not available (not critical)');
      }
      
      logTest('User Information Display', userInfoComplete, 
        userInfoComplete ? 'User information is properly displayed' : 'User information is incomplete');
    } else {
      logTest('User Information Display', false, 'No evaluations to test user information display');
    }
    
    // Test 5.3: Check for foreign key relationship errors
    console.log('\n5.3 Testing foreign key relationships...');
    
    // Try to create an evaluation with invalid foreign keys
    const invalidFuncionarioId = uuidv4();
    const invalidAvaliadorId = uuidv4();
    
    const { data: invalidEval, error: invalidError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .insert({
        funcionario_id: invalidFuncionarioId,
        avaliador_id: invalidAvaliadorId,
        periodo: TEST_PERIODO,
        status: 'pendente',
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        pontuacao_total: 0
      })
      .select()
      .single();
    
    if (invalidError) {
      console.log('  ✅ Foreign key constraint working: Invalid IDs rejected');
      console.log(`  📝 Error: ${invalidError.message}`);
      logTest('Foreign Key Relationship Validation', true, 'Foreign key constraints are working properly');
    } else {
      console.log('  ❌ Foreign key constraint not working: Invalid IDs accepted');
      logTest('Foreign Key Relationship Validation', false, 'Foreign key constraints are not working');
    }
    
    // Test 5.4: Check overall module functionality
    console.log('\n5.4 Testing overall evaluation module functionality...');
    
    // Test complete workflow: create -> update -> complete
    const workflowData = {
      funcionario_id: TEST_FUNCIONARIO_ID,
      avaliador_id: TEST_AVALIADOR_ID,
      periodo: TEST_PERIODO,
      status: 'pendente',
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      observacoes: 'End-to-end workflow test',
      pontuacao_total: 0
    };
    
    // Create
    const { data: workflowEval, error: createError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .insert(workflowData)
      .select()
      .single();
    
    if (createError || !workflowEval) {
      logTest('Complete Workflow Test', false, 'Failed to create evaluation for workflow test');
      return false;
    }
    
    console.log(`  ✅ Workflow evaluation created: ${workflowEval.id}`);
    
    // Update
    const { error: updateError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update({ 
        status: 'em_andamento',
        observacoes: 'Updated during workflow test'
      })
      .eq('id', workflowEval.id);
    
    if (updateError) {
      logTest('Complete Workflow Test', false, 'Failed to update evaluation in workflow test');
      // Clean up
      await supabaseAdmin
        .from('avaliacoes_desempenho')
        .delete()
        .eq('id', workflowEval.id);
      return false;
    }
    
    console.log('  ✅ Workflow evaluation updated');
    
    // Complete
    const { error: completeError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update({ 
        status: 'concluida',
        pontuacao_total: 90,
        observacoes: 'Completed during workflow test'
      })
      .eq('id', workflowEval.id);
    
    if (completeError) {
      logTest('Complete Workflow Test', false, 'Failed to complete evaluation in workflow test');
      // Clean up
      await supabaseAdmin
        .from('avaliacoes_desempenho')
        .delete()
        .eq('id', workflowEval.id);
      return false;
    }
    
    console.log('  ✅ Workflow evaluation completed');
    
    // Clean up
    await supabaseAdmin
      .from('avaliacoes_desempenho')
      .delete()
      .eq('id', workflowEval.id);
    
    console.log('  ✅ Workflow test cleaned up');
    
    logTest('Complete Workflow Test', true, 'Full evaluation workflow completed successfully');
    
    return true;
    
  } catch (error) {
    console.error('❌ Original issue resolution testing error:', error.message);
    logTest('Original Issue Resolution', false, error.message);
    return false;
  }
}

/**
 * Create test users if they don't exist
 */
async function createTestUsers() {
  console.log('\n=== SETTING UP TEST USERS ===');
  
  try {
    // Create test employee
    const { data: funcionario, error: funcError } = await supabaseAdmin
      .from('users_unified')
      .upsert({
        id: TEST_FUNCIONARIO_ID,
        first_name: 'Funcionário',
        last_name: 'Teste E2E',
        email: TEST_FUNCIONARIO_EMAIL,
        phone_number: TEST_FUNCIONARIO_PHONE,
        role: 'USER',
        position: 'Desenvolvedor Senior',
        department: 'TI',
        active: true,
        is_authorized: true,
        authorization_status: 'active'
      })
      .select()
      .single();

    if (funcError) {
      console.error('❌ Error creating test employee:', funcError.message);
      return false;
    }
    
    console.log(`✅ Test employee created/updated: ${funcionario.first_name} ${funcionario.last_name}`);

    // Create test evaluator
    const { data: avaliador, error: avalError } = await supabaseAdmin
      .from('users_unified')
      .upsert({
        id: TEST_AVALIADOR_ID,
        first_name: 'Avaliador',
        last_name: 'Teste E2E',
        email: TEST_AVALIADOR_EMAIL,
        phone_number: TEST_AVALIADOR_PHONE,
        role: 'MANAGER',
        position: 'Gerente de TI',
        department: 'TI',
        active: true,
        is_authorized: true,
        authorization_status: 'active'
      })
      .select()
      .single();

    if (avalError) {
      console.error('❌ Error creating test evaluator:', avalError.message);
      return false;
    }
    
    console.log(`✅ Test evaluator created/updated: ${avaliador.first_name} ${avaliador.last_name}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error creating test users:', error.message);
    return false;
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('\n=== CLEANING UP TEST DATA ===');
  
  try {
    // Delete test users
    await supabaseAdmin
      .from('users_unified')
      .delete()
      .in('id', [TEST_FUNCIONARIO_ID, TEST_AVALIADOR_ID]);
    
    console.log('✅ Test users cleaned up');
    
    // Delete any test evaluations
    await supabaseAdmin
      .from('avaliacoes_desempenho')
      .delete()
      .in('funcionario_id', [TEST_FUNCIONARIO_ID, TEST_AVALIADOR_ID]);
    
    console.log('✅ Test evaluations cleaned up');
    
    // Delete any test notifications
    await supabaseAdmin
      .from('notifications')
      .delete()
      .in('user_id', [TEST_FUNCIONARIO_ID, TEST_AVALIADOR_ID]);
    
    console.log('✅ Test notifications cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 STARTING COMPREHENSIVE END-TO-END EVALUATION MODULE TESTING');
  console.log('========================================================================');
  testResults.startTime = new Date();
  
  try {
    // Setup test users
    const usersCreated = await createTestUsers();
    if (!usersCreated) {
      console.error('❌ Failed to create test users. Aborting tests.');
      return false;
    }
    
    // Run all test phases
    const phase1Result = await testDatabaseViewFunctionality();
    const phase2Result = await testApiEndpoints();
    const phase3Result = await testNotificationSystem();
    const phase4Result = await testFrontendBackendIntegration();
    const phase5Result = await testOriginalIssueResolution();
    
    // Clean up test data
    await cleanupTestData();
    
    // Calculate final results
    testResults.endTime = new Date();
    const duration = (testResults.endTime - testResults.startTime) / 1000; // in seconds
    
    console.log('\n\n========================================================================');
    console.log('🏁 COMPREHENSIVE END-TO-END TEST RESULTS');
    console.log('========================================================================');
    
    console.log(`⏱️  Test Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Total Tests: ${testResults.passed + testResults.failed}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2)}%`);
    
    console.log('\n📋 PHASE RESULTS:');
    console.log(`   Phase 1 - Database View Functionality: ${phase1Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Phase 2 - API Endpoints: ${phase2Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Phase 3 - Notification System: ${phase3Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Phase 4 - Frontend-Backend Integration: ${phase4Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Phase 5 - Original Issue Resolution: ${phase5Result ? '✅ PASS' : '❌ FAIL'}`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      testResults.details
        .filter(detail => !detail.passed)
        .forEach(detail => {
          console.log(`   - ${detail.test}: ${detail.details}`);
          console.log(`     Timestamp: ${detail.timestamp}`);
        });
    }
    
    const overallSuccess = phase1Result && phase2Result && phase3Result && phase4Result && phase5Result;
    
    console.log('\n🎯 OVERALL ASSESSMENT:');
    if (overallSuccess) {
      console.log('✅ ALL TESTS PASSED - Evaluation module is fully functional!');
      console.log('✅ The evaluation module has been successfully implemented and tested.');
      console.log('✅ All components are working together correctly.');
      console.log('✅ The original issue has been resolved.');
    } else {
      console.log('❌ SOME TESTS FAILED - Evaluation module needs attention.');
      console.log('❌ Review failed tests and address the issues.');
      console.log('❌ Some components may not be working correctly.');
    }
    
    console.log('\n📝 RECOMMENDATIONS:');
    if (overallSuccess) {
      console.log('   - The evaluation module is ready for production use');
      console.log('   - Regular monitoring is recommended');
      console.log('   - Consider implementing automated regression testing');
    } else {
      console.log('   - Address all failed tests before deployment');
      console.log('   - Pay special attention to database view and API integration');
      console.log('   - Ensure notification system is working correctly');
    }
    
    console.log('\n========================================================================');
    console.log('🏁 END-TO-END TESTING COMPLETED');
    console.log('========================================================================');
    
    return overallSuccess;
    
  } catch (error) {
    console.error('❌ Fatal error during testing:', error.message);
    return false;
  }
}

// Execute all tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});