// Script para verificar a senha do administrador
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Configurações
const MONGODB_URI = "mongodb+srv://apiabzgroup:Cli%40212202%40@abzpainel.dz8sggk.mongodb.net/?retryWrites=true&w=majority&appName=ABZPainel";
const ADMIN_PHONE = '+5522997847289';
const PASSWORD_TO_CHECK = 'Caio@2122@';

async function verifyPassword() {
  try {
    // Conectar ao MongoDB
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB com sucesso!');

    // Buscar o usuário administrador
    console.log(`Buscando usuário com telefone: ${ADMIN_PHONE}`);
    const user = await mongoose.connection.collection('users').findOne({ phoneNumber: ADMIN_PHONE });
    
    if (!user) {
      console.log('Usuário não encontrado!');
      return;
    }
    
    console.log('Usuário encontrado:');
    console.log('- ID:', user._id);
    console.log('- Nome:', user.firstName, user.lastName);
    console.log('- Email:', user.email);
    console.log('- Senha (hash):', user.password);
    
    // Verificar a senha
    console.log(`\nVerificando senha: ${PASSWORD_TO_CHECK}`);
    const isMatch = await bcrypt.compare(PASSWORD_TO_CHECK, user.password);
    console.log('Resultado da verificação:', isMatch ? 'SENHA CORRETA' : 'SENHA INCORRETA');
    
    // Se a senha estiver incorreta, vamos redefinir
    if (!isMatch) {
      console.log('\nRedefinindo a senha...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(PASSWORD_TO_CHECK, salt);
      
      const result = await mongoose.connection.collection('users').updateOne(
        { phoneNumber: ADMIN_PHONE },
        { 
          $set: { 
            password: hashedPassword,
            passwordLastChanged: new Date()
          } 
        }
      );
      
      console.log('Senha redefinida com sucesso!');
      console.log('Nova senha (hash):', hashedPassword);
      
      // Verificar a nova senha
      const updatedUser = await mongoose.connection.collection('users').findOne({ phoneNumber: ADMIN_PHONE });
      const isNewMatch = await bcrypt.compare(PASSWORD_TO_CHECK, updatedUser.password);
      console.log('Verificação da nova senha:', isNewMatch ? 'SENHA CORRETA' : 'SENHA INCORRETA');
    }
    
  } catch (error) {
    console.error('Erro ao verificar senha:', error);
  } finally {
    // Fechar a conexão
    await mongoose.connection.close();
    console.log('\nConexão com o MongoDB fechada.');
  }
}

// Executar a função
verifyPassword();
