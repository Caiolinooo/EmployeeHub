// Help content data for the Portal ABZ Help Widget
// Based on the official Help Center document from ABZ Group

export interface HelpArticle {
    id: string;
    title: string;
    content: string;
    category: string;
    keywords: string[];
    images?: string[]; // Optional array of image paths
}

export interface HelpCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    articles: HelpArticle[];
}

import { helpCategoriesEn } from './helpContentEn';

export const helpCategoriesPt: HelpCategory[] = [
    // ==========================================
    // CATEGORIA: PORTAL ABZ
    // ==========================================
    {
        id: 'onboarding',
        name: 'Onboarding',
        description: 'Primeiros passos no Portal ABZ',
        icon: 'FiLogIn',
        articles: [
            {
                id: 'o-que-e-portal',
                title: 'O que é o Portal ABZ?',
                content: `
## O que é o Portal ABZ?

O **Portal ABZ** é um centro de informações exclusivo para colaboradores da ABZ Group.

### O que você encontra no portal:

- 📋 **Procedimentos** - Manuais e guias operacionais
- 📜 **Políticas** - Normas e regulamentos da empresa
- 📅 **Calendário** - Eventos e datas importantes
- 📰 **ABZ News** - Notícias e comunicados
- 💰 **Reembolsos** - Solicitação e acompanhamento
- 🎓 **Academia** - Treinamentos e cursos
- 📊 **Avaliação** - Desempenho e feedback

### Acesso

Acesse pelo link: **https://portal.groupabz.com**
        `,
                category: 'onboarding',
                keywords: ['portal', 'abz', 'o que é', 'início', 'sobre']
            },
            {
                id: 'instalar-app',
                title: 'Como fazer download do App Portal ABZ?',
                content: `
## Instalando o App Portal ABZ

O Portal ABZ pode ser instalado como um aplicativo no seu computador ou celular para acesso rápido.

### Passo a passo:

1. **Acesse o portal** pelo navegador:
   - Link: \`https://portal.groupabz.com/dashboard\`

2. **Clique no ícone de instalação**:
   - No Chrome/Edge: clique no ícone de **"Instalar aplicativo"** na barra de endereço (ao lado do ícone de lupa)

3. **Confirme a instalação**:
   - Clique em **"Instalar"**
   - Marque **"Fixar na barra de tarefas"** (opcional)
   - Clique em **"Permitir"**

4. **Pronto!**
   - O app aparecerá no seu menu iniciar e/ou área de trabalho

### Dica

Para celular, acesse o portal pelo navegador Chrome e use a opção "Adicionar à tela inicial".
        `,
                category: 'onboarding',
                keywords: ['app', 'instalar', 'download', 'aplicativo', 'pwa'],
                images: [
                    '/images/help/instalar-app-1.png',
                    '/images/help/instalar-app-2.png',
                    '/images/help/instalar-app-3.png'
                ]
            },
            {
                id: 'mudar-senha',
                title: 'Como mudar a senha inicial?',
                content: `
## Alterando sua Senha

Para maior segurança, recomendamos alterar sua senha inicial.

### Passo a passo:

1. **Clique no seu perfil** (canto inferior esquerdo da tela)

2. **Role a página até encontrar "Alterar Senha"**

3. **Preencha os campos**:
   - Senha atual
   - Nova senha (mínimo 8 caracteres)
   - Confirmar nova senha

4. **Clique em "Alterar Senha"**

### Requisitos da senha:

- ✅ Mínimo de **8 caracteres**
- ✅ Recomendado: letras, números e símbolos

### Esqueceu a senha?

Use a opção **"Esqueci minha senha"** na tela de login para receber um email de recuperação.
        `,
                category: 'onboarding',
                keywords: ['senha', 'mudar', 'alterar', 'trocar', 'password'],
                images: [
                    '/images/help/alterar-senha.png'
                ]
            },
            {
                id: 'reportar-erros',
                title: 'Como reportar erros?',
                content: `
## Reportando Erros no Portal

Encontrou um problema? Nos ajude a melhorar o portal reportando o erro.

### Passo a passo:

1. **Clique no botão de Ajuda** (ícone de interrogação no canto inferior direito)

2. **Acesse a aba "Mensagens"**

3. **Selecione "Reportar um erro/bug"**

4. **Descreva o problema**:
   - O que você estava tentando fazer
   - O que aconteceu de errado
   - Qual era o comportamento esperado

5. **Opcionalmente**:
   - Use **"Capturar Tela"** para tirar um print
   - Anexe arquivos se necessário

6. **Clique em "Enviar"**

### Dados enviados automaticamente:

- URL da página atual
- Informações do navegador
- Erros do console (se houver)
        `,
                category: 'onboarding',
                keywords: ['erro', 'bug', 'problema', 'reportar', 'ajuda'],
                images: [
                    '/images/help/reportar-erro.png'
                ]
            }
        ]
    },
    {
        id: 'reembolso',
        name: 'Reembolso',
        description: 'Solicitação e acompanhamento de reembolsos',
        icon: 'FiDollarSign',
        articles: [
            {
                id: 'preencher-formulario',
                title: 'Como preencher o formulário de reembolso?',
                content: `
## Preenchendo o Formulário de Reembolso

Siga os passos abaixo para solicitar seu reembolso corretamente.

### Passo a passo:

1. **Acesse o card "Reembolso"** no dashboard

2. **Confira seus dados pessoais**:
   - Nome, email, telefone
   - Corrija se necessário

3. **Insira seu CPF** (obrigatório)

4. **Adicione as despesas**:
   - Clique em **"Adicionar Despesa"**
   - Selecione o **tipo** (alimentação, transporte, etc.)
   - Informe a **data** da despesa
   - Digite o **valor**
   - Adicione uma **justificativa**
   - **Anexe o comprovante** (foto da nota fiscal)

5. **Adicione mais despesas se necessário**
   - Você pode incluir múltiplas despesas em um único pedido

6. **Escolha a forma de pagamento**:
   - **Depósito bancário**: informe banco, agência e conta
   - **PIX**: informe tipo e chave PIX

7. **Revise e envie**:
   - Clique em **"Enviar Solicitação"**

### Importante:

- Anexe comprovantes legíveis (nota fiscal ou cupom)
- O valor deve ser exatamente igual ao do comprovante
        `,
                category: 'reembolso',
                keywords: ['reembolso', 'formulário', 'preencher', 'despesa', 'solicitar'],
                images: [
                    '/images/help/reembolso-formulario.png',
                    '/images/help/reembolso-adicionar.png'
                ]
            },
            {
                id: 'verificar-status',
                title: 'Como verificar o status do meu reembolso?',
                content: `
## Verificando o Status do Reembolso

Acompanhe o andamento da sua solicitação de reembolso.

### Passo a passo:

1. **Acesse o card "Reembolso"** no dashboard

2. **Clique na aba "Meus Reembolsos"**

3. **Visualize suas solicitações**:
   - Cada linha mostra um pedido
   - Verifique a coluna **"Status"**

### Significado dos status:

- 🟡 **Pendente** - Aguardando análise do gestor
- 🔵 **Em Análise** - Sendo revisado
- 🟢 **Aprovado** - Aprovado, aguardando pagamento
- ✅ **Pago** - Valor depositado na sua conta
- 🔴 **Rejeitado** - Não aprovado (veja o motivo)

### Notificações:

- Você receberá um email a cada mudança de status
- Verifique também a caixa de spam
        `,
                category: 'reembolso',
                keywords: ['status', 'acompanhar', 'verificar', 'aprovado', 'pago', 'pendente'],
                images: [
                    '/images/help/reembolso-status.png'
                ]
            }
        ]
    },
    {
        id: 'contracheque',
        name: 'Contracheque',
        description: 'Acesso ao contracheque e recibos',
        icon: 'FiFileText',
        articles: [
            {
                id: 'acessar-contracheque',
                title: 'Como acessar meu contracheque?',
                content: `
## Acessando o Contracheque

O contracheque está disponível através do sistema WK Radar.

### Passo a passo:

1. **Acesse o link**:
   - \`http://wk.groupabz.com/radarwebnet\`

2. **Selecione** a opção **"Portal Empregado"**

3. **Faça login**:
   - **Usuário**: Seu CPF (apenas números)
   - **Senha**: \`1\` (no primeiro acesso)

4. **Clique em "Recibo"**

5. **Faça login novamente** (solicitação do sistema)

6. **Visualize ou imprima** seu contracheque

### Primeiro acesso:

- A senha inicial é **"1"**
- Recomendamos alterar a senha após o primeiro acesso

### Problemas de acesso?

- Verifique se o CPF está correto (sem pontos ou traços)
- Contate o RH se o problema persistir
        `,
                category: 'contracheque',
                keywords: ['contracheque', 'recibo', 'salário', 'holerite', 'wk', 'radar']
            }
        ]
    },

    // ==========================================
    // CATEGORIA: GERAL
    // ==========================================
    {
        id: 'rede-publica',
        name: 'Rede Pública (Drive Z:)',
        description: 'Acesso a arquivos e documentos compartilhados',
        icon: 'FiMonitor',
        articles: [
            {
                id: 'o-que-e-drive-z',
                title: 'O que é a Rede Pública (Z:)?',
                content: `
## Rede Pública - Drive Z:

O **Drive Z:** é o servidor interno de arquivos da ABZ Group.

### Como acessar:

1. **Abra o Explorador de Arquivos** do Windows

2. **Navegue até "Este Computador"**

3. **Procure por "Data-ABZ (Z:)"**

4. **Clique duas vezes** para abrir

### Estrutura de pastas:

- \`Z:\\1. Publico\` - Documentos públicos da empresa
- \`Z:\\1. Publico\\3. Modelos diversos\` - Templates editáveis
- \`Z:\\1. Publico\\4. Comunicação\` - Logotipos e identidade visual

### Importante:

- Nunca salve arquivos pessoais na rede pública
- Sempre crie uma **cópia** antes de editar um modelo
        `,
                category: 'rede-publica',
                keywords: ['drive', 'z', 'rede', 'público', 'arquivos', 'servidor'],
                images: [
                    '/images/help/rede-local.png',
                    '/images/help/rede-pastas.png',
                    '/images/help/rede-endereco.png'
                ]
            },
            {
                id: 'modelos-editaveis',
                title: 'Onde encontro modelos editáveis?',
                content: `
## Modelos Editáveis

Modelos de documentos padrão da empresa estão disponíveis na rede.

### Localização:

\`Z:\\1. Publico\\3. Modelos diversos\`

### O que você encontra:

- Modelos de apresentações
- Templates de documentos
- Assinatura de email padrão
- Outros formatos padrão

### Como usar:

1. **Navegue até a pasta** acima
2. **Encontre o modelo** desejado
3. **Copie o arquivo** para sua máquina ou outra pasta
4. **Edite a cópia** (nunca o original!)

> ⚠️ **Importante**: Sempre crie uma cópia antes de editar. Não modifique os arquivos originais da rede.
        `,
                category: 'rede-publica',
                keywords: ['modelo', 'template', 'editável', 'documento', 'padrão'],
                images: [
                    '/images/help/rede-modelos.png'
                ]
            },
            {
                id: 'logotipo-identidade',
                title: 'Onde encontro o logotipo e identidade visual?',
                content: `
## Logotipo e Identidade Visual

Materiais oficiais da marca ABZ Group.

### Localização:

\`Z:\\1. Publico\\4. Comunicação\`

### O que você encontra:

- 🎨 **Logotipos** em diversos formatos (PNG, JPG, PDF)
- 🔤 **Fontes** oficiais da empresa
- 🎯 **Ícones** e elementos gráficos
- 📖 **Manual da Marca** - Guia de uso da identidade visual

### Dicas:

- Use sempre os logotipos das versões mais recentes
- Consulte o manual da marca para uso correto
- Em caso de dúvidas, contate a equipe de Comunicação
        `,
                category: 'rede-publica',
                keywords: ['logo', 'logotipo', 'marca', 'identidade', 'visual', 'comunicação'],
                images: [
                    '/images/help/rede-comunicacao.png'
                ]
            }
        ]
    },
    {
        id: 'email',
        name: 'E-mail (Assinatura)',
        description: 'Configuração de assinatura de email',
        icon: 'FiFileText',
        articles: [
            {
                id: 'assinatura-outlook-classico',
                title: 'Como incluir assinatura no Outlook Clássico?',
                content: `
## Assinatura de E-mail - Outlook Clássico

Configure sua assinatura padrão da ABZ Group.

### Passo 1: Copiar o modelo

1. Acesse: \`Z:\\1. Publico\\3. Modelos diversos\`
2. Abra o arquivo: **"Assinatura de E-mail Padrão.docx"**
3. Selecione todo o conteúdo (Ctrl+A)
4. Copie (Ctrl+C)

### Passo 2: Configurar no Outlook

1. Abra o **Outlook**
2. Vá em **Arquivo** > **Opções** > **Email** > **Assinaturas**
3. Clique em **"Nova"**
4. Dê um nome (ex: "ABZ Padrão")
5. Cole a assinatura (Ctrl+V) na área de edição
6. **Atualize seus dados**:
   - Seu nome
   - Sua função/cargo
   - Seu WhatsApp (se aplicável)

### Passo 3: Definir como padrão

1. Em "Escolher assinatura padrão":
   - **Novas mensagens**: Selecione sua assinatura
   - **Respostas/encaminhamentos**: Selecione sua assinatura
2. Clique em **OK**
        `,
                category: 'email',
                keywords: ['assinatura', 'email', 'outlook', 'clássico', 'configurar'],
                images: [
                    '/images/help/outlook-menu.png',
                    '/images/help/outlook-opcoes.png',
                    '/images/help/outlook-assinatura.png'
                ]
            },
            {
                id: 'assinatura-novo-outlook',
                title: 'Como incluir assinatura no Novo Outlook?',
                content: `
## Assinatura de E-mail - Novo Outlook

Configure sua assinatura no novo Outlook (versão web/moderna).

### Passo 1: Copiar o modelo

1. Acesse: \`Z:\\1. Publico\\3. Modelos diversos\`
2. Abra: **"Assinatura de E-mail Padrão.docx"**
3. Selecione tudo (Ctrl+A) e copie (Ctrl+C)

### Passo 2: Configurar no Novo Outlook

1. Clique na **engrenagem** (Configurações) no canto superior direito
2. Vá em **Email** > **Criar e responder**
3. Role até **"Assinatura de email"**
4. Clique em **"Nova assinatura"**
5. Dê um nome (ex: "ABZ")
6. Cole a assinatura (Ctrl+V)
7. **Atualize seus dados**:
   - Nome
   - Cargo
   - WhatsApp

### Passo 3: Ativar

1. Marque a opção **"Incluir automaticamente em novas mensagens"**
2. Marque **"Incluir em respostas e encaminhamentos"**
3. Clique em **Salvar**
        `,
                category: 'email',
                keywords: ['assinatura', 'email', 'outlook', 'novo', 'web', 'configurar'],
                images: [
                    '/images/help/novo-outlook-config.png',
                    '/images/help/novo-outlook-assinatura.png',
                    '/images/help/novo-outlook-salvar.png'
                ]
            }
        ]
    },
    {
        id: 'teams',
        name: 'Teams',
        description: 'Configurações do Microsoft Teams',
        icon: 'FiMessageSquare',
        articles: [
            {
                id: 'fundo-reunioes',
                title: 'Como incluir fundo para reuniões?',
                content: `
## Fundo para Reuniões no Teams

Personalize o fundo das suas videochamadas.

### Onde encontrar fundos da ABZ:

Os fundos oficiais da ABZ estão em:
\`Z:\\1. Publico\\4. Comunicação\\Perfis e Capas\`

### Durante uma reunião:

1. Clique em **"Mais ações"** (três pontinhos)
2. Selecione **"Efeitos e avatares"** ou **"Aplicar efeitos de fundo"**
3. Escolha uma das opções:
   - **Desfocar** - Desfoca o fundo
   - **Imagem padrão** - Selecione uma das imagens do Teams
   - **Adicionar nova** - Carregue sua própria imagem

### Antes de uma reunião:

1. Ao entrar na reunião, antes de clicar em "Ingressar"
2. Ative a câmera
3. Clique em **"Filtros de fundo"**
4. Escolha ou carregue uma imagem

### Dica:

Baixe os fundos da pasta da rede para seu computador antes de usar no Teams.
        `,
                category: 'teams',
                keywords: ['teams', 'fundo', 'reunião', 'video', 'background']
            },
            {
                id: 'foto-perfil-teams',
                title: 'Como alterar foto de perfil no Teams?',
                content: `
## Alterando Foto de Perfil no Teams

Atualize sua foto de perfil para facilitar a identificação.

### Passo a passo:

1. **Abra o Teams**

2. **Clique na sua foto/iniciais** (canto superior direito)

3. **Clique na foto novamente** ou em **"Alterar foto"**

4. **Escolha uma das opções**:
   - **Carregar foto** - Selecione uma imagem do seu computador
   - **Tirar foto** - Use a webcam para tirar uma nova foto

5. **Ajuste o enquadramento** (se necessário)

6. **Clique em "Salvar"**

### Dicas para a foto:

- Use uma foto profissional
- Fundo neutro de preferência
- Rosto centralizado e visível
- Boa iluminação
        `,
                category: 'teams',
                keywords: ['teams', 'foto', 'perfil', 'avatar', 'imagem']
            }
        ]
    },

    // ==========================================
    // CATEGORIA: INDICADORES R&S
    // ==========================================
    {
        id: 'indicadores-rs',
        name: 'Indicadores R&S',
        description: 'Planilhas do Recrutamento & Seleção: importação, edição de linhas e KPIs de eficácia',
        icon: 'FiBarChart2',
        articles: [
            {
                id: 'rs-visao-geral',
                title: 'O que é o módulo Indicadores R&S?',
                content: `
## O que é o módulo Indicadores R&S?

O módulo **Indicadores R&S** centraliza as planilhas de vagas do **Recrutamento & Seleção** e transforma esses dados em indicadores de desempenho do processo de atendimento ao cliente.

### Onde encontrar:

1. Acesse o menu **Department**
2. Clique em **"Indicadores R&S"**

### O que você pode fazer:

- 📥 **Importar planilhas** - Carregue arquivos XLSX com as vagas do R&S
- 🗂️ **Gerenciar datasets** - Cada importação cria uma planilha (dataset) dividida em abas
- ✏️ **Editar linhas** - Corrija, inclua ou remova registros direto na grade
- 📊 **KPIs & Avaliação** - Acompanhe a eficácia de atendimento e veja o veredito do processo

### Quem acessa:

O acesso é controlado por permissões:

- 👁️ **indicadores.view** - Visualizar planilhas e dados
- ✏️ **indicadores.edit** - Editar linhas das abas
- 📥 **indicadores.import** - Importar e substituir planilhas
- ⚙️ **indicadores.admin** - Administração do módulo

### Dica:

Setores de R&S com o módulo liberado já visualizam a entrada no menu Department automaticamente.
        `,
                category: 'indicadores-rs',
                keywords: ['indicadores', 'r&s', 'recrutamento', 'seleção', 'vagas', 'módulo', 'kpi']
            },
            {
                id: 'rs-importar-planilha',
                title: 'Como importar uma planilha?',
                content: `
## Importando uma Planilha

A importação é feita por um assistente de **3 passos** a partir de um arquivo Excel.

### Pré-requisito:

- Permissão **indicadores.import**

### Passo a passo:

1. **Clique em "Importar planilha"** no cabeçalho da página

2. **Passo 1 - Arquivo**:
   - Selecione o arquivo **.xlsx** ou **.xls** do seu computador
   - Clique em **"Analisar"** para o sistema ler o arquivo

3. **Passo 2 - Revisão das abas**:
   - Confira a pré-visualização de cada aba do arquivo
   - Ajuste a **linha do cabeçalho** se a tabela não começar na primeira linha
   - **Selecione** apenas as abas que deseja importar

4. **Passo 3 - Confirmação**:
   - Defina o **nome do dataset** (como a planilha aparecerá na página)
   - Escolha o **modo de importação**:
     - **Criar nova planilha** - Gera um novo dataset
     - **Substituir planilha existente** - Atualiza um dataset já importado

### Conceitos importantes:

- 📁 **Dataset (planilha)** - O conjunto importado, exibido como um card na página
- 📑 **Abas** - As guias do arquivo Excel, importadas dentro do dataset
- 📃 **Linhas** - Os registros (vagas, substituições, retenção) de cada aba

### Reimportar ou excluir:

- Use **"Reimportar"** no card do dataset para atualizar os dados (modo substituir, mantendo o nome)
- Use **"Excluir"** no card para remover o dataset e todas as suas abas (ação sem desfazer)
        `,
                category: 'indicadores-rs',
                keywords: ['importar', 'planilha', 'xlsx', 'xls', 'dataset', 'aba', 'wizard', 'reimportar', 'excluir']
            },
            {
                id: 'rs-editar-linhas',
                title: 'Como editar linhas de uma aba?',
                content: `
## Editando Linhas de uma Aba

Os dados de cada aba são editados em uma grade, direto no portal — sem precisar baixar o arquivo novamente.

### Pré-requisito:

- Permissão **indicadores.edit**

### Passo a passo:

1. **Abra a aba** pelo chip do dataset no card correspondente

2. **Localize os registros**:
   - Use a **busca** para filtrar por qualquer valor
   - Clique nos títulos das colunas para **ordenar**

3. **Adicione uma linha**:
   - Clique em **"Nova linha"**
   - Preencha os campos e salve

4. **Edite uma linha**:
   - Clique na linha (ou no ícone de edição)
   - Ajuste os valores e salve

5. **Exclua uma linha**:
   - Clique no ícone de excluir e confirme
   - A exclusão é **lógica (soft delete)**: o registro sai da grade e dos KPIs, mas fica preservado no histórico

### Importante:

- As alterações valem para todos que acessam o módulo
- Linhas excluídas não entram mais no cálculo dos KPIs
        `,
                category: 'indicadores-rs',
                keywords: ['editar', 'linhas', 'grade', 'nova linha', 'excluir', 'soft delete', 'busca', 'ordenação']
            },
            {
                id: 'rs-kpis-avaliacao',
                title: 'Como ler os KPIs e a avaliação?',
                content: `
## Lendo os KPIs e a Avaliação

O painel de indicadores mede a **eficácia de atendimento**: o percentual de vagas enviadas ao cliente dentro do prazo.

### Como abrir:

1. Acesse um dataset na página **Indicadores R&S**
2. Clique no botão **"KPIs & Avaliação"** no cabeçalho

### Significado dos indicadores:

- 🎯 **Taxa de eficácia** - % de vagas enviadas ao cliente dentro do prazo da vaga
- ⏱️ **Tempo médio de envio** - Média de dias entre a abertura da vaga e o envio dos candidatos
- 📅 **Meta de envio** - **7 dias** para envio dos candidatos ao cliente
- ⏩ **Antecipação** - Quão antes do prazo os envios aconteceram, em média
- 🤝 **Retenção por cliente** - % de colaboradores que permaneceram (não precisaram de substituição)

### Níveis da avaliação:

- 🟢 **Excelente** - Eficácia ≥ 90%
- 🔵 **Bom** - Eficácia ≥ 75%
- 🟡 **Atenção** - Eficácia ≥ 55%
- 🔴 **Crítico** - Eficácia < 55%

### Importante:

Os KPIs nascem das **colunas reconhecidas** na importação: **status da vaga**, **tempo de envio** e **prazo**. Mantenha a planilha padronizada para que os indicadores sejam calculados corretamente.
        `,
                category: 'indicadores-rs',
                keywords: ['kpi', 'kpis', 'avaliação', 'eficácia', 'meta', 'prazo', 'retenção', 'tempo de envio', 'indicadores']
            }
        ]
    },
    // ==========================================
    {
        id: 'dp-folha',
        name: 'Rubricas & Folha (DP)',
        description: 'Rubricas, sincronização WK Radar, cálculo e aprovação da folha no DP',
        icon: 'FiFileText',
        articles: [
            {
                id: 'dp-folha-visao-geral',
                title: 'O que é a aba Rubricas & Folha no DP?',
                content: `
## O que é a aba Rubricas & Folha?

A aba **Rubricas & Folha** (menu **Department → Departamento Pessoal**) fecha o ciclo da folha dentro do DP: sincronizar dados do **WK Radar**, consolidar verbas dos módulos do portal (escala/embarque e férias), **calcular** a folha e submeter à **aprovação multi-assinatura**.

### Onde encontrar:

1. Acesse o menu **Department**
2. Clique em **"Departamento Pessoal"**
3. Abra a aba **"Rubricas & Folha"**

### Quem acessa:

O acesso é controlado por permissões do módulo **Folha de Pagamento**:

- 👁️ **folha.view** - Visualizar rubricas, planilhas e aprovações
- ✏️ **folha.edit** - Lançamentos, sincronização e rubricas
- ✅ **folha.approve** - Assinar/aprovar ou rejeitar folhas
- ⚙️ **folha.admin** - Configurar aprovadores e administração

### De onde vêm os dados:

- 🔗 **WK Radar** - Colaboradores e rubricas (sync via API ou importação de arquivo)
- 📋 **Escala/Embarque** - Dias ON/DBA/FI/STB/TRE do fechamento do portal
- 🌴 **Férias** - Afastamentos de férias aprovados no módulo de férias
- ✍️ **Lançamentos manuais** - Sempre preservados nos re-syncs

### Precedência:

Se o mesmo colaborador+rubrica vier do WK e dos módulos do portal, o valor do **WK vence** (é a fonte oficial de cálculo) e o item do portal é descartado com registro de auditoria.
        `,
                category: 'dp-folha',
                keywords: ['folha', 'dp', 'rubricas', 'wk', 'wkradar', 'sincronização', 'aprovação', 'módulo']
            },
            {
                id: 'dp-folha-fluxo',
                title: 'Como sincronizar, calcular e aprovar a folha?',
                content: `
## Fluxo completo: sincronizar → calcular → aprovar

Tudo acontece na aba **Rubricas & Folha** do DP, escolhendo **competência** (mês/ano) e **empresa/departamento**.

### Passo a passo:

1. **Sincronizar WK** - Puxa colaboradores e rubricas do WK Radar (precisa das credenciais configuradas) ou use **Importar arquivo** com a planilha exportada do WK

2. **Consolidação dos módulos** - O portal adiciona automaticamente as verbas da escala/embarque e das férias do mês (itens marcados como origem "portal")

3. **Calcular folha** - O motor calcula INSS (tabela de 2025 ou, desde janeiro/2026, Portaria MPS/MF 13/2026), IRRF (tabela progressiva, dedução simplificada e redutor da Lei 15.270/2025 até R$ 5.000), FGTS e líquido por colaborador e por natureza (mensal, 13º, férias, rescisão)

4. **Enviar para aprovação** - O modal lista os aprovadores; cada um assina com seu token até completar 100%

5. **Resultado** - Com todas as assinaturas, a folha fica **Aprovada** (com hash de integridade); um aprovador pode **Rejeitar** com motivo — a folha volta para ajuste

### Códigos não mapeados:

Se a planilha do WK trouxer um código de rubrica que não existe no portal, a sincronização é **abortada** com a lista dos códigos. Mapeie cada um no cadastro de rubricas (**Folha de Pagamento → Configurações → Rubricas**, campo "Código WK") e sincronize de novo. O portal **nunca cria** rubricas automaticamente.

### Re-sincronizar não perde dados:

Re-executar a sincronização substitui apenas os itens vindos do WK e dos módulos do portal. Lançamentos **manuais** permanecem intactos.
        `,
                category: 'dp-folha',
                keywords: ['sincronizar', 'calcular', 'aprovar', 'assinar', 'rejeitar', 'folha', 'fluxo', 'código', 'mapeamento']
            },
            {
                id: 'dp-folha-rubricas',
                title: 'Como criar e editar rubricas?',
                content: `
## Criando e editando rubricas

O cadastro de rubricas fica em **Folha de Pagamento → Configurações → Rubricas** e é a fonte única dos códigos usados pela folha e pelo mapeamento do WK.

### Pré-requisito:

- Permissão **folha.edit**

### Campos:

- **Código** e **Tipo** (provento/desconto/outros) - Formam a identidade da rubrica; ficam **bloqueados** depois que a rubrica tem lançamentos em folha
- **Nome e descrição** - Aparecem no holerite e nas telas
- **Tipo de cálculo**:
  - **Valor fixo** - Quantidade × valor
  - **Percentual** - % sobre a referência (ex.: adicional noturno 20%)
  - **Fórmula** - Chave de fórmula registrada (**dsr**, **reflexo**, **reflexo_he**)
  - **Legal** - Calculada pelo motor (INSS, IRRF, FGTS)
- **Código WK** - O código equivalente no WK Radar; é o que conecta a planilha do WK à rubrica do portal

### Desativar vs excluir:

- **Desativar** (exclusão lógica) - A rubrica sai das listas mas o histórico de lançamentos continua correto. É o comportamento padrão do botão excluir
- Rubricas **do sistema** (INSS, IRRF, FGTS) nunca devem ser desativadas
        `,
                category: 'dp-folha',
                keywords: ['rubrica', 'rubricas', 'criar', 'editar', 'código wk', 'fórmula', 'dsr', 'reflexo', 'fixed', 'percentual', 'legal', 'desativar']
            }
        ]
    }
];

