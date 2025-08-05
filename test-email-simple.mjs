import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

async function testEmail() {
  console.log('🧪 Testando configuração de email...\n');

  console.log('📋 Configurações:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***CONFIGURADO***' : '❌ NÃO CONFIGURADO');
  console.log('');

  try {
    // Criar transporte
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    console.log('🔍 Verificando conexão...');
    await transporter.verify();
    console.log('✅ Conexão verificada com sucesso!');

    // Enviar email de teste
    console.log('📧 Enviando email de teste...');
    const info = await transporter.sendMail({
      from: `"ABZ Group Test" <${process.env.EMAIL_USER}>`,
      to: 'caiovaleriogoulartcorreia@gmail.com',
      subject: 'Teste de Configuração de Email - ' + new Date().toLocaleString('pt-BR'),
      text: 'Este é um teste para verificar se o sistema de email está funcionando.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #0066cc;">Teste de Email</h2>
          <p>Este é um teste para verificar se o sistema de email está funcionando.</p>
          <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          <p style="color: #666; font-size: 12px;">Se você recebeu este email, a configuração está correta!</p>
        </div>
      `
    });

    console.log('✅ Email enviado com sucesso!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.code) {
      console.error('Código:', error.code);
    }
  }
}

testEmail();
