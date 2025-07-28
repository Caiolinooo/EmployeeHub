// Script para redefinir a senha do administrador
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Configurações
const MONGODB_URI = "mongodb+srv://apiabzgroup:Cli%40212202%40@abzpainel.dz8sggk.mongodb.net/?retryWrites=true&w=majority&appName=ABZPainel";
const ADMIN_PHONE = '+5522997847289';
const NEW_PASSWORD = 'Caio@2122@';

async function resetPassword() {
  try {
    // Conectar ao MongoDB
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB com sucesso!');

    // Gerar hash da senha
    console.log('Gerando hash da senha...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);
    
    // Atualizar o usuário diretamente
    console.log('Atualizando senha do administrador...');
    const result = await mongoose.connection.collection('users').updateOne(
      { phoneNumber: ADMIN_PHONE },
      { 
        $set: { 
          password: hashedPassword,
          passwordLastChanged: new Date()
        } 
      }
    );
    
    console.log('Resultado da atualização:', result);
    
    if (result.matchedCount > 0) {
      console.log('Senha do administrador atualizada com sucesso!');
    } else {
      console.log('Usuário administrador não encontrado!');
    }
    
  } catch (error) {
    console.error('Erro ao redefinir a senha:', error);
  } finally {
    // Fechar a conexão
    await mongoose.connection.close();
    console.log('Conexão com o MongoDB fechada.');
  }
}

// Executar a função
resetPassword();
