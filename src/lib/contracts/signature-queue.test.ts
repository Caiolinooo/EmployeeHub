import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    missingRequiredFieldValue,
    sameSigner,
    uniqueSignatureDocuments,
} from './signature-queue';

describe('uniqueSignatureDocuments', () => {
    it('dois campos no mesmo PDF não viram dois arquivos', () => {
        const docs = uniqueSignatureDocuments([
            { id: 'a', tipo: 'assinatura', documento: { id: 'pdf-1', titulo: 'Contrato' } },
            { id: 'b', tipo: 'texto', documento: { id: 'pdf-1', titulo: 'Contrato' } },
        ]);
        assert.equal(docs.length, 1);
        assert.equal(docs[0].documento?.id, 'pdf-1');
    });

    it('dois PDFs do mesmo signatário aparecem os dois', () => {
        const docs = uniqueSignatureDocuments([
            { id: 'a', tipo: 'assinatura', documento: { id: 'pdf-1', titulo: 'Contrato' } },
            { id: 'b', tipo: 'assinatura', documento: { id: 'pdf-2', titulo: 'Anexo' } },
        ]);
        assert.deepEqual(docs.map((d) => d.documento?.id), ['pdf-1', 'pdf-2']);
    });

    it('cópia não entra na lista de arquivos para assinar', () => {
        const docs = uniqueSignatureDocuments([
            { id: 'a', tipo: 'assinatura', documento: { id: 'pdf-1' } },
            { id: 'c', tipo: 'copia', documento: { id: 'pdf-2' } },
        ]);
        assert.equal(docs.length, 1);
    });
});

describe('sameSigner', () => {
    it('casa colaborador interno com campo externo do mesmo e-mail', () => {
        assert.equal(
            sameSigner(
                { colaborador_id: 'u1', colaborador: { email: 'Ana@ABZ.com' } },
                { colaborador_id: null, external_signer_email: 'ana@abz.com' },
            ),
            true,
        );
    });

    it('não casa e-mail diferente', () => {
        assert.equal(
            sameSigner(
                { colaborador_id: null, external_signer_email: 'a@abz.com' },
                { colaborador_id: null, external_signer_email: 'b@abz.com' },
            ),
            false,
        );
    });
});

describe('missingRequiredFieldValue', () => {
    it('texto obrigatório vazio bloqueia; opcional não', () => {
        assert.equal(missingRequiredFieldValue({ id: '1', tipo: 'texto', obrigatorio: true }, {}), true);
        assert.equal(missingRequiredFieldValue({ id: '1', tipo: 'texto', obrigatorio: false }, {}), false);
        assert.equal(
            missingRequiredFieldValue({ id: '1', tipo: 'texto', obrigatorio: true }, { '1': 'ok' }),
            false,
        );
    });

    it('checkbox obrigatório exige true', () => {
        assert.equal(missingRequiredFieldValue({ id: '2', tipo: 'checkbox', obrigatorio: true }, { '2': 'false' }), true);
        assert.equal(missingRequiredFieldValue({ id: '2', tipo: 'checkbox', obrigatorio: true }, { '2': 'true' }), false);
        assert.equal(missingRequiredFieldValue({ id: '2', tipo: 'checkbox', obrigatorio: false }, {}), false);
    });
});
