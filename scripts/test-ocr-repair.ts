import {
  validarCPF,
  validarCNPJ,
  repararCPFOptico,
  extrairCPFInteligente,
  extrairResultadoInteligente,
  extrairDataNascimentoInteligente,
  extrairRGInteligente,
  extrairMedicoECRMInteligente,
  extrairCNPJInteligente,
} from '../src/lib/ocr/ocr-repair';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

console.log('--- 1. TESTE DE VALIDAÇÃO MÓDULO 11 ---');
assert(validarCPF('15415697764') === true, 'CPF válido do Caio (15415697764) deve retornar true');
assert(validarCPF('15415687764') === false, 'CPF com erro OCR (15415687764) deve retornar false');
assert(validarCPF('11111111111') === false, 'CPF com dígitos repetidos (11111111111) deve retornar false');

console.log('--- 2. TESTE DE REPARO ÓPTICO SEM PROFILE CPF ---');
const reparoSemAlvo = repararCPFOptico('15415687764');
console.log('Reparo sem alvo:', reparoSemAlvo);
assert(reparoSemAlvo !== null && reparoSemAlvo.cpf === '15415697764', 'Deve reparar 15415687764 para 15415697764 via mutação 8->9');

console.log('--- 3. TESTE DE REPARO ÓPTICO COM PROFILE CPF ---');
const reparoComAlvo = repararCPFOptico('15415687764', '154.156.977-64');
console.log('Reparo com alvo:', reparoComAlvo);
assert(reparoComAlvo !== null && reparoComAlvo.cpf === '15415697764', 'Deve reconciliar perfeitamente com o perfil alvo');

console.log('--- 4. TESTE DE EXTRAÇÃO INTELIGENTE DE CPF EM TEXTO SUJO ---');
const textoASO = `
  CLINICA DE SAUDE OCUPACIONAL MACAE
  ATESTADO DE SAUDE OCUPACIONAL - ASO
  NOME DO TRABALHADOR: CAIO VALERIO GOULART CORREIA
  CPF DO TRABALHADOR: 154.156.877-64   RG: 28356467-2
  DATA NASCIMENTO: 11/12/1885
  FUNCAO: ANALISTA DE SUPORTE TI
  (X) APTO PARA A FUNCAO    ( ) INAPTO
  DATA DO EXAME: 17/03/2025
  MEDICO EXAMINADOR: DRA HELOANA ANTUNES SABINO DA SILVA  CRM-RJ: 5280456-4
  MEDICO COORDENADOR PCMSO: DR CARLOS EDUARDO  CRM-RJ: 12345
  CNPJ: 12.345.678/0001-90
`;
const cpfInfo = extrairCPFInteligente(textoASO, '15415697764');
console.log('CPF Info extraído:', cpfInfo);
assert(cpfInfo.cpf === '15415697764', 'Deve extrair e auto-reparar CPF para 15415697764');

console.log('--- 5. TESTE DE RESULTADO APTO vs INAPTO ---');
const resApto = extrairResultadoInteligente(textoASO);
console.log('Resultado ASO:', resApto);
assert(resApto === 'apto', 'Deve identificar APTO por causa da marcação (X) APTO e ignorar o gabarito ( ) INAPTO');

console.log('--- 6. TESTE DE DATA DE NASCIMENTO E CORREÇÃO DE SÉCULO ---');
const dn = extrairDataNascimentoInteligente(textoASO, '2025-03-17');
console.log('Data de Nascimento:', dn);
assert(dn === '1985-12-11', 'Deve corrigir 1885 para 1985');

console.log('--- 7. TESTE DE ISOLAMENTO DE RG ---');
const rg = extrairRGInteligente(textoASO, '15415697764');
console.log('RG:', rg);
assert(rg === '283564672', 'Deve extrair RG 283564672 sem pegar pedaço de CPF');

console.log('--- 8. TESTE DE MÉDICOS E CRMS ---');
const medicos = extrairMedicoECRMInteligente(textoASO);
console.log('Médicos extraídos:', medicos);
assert(medicos.medicoExaminador?.nome?.includes('HELOANA') === true, 'Deve identificar médico examinador Heloana');
assert(medicos.medicoExaminador?.crm === '52804564', 'Deve extrair CRM do examinador');
assert(medicos.medicoPcmso?.crm === '12345', 'Deve extrair CRM do PCMSO');

console.log('\n🎉 TODOS OS TESTES UNITÁRIOS PASSARAM COM SUCESSO!');