// Helper function to search articles
export function searchHelpArticles(query: string, lang: string = 'pt'): HelpArticle[] {
    const lowerQuery = query.toLowerCase();
    const results: HelpArticle[] = [];

    const categories = lang === 'en' ? helpCategoriesEn : helpCategoriesPt;

    categories.forEach(category => {
        category.articles.forEach(article => {
            const matchesTitle = article.title.toLowerCase().includes(lowerQuery);
            const matchesContent = article.content.toLowerCase().includes(lowerQuery);
            const matchesKeywords = article.keywords.some(kw => kw.toLowerCase().includes(lowerQuery));

            if (matchesTitle || matchesContent || matchesKeywords) {
                results.push(article);
            }
        });
    });

    return results;
}

// Get all categories based on language
export function getHelpCategories(lang: string = 'pt'): HelpCategory[] {
    return lang === 'en' ? helpCategoriesEn : helpCategoriesPt;
}

// Get all articles flat
export function getAllArticles(lang: string = 'pt'): HelpArticle[] {
    const categories = lang === 'en' ? helpCategoriesEn : helpCategoriesPt;
    return categories.flatMap(cat => cat.articles);
}

// Get article by ID
export function getArticleById(id: string, lang: string = 'pt'): HelpArticle | undefined {
    const categories = lang === 'en' ? helpCategoriesEn : helpCategoriesPt;
    for (const category of categories) {
        const article = category.articles.find(a => a.id === id);
        if (article) return article;
    }
    return undefined;
}

// Get category by ID
export function getCategoryById(id: string, lang: string = 'pt'): HelpCategory | undefined {
    const categories = lang === 'en' ? helpCategoriesEn : helpCategoriesPt;
    return categories.find(cat => cat.id === id);
}
