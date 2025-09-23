import { createClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface ERPConnection {
  id: string;
  name: string;
  type: 'SAP' | 'Oracle' | 'Protheus' | 'Senior' | 'RM' | 'Datasul';
  endpoint: string;
  username: string;
  password_encrypted: string;
  status: 'connected' | 'disconnected' | 'error';
  last_sync: string | null;
  modules: string[];
  active: boolean;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  errors: number;
  errorDetails?: any[];
  duration: number;
}

export class ERPIntegrationManager {
  private static instance: ERPIntegrationManager;
  private connections = new Map<string, AxiosInstance>();

  static getInstance(): ERPIntegrationManager {
    if (!ERPIntegrationManager.instance) {
      ERPIntegrationManager.instance = new ERPIntegrationManager();
    }
    return ERPIntegrationManager.instance;
  }

  // Criptografar senha
  private encryptPassword(password: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ERP_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  // Descriptografar senha
  private decryptPassword(encryptedPassword: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ERP_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const [ivHex, encrypted] = encryptedPassword.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Criar nova conexão ERP
  async createConnection(connectionData: {
    name: string;
    type: ERPConnection['type'];
    endpoint: string;
    username: string;
    password: string;
    modules: string[];
    config?: Record<string, any>;
  }): Promise<ERPConnection> {
    const encryptedPassword = this.encryptPassword(connectionData.password);
    
    const { data, error } = await supabase
      .from('erp_connections')
      .insert([{
        name: connectionData.name,
        type: connectionData.type,
        endpoint: connectionData.endpoint,
        username: connectionData.username,
        password_encrypted: encryptedPassword,
        modules: connectionData.modules,
        config: connectionData.config || {},
        status: 'disconnected'
      }])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar conexão: ${error.message}`);
    
    return data;
  }

  // Testar conexão
  async testConnection(connectionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const connection = await this.getConnection(connectionId);
      const client = await this.createERPClient(connection);
      
      // Teste específico por tipo de ERP
      switch (connection.type) {
        case 'SAP':
          await this.testSAPConnection(client, connection);
          break;
        case 'Oracle':
          await this.testOracleConnection(client, connection);
          break;
        case 'Protheus':
          await this.testProtheusConnection(client, connection);
          break;
        case 'Senior':
          await this.testSeniorConnection(client, connection);
          break;
        default:
          throw new Error('Tipo de ERP não suportado');
      }

      // Atualizar status
      await supabase
        .from('erp_connections')
        .update({ status: 'connected' })
        .eq('id', connectionId);

      return { success: true, message: 'Conexão estabelecida com sucesso' };
    } catch (error) {
      // Atualizar status de erro
      await supabase
        .from('erp_connections')
        .update({ status: 'error' })
        .eq('id', connectionId);

      return { success: false, message: error.message };
    }
  }

  // Criar cliente HTTP para ERP
  private async createERPClient(connection: ERPConnection): Promise<AxiosInstance> {
    const password = this.decryptPassword(connection.password_encrypted);
    
    const client = axios.create({
      baseURL: connection.endpoint,
      timeout: 30000,
      auth: {
        username: connection.username,
        password: password
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Configurações específicas por tipo
    switch (connection.type) {
      case 'SAP':
        client.defaults.headers['X-CSRF-Token'] = 'Fetch';
        break;
      case 'Protheus':
        client.defaults.headers['Authorization'] = `Basic ${Buffer.from(`${connection.username}:${password}`).toString('base64')}`;
        break;
    }

    return client;
  }

  // Testes específicos por ERP
  private async testSAPConnection(client: AxiosInstance, connection: ERPConnection): Promise<void> {
    const response = await client.get('/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=1');
    if (response.status !== 200) {
      throw new Error('Falha na conexão SAP');
    }
  }

  private async testOracleConnection(client: AxiosInstance, connection: ERPConnection): Promise<void> {
    const response = await client.get('/fscmRestApi/resources/11.13.18.05/employees?limit=1');
    if (response.status !== 200) {
      throw new Error('Falha na conexão Oracle');
    }
  }

  private async testProtheusConnection(client: AxiosInstance, connection: ERPConnection): Promise<void> {
    const response = await client.get('/rest/api/framework/v1/health');
    if (response.status !== 200) {
      throw new Error('Falha na conexão Protheus');
    }
  }

  private async testSeniorConnection(client: AxiosInstance, connection: ERPConnection): Promise<void> {
    const response = await client.get('/SXI/G5Rest?server=http');
    if (response.status !== 200) {
      throw new Error('Falha na conexão Senior');
    }
  }

  // Sincronizar dados
  async syncData(connectionId: string, module: string): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsSynced = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    try {
      const connection = await this.getConnection(connectionId);
      const client = await this.createERPClient(connection);

      // Log início da sincronização
      const { data: syncLog } = await supabase
        .from('erp_sync_logs')
        .insert([{
          connection_id: connectionId,
          module,
          status: 'running',
          started_at: new Date().toISOString()
        }])
        .select()
        .single();

      // Sincronização específica por módulo
      switch (module) {
        case 'employees':
          ({ recordsSynced, errors } = await this.syncEmployees(client, connection));
          break;
        case 'departments':
          ({ recordsSynced, errors } = await this.syncDepartments(client, connection));
          break;
        case 'payroll':
          ({ recordsSynced, errors } = await this.syncPayroll(client, connection));
          break;
        case 'attendance':
          ({ recordsSynced, errors } = await this.syncAttendance(client, connection));
          break;
        default:
          throw new Error(`Módulo ${module} não suportado`);
      }

      const duration = Date.now() - startTime;

      // Atualizar log de sincronização
      await supabase
        .from('erp_sync_logs')
        .update({
          status: 'success',
          records_synced: recordsSynced,
          errors,
          completed_at: new Date().toISOString(),
          duration_ms: duration
        })
        .eq('id', syncLog.id);

      // Atualizar última sincronização
      await supabase
        .from('erp_connections')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', connectionId);

      return {
        success: true,
        recordsSynced,
        errors,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log de erro
      await supabase
        .from('erp_sync_logs')
        .update({
          status: 'error',
          error_details: { message: error.message },
          completed_at: new Date().toISOString(),
          duration_ms: duration
        });

      return {
        success: false,
        recordsSynced,
        errors: errors + 1,
        errorDetails: [error.message],
        duration
      };
    }
  }

  // Sincronizar funcionários
  private async syncEmployees(client: AxiosInstance, connection: ERPConnection): Promise<{ recordsSynced: number; errors: number }> {
    let recordsSynced = 0;
    let errors = 0;

    try {
      let endpoint = '';
      switch (connection.type) {
        case 'SAP':
          endpoint = '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner';
          break;
        case 'Oracle':
          endpoint = '/fscmRestApi/resources/11.13.18.05/employees';
          break;
        case 'Protheus':
          endpoint = '/rest/api/hrm/v1/employees';
          break;
        case 'Senior':
          endpoint = '/SXI/G5Rest/GlobalEmployee';
          break;
      }

      const response = await client.get(endpoint);
      const employees = this.parseEmployeeData(response.data, connection.type);

      for (const employee of employees) {
        try {
          await this.upsertEmployee(employee);
          recordsSynced++;
        } catch (error) {
          console.error('Erro ao sincronizar funcionário:', error);
          errors++;
        }
      }
    } catch (error) {
      console.error('Erro na sincronização de funcionários:', error);
      errors++;
    }

    return { recordsSynced, errors };
  }

  // Sincronizar departamentos
  private async syncDepartments(client: AxiosInstance, connection: ERPConnection): Promise<{ recordsSynced: number; errors: number }> {
    // Implementação similar aos funcionários
    return { recordsSynced: 0, errors: 0 };
  }

  // Sincronizar folha de pagamento
  private async syncPayroll(client: AxiosInstance, connection: ERPConnection): Promise<{ recordsSynced: number; errors: number }> {
    // Implementação similar aos funcionários
    return { recordsSynced: 0, errors: 0 };
  }

  // Sincronizar ponto
  private async syncAttendance(client: AxiosInstance, connection: ERPConnection): Promise<{ recordsSynced: number; errors: number }> {
    // Implementação similar aos funcionários
    return { recordsSynced: 0, errors: 0 };
  }

  // Parsear dados de funcionários por tipo de ERP
  private parseEmployeeData(data: any, erpType: ERPConnection['type']): any[] {
    switch (erpType) {
      case 'SAP':
        return data.d?.results || [];
      case 'Oracle':
        return data.items || [];
      case 'Protheus':
        return data.employees || [];
      case 'Senior':
        return data.employees || [];
      default:
        return [];
    }
  }

  // Inserir/atualizar funcionário
  private async upsertEmployee(employeeData: any): Promise<void> {
    const { error } = await supabase
      .from('users_unified')
      .upsert([{
        external_id: employeeData.id,
        name: employeeData.name,
        email: employeeData.email,
        department: employeeData.department,
        position: employeeData.position,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'external_id'
      });

    if (error) throw error;
  }

  // Obter conexão
  private async getConnection(connectionId: string): Promise<ERPConnection> {
    const { data, error } = await supabase
      .from('erp_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (error || !data) throw new Error('Conexão não encontrada');
    return data;
  }

  // Listar conexões
  async getConnections(): Promise<ERPConnection[]> {
    const { data, error } = await supabase
      .from('erp_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao buscar conexões: ${error.message}`);
    return data || [];
  }

  // Obter logs de sincronização
  async getSyncLogs(connectionId?: string): Promise<any[]> {
    let query = supabase
      .from('erp_sync_logs')
      .select('*, erp_connections(name)')
      .order('started_at', { ascending: false });

    if (connectionId) {
      query = query.eq('connection_id', connectionId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao buscar logs: ${error.message}`);
    return data || [];
  }
}

export default ERPIntegrationManager.getInstance();
