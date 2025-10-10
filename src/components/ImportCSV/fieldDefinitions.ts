// Definições de campos para importação

export const userFieldDefinitions = {
  required: [
    'firstName',
    'lastName'
  ],
  optional: [
    'email',
    'phoneNumber',
    'position',
    'department',
    'role',
    'active'
  ],
  alternatives: {
    'firstName': ['nome', 'first_name', 'firstname', 'Nome', 'primeiro_nome'],
    'lastName': ['sobrenome', 'last_name', 'lastname', 'surname', 'Sobrenome'],
    'email': ['e-mail', 'mail', 'email_address', 'endereco_email', 'Nome UPN', 'email'],
    'phoneNumber': ['telefone', 'phone', 'phone_number', 'celular', 'mobile', 'tel', 'fone', 'Telefone Celular', {t('components.numeroDeTelefone')}],
    'position': ['cargo', 'position', 'job_title', 'funcao', 'job', 'titulo', {t('components.titulo')}],
    'department': ['departamento', 'department', 'dept', 'setor', 'area', 'Departamento'],
    'role': ['funcao', 'role', 'papel', 'nivel_acesso', 'access_level'],
    'active': ['ativo', 'active', 'status', 'situacao', 'state']
  }
};

export const avaliacaoFieldDefinitions = {
  required: [
    'funcionarioId',
    'avaliadorId',
    'periodo',
    'dataAvaliacao'
  ],
  optional: [
    'pontuacao',
    'status',
    'observacoes',
    'criterios',
    'nome_funcionario',  // Nome do funcionário (para referência)
    'nome_avaliador'     // Nome do avaliador (para referência)
  ],
  alternatives: {
    'funcionarioId': ['funcionario_id', 'id_funcionario', 'employee_id', 'id_employee', 'id_avaliado', 'avaliado_id'],
    'avaliadorId': ['avaliador_id', 'id_avaliador', 'evaluator_id', 'id_evaluator', 'manager_id', 'id_gestor', 'gestor_id'],
    'periodo': ['period', 'periodo_avaliacao', 'evaluation_period', 'ciclo', 'cycle', 'trimestre', 'quarter'],
    'dataAvaliacao': ['data_avaliacao', 'evaluation_date', 'data', 'date', 'data_realizacao', 'realizada_em'],
    'pontuacao': ['score', 'nota', 'rating', 'points', 'estrelas', 'stars', 'valor', 'value'],
    'status': ['state', 'situacao', 'status_avaliacao', 'concluida', 'completed'],
    'observacoes': ['notes', 'comments', 'obs', 'comentarios', 'anotacoes', 'feedback', 'consideracoes'],
    'criterios': ['criteria', 'criterios_avaliacao', 'evaluation_criteria', 'itens_avaliados', 'items'],
    'nome_funcionario': ['funcionario', 'employee', 'avaliado', 'nome_avaliado', 'employee_name', 'nome_do_funcionario'],
    'nome_avaliador': ['avaliador', 'evaluator', 'gestor', 'manager', 'nome_do_avaliador', 'evaluator_name']
  }
};

export const criterioFieldDefinitions = {
  required: [
    'nome',
    'descricao',
    'peso'
  ],
  optional: [
    'categoria',
    'status'
  ],
  alternatives: {
    'nome': ['name', 'criterio', 'criteria', 'titulo', 'title'],
    'descricao': ['description', 'desc', 'detalhes', 'details'],
    'peso': ['weight', 'ponderacao', 'importance', 'valor', 'value'],
    'categoria': ['category', 'grupo', 'group', 'tipo', 'type'],
    'status': ['state', 'situacao', 'ativo', 'active']
  }
};
