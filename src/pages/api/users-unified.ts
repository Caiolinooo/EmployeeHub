import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API de usuários unificados para o painel de administração iniciada (endpoint raiz)');

  // Verificar método
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Formato de autorização inválido. Use: Bearer <token>' });
    }
    
    const token = tokenParts[1];
    if (!token) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    console.log('Token recebido:', token.substring(0, 10) + '...');

    // Verificar token
    const tokenResult = await verifyToken(token);
    if (!tokenResult.valid) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    console.log('Token válido, buscando usuário com ID:', tokenResult.userId);

    // Verificar se o usuário é administrador
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('role')
      .eq('id', tokenResult.userId)
      .single();

    if (userError || !userData) {
      console.error('Erro ao buscar usuário:', userError);
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    if (userData.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar esta API.' });
    }

    console.log('Usuário é administrador, buscando todos os usuários');

    // Buscar todos os usuários
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError);
      return res.status(500).json({ error: 'Erro ao buscar usuários' });
    }

    console.log(`Encontrados ${users?.length || 0} usuários`);

    // Mapear os dados para o formato esperado pelo componente
    const mappedUsers = users?.map(user => ({
      _id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phoneNumber: user.phone_number,
      role: user.role,
      position: user.position,
      department: user.department,
      active: user.active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      accessPermissions: user.access_permissions,
      isAuthorized: user.is_authorized,
      authorizationStatus: user.authorization_status
    })) || [];

    console.log('Dados mapeados com sucesso');

    return res.status(200).json(mappedUsers);
  } catch (error) {
    console.error('Erro na API de usuários unificados:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
